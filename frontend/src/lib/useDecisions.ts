"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MotorImageryClass } from "./contract";
import { useHaloStore } from "./store";
import { sendHaloControl, sendHaloConfig } from "./useHalo";
import { useIntent, IntentFiredEvent } from "./useIntent";

export interface DecisionRecord {
  id: string;
  time: number; // timestamp ms
  decided: MotorImageryClass;
  intended: MotorImageryClass | null;
  correct: boolean;
  trial_id: string;
  decision_ms: number;
}

export interface DecisionStats {
  total: number;
  correctCount: number;
  accuracy: number;
  avgDecisionMs: number;
  estCharsPerMin: number;
}

/**
 * Pure calculation function for deterministic unit testing.
 */
export function calculateDecisionStats(
  records: DecisionRecord[],
  decisionsPerChar = 4.2
): DecisionStats {
  const total = records.length;
  if (total === 0) {
    return {
      total: 0,
      correctCount: 0,
      accuracy: 100,
      avgDecisionMs: 1200,
      estCharsPerMin: 0,
    };
  }

  const correctCount = records.filter((r) => r.correct).length;
  const accuracy = (correctCount / total) * 100;
  const avgDecisionMs = records.reduce((sum, r) => sum + r.decision_ms, 0) / total;

  // Information-theoretic throughput:
  // Decision rate = 60,000 / avgDecisionMs decisions per minute
  // Effective throughput accounting for error corrections (net forward step factor 2A - 1)
  const accFraction = accuracy / 100;
  const netForwardFactor = Math.max(0.05, 2 * accFraction - 1);
  const decisionsPerMin = 60000 / Math.max(400, avgDecisionMs);
  const estCharsPerMin =
    Math.round((decisionsPerMin / Math.max(1, decisionsPerChar)) * netForwardFactor * 10) / 10;

  return {
    total,
    correctCount,
    accuracy: Math.round(accuracy * 10) / 10,
    avgDecisionMs: Math.round(avgDecisionMs),
    estCharsPerMin,
  };
}

export interface UseDecisionsOptions {
  initialMode?: "auto" | "manual";
  getIntended?: () => MotorImageryClass | null;
  onDecision?: (record: DecisionRecord) => void;
  decisionsPerChar?: number;
}

export interface UseDecisionsReturn {
  userMode: "auto" | "manual";
  setUserMode: (mode: "auto" | "manual") => void;
  records: DecisionRecord[];
  clearLog: () => void;
  stats: DecisionStats;
  currentIntended: MotorImageryClass | null;
  requestNextDecision: () => void;
  manualQueue: (want: MotorImageryClass) => void;
}

export function useDecisions(options: UseDecisionsOptions = {}): UseDecisionsReturn {
  const {
    initialMode = "auto",
    getIntended,
    onDecision,
    decisionsPerChar = 4.2,
  } = options;

  const latestFrame = useHaloStore((state) => state.latestFrame);
  const connected = useHaloStore((state) => state.connected);

  const [userMode, setUserModeState] = useState<"auto" | "manual">(initialMode);
  const [records, setRecords] = useState<DecisionRecord[]>([]);
  const [currentIntended, setCurrentIntended] = useState<MotorImageryClass | null>(null);

  const currentIntendedRef = useRef<MotorImageryClass | null>(null);
  const trialStartTimeRef = useRef<number>(performance.now());
  const userModeRef = useRef<"auto" | "manual">(initialMode);
  userModeRef.current = userMode;

  const getIntendedRef = useRef(getIntended);
  getIntendedRef.current = getIntended;

  const onDecisionRef = useRef(onDecision);
  onDecisionRef.current = onDecision;

  const requestNextDecision = useCallback(() => {
    const intended = getIntendedRef.current ? getIntendedRef.current() : null;
    currentIntendedRef.current = intended;
    setCurrentIntended(intended);
    trialStartTimeRef.current = performance.now();

    if (intended) {
      sendHaloControl("queue_trial", { want: intended });
    }
  }, []);

  const manualQueue = useCallback((want: MotorImageryClass) => {
    currentIntendedRef.current = want;
    setCurrentIntended(want);
    trialStartTimeRef.current = performance.now();
    sendHaloControl("queue_trial", { want });
  }, []);

  // Configure scripted replay mode and trigger first decision when connected
  useEffect(() => {
    if (connected) {
      sendHaloConfig({ mode: "scripted" });
      if (userModeRef.current === "auto") {
        const timer = setTimeout(() => {
          requestNextDecision();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [connected, requestNextDecision]);

  const setUserMode = useCallback(
    (mode: "auto" | "manual") => {
      setUserModeState(mode);
      userModeRef.current = mode;
      if (mode === "auto") {
        requestNextDecision();
      }
    },
    [requestNextDecision]
  );

  // Handle Dwell Intent Firing
  const handleIntentFired = useCallback(
    (event: IntentFiredEvent) => {
      const now = performance.now();
      const decisionDuration = Math.max(100, Math.round(now - trialStartTimeRef.current));
      const decided = event.label;
      const intended = currentIntendedRef.current;
      const isCorrect = intended !== null ? decided === intended : true;
      const trialId = latestFrame?.trial_id || `trial_${latestFrame?.trial ?? 1}`;

      const record: DecisionRecord = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        time: Date.now(),
        decided,
        intended,
        correct: isCorrect,
        trial_id: trialId,
        decision_ms: decisionDuration,
      };

      setRecords((prev) => [record, ...prev].slice(0, 60)); // Keep last 60 decisions
      onDecisionRef.current?.(record);

      // In auto mode, immediately queue next step after short cooldown
      if (userModeRef.current === "auto") {
        setTimeout(() => {
          if (userModeRef.current === "auto") {
            requestNextDecision();
          }
        }, 120);
      }
    },
    [latestFrame?.trial_id, latestFrame?.trial, requestNextDecision]
  );

  // Attach useIntent dwell listener
  useIntent(handleIntentFired);

  // Keyboard navigation listener for manual mode (Left / Right arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        manualQueue("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        manualQueue("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [manualQueue]);

  const clearLog = useCallback(() => {
    setRecords([]);
  }, []);

  const stats = calculateDecisionStats(records, decisionsPerChar);

  return {
    userMode,
    setUserMode,
    records,
    clearLog,
    stats,
    currentIntended,
    requestNextDecision,
    manualQueue,
  };
}
