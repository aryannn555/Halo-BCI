import { useEffect, useRef, useState } from "react";
import { useHaloStore } from "./store";
import { MotorImageryClass } from "./contract";

export interface IntentFiredEvent {
  label: MotorImageryClass;
  timestamp: number;
  confidence: number;
}

export interface IntentState {
  label: MotorImageryClass | null;
  confidence: number;
  pLeft: number;
  pRight: number;
  armed: boolean;
  dwellProgress: number; // 0..1
  fired: IntentFiredEvent | null;
  cooldownUntil: number;
}

export interface InternalDwellTracking {
  currentLabel: MotorImageryClass | null;
  armedSince: number | null;
  cooldownUntil: number;
  lastFired: IntentFiredEvent | null;
}

/**
 * Pure transition function for deterministic unit testing.
 */
export function updateDwellState(
  prevTracking: InternalDwellTracking,
  input: {
    pred: { left: number; right: number; label: MotorImageryClass; confidence: number } | null;
    threshold: number;
    dwellMs: number;
    currentTime: number;
  }
): { tracking: InternalDwellTracking; state: IntentState } {
  const { pred, threshold, dwellMs, currentTime } = input;

  const pLeft = pred?.left ?? 0.5;
  const pRight = pred?.right ?? 0.5;
  const confidence = pred?.confidence ?? 0;
  const candidateLabel = pred?.label ?? null;

  // 1. Check if in cooldown period
  if (currentTime < prevTracking.cooldownUntil) {
    const tracking: InternalDwellTracking = {
      ...prevTracking,
      currentLabel: null,
      armedSince: null,
      lastFired: null,
    };
    return {
      tracking,
      state: {
        label: candidateLabel,
        confidence,
        pLeft,
        pRight,
        armed: false,
        dwellProgress: 0,
        fired: null,
        cooldownUntil: prevTracking.cooldownUntil,
      },
    };
  }

  // 2. Check if armed (confidence >= threshold)
  const armed = candidateLabel !== null && confidence >= threshold;

  if (!armed) {
    const tracking: InternalDwellTracking = {
      currentLabel: null,
      armedSince: null,
      cooldownUntil: prevTracking.cooldownUntil,
      lastFired: null,
    };
    return {
      tracking,
      state: {
        label: candidateLabel,
        confidence,
        pLeft,
        pRight,
        armed: false,
        dwellProgress: 0,
        fired: null,
        cooldownUntil: prevTracking.cooldownUntil,
      },
    };
  }

  // 3. Armed: check if same label is maintained or if it just switched
  let armedSince = prevTracking.armedSince;
  let currentLabel = prevTracking.currentLabel;

  if (currentLabel !== candidateLabel || armedSince === null) {
    // New label armed
    currentLabel = candidateLabel;
    armedSince = currentTime;
  }

  const elapsed = currentTime - armedSince;
  const dwellProgress = Math.min(1.0, Math.max(0, elapsed / Math.max(1, dwellMs)));

  let fired: IntentFiredEvent | null = null;
  let cooldownUntil = prevTracking.cooldownUntil;

  // 4. Trigger fired event when dwell reaches 1.0
  if (dwellProgress >= 1.0) {
    fired = {
      label: currentLabel,
      timestamp: currentTime,
      confidence,
    };
    cooldownUntil = currentTime + 700; // 700 ms cooldown
    armedSince = null;
    currentLabel = null;
  }

  const nextTracking: InternalDwellTracking = {
    currentLabel,
    armedSince,
    cooldownUntil,
    lastFired: fired,
  };

  return {
    tracking: nextTracking,
    state: {
      label: candidateLabel,
      confidence,
      pLeft,
      pRight,
      armed,
      dwellProgress: fired ? 1.0 : dwellProgress,
      fired,
      cooldownUntil,
    },
  };
}

function hasStateChanged(prev: IntentState, next: IntentState): boolean {
  if (next.fired !== null) return true;
  if (prev.armed !== next.armed) return true;
  if (prev.label !== next.label) return true;
  if (Math.abs(prev.confidence - next.confidence) > 0.005) return true;
  if (Math.abs(prev.dwellProgress - next.dwellProgress) > 0.01) return true;
  if (prev.cooldownUntil !== next.cooldownUntil) return true;
  return false;
}

/**
 * React hook sharing intent decoding and continuous dwell selection.
 */
export function useIntent(onFired?: (event: IntentFiredEvent) => void): IntentState {
  const trackingRef = useRef<InternalDwellTracking>({
    currentLabel: null,
    armedSince: null,
    cooldownUntil: 0,
    lastFired: null,
  });

  const [intentState, setIntentState] = useState<IntentState>({
    label: null,
    confidence: 0,
    pLeft: 0.5,
    pRight: 0.5,
    armed: false,
    dwellProgress: 0,
    fired: null,
    cooldownUntil: 0,
  });

  const prevStateRef = useRef<IntentState>(intentState);

  // Animation frame / timer ticker to advance dwellProgress smoothly in real-time
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const now = performance.now();
      const pred = useHaloStore.getState().latestFrame?.pred ?? null;
      const currentThreshold = useHaloStore.getState().config.threshold ?? 0.65;
      const currentDwellMs = useHaloStore.getState().config.dwell_ms ?? 600;

      const { tracking, state } = updateDwellState(trackingRef.current, {
        pred,
        threshold: currentThreshold,
        dwellMs: currentDwellMs,
        currentTime: now,
      });

      trackingRef.current = tracking;

      // Only trigger React re-renders when state actually changes
      if (hasStateChanged(prevStateRef.current, state)) {
        prevStateRef.current = state;
        setIntentState(state);
      }

      if (state.fired && onFired) {
        onFired(state.fired);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [onFired]);

  return intentState;
}
