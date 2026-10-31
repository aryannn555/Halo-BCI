"use client";

import { useHaloStore } from "./store";
import { FrameMsg, HelloMsg, StatusMsg } from "./contract";

interface DemoSessionData {
  metadata: {
    subject: number;
    model: string;
    duration_s: number;
    fps: number;
    sfreq: number;
    channels: string[];
    total_frames: number;
  };
  hello: HelloMsg;
  frames: FrameMsg[];
}

let cachedSessionData: DemoSessionData | null = null;
let replayTimer: NodeJS.Timeout | null = null;
let currentFrameIndex = 0;
let isPaused = false;

/**
 * Fetch and cache the 120s saved demo session.
 */
export async function loadDemoSession(): Promise<DemoSessionData | null> {
  if (cachedSessionData) return cachedSessionData;

  try {
    const res = await fetch("/demo-session.json");
    if (!res.ok) {
      console.warn("[offlinePlayer] demo-session.json not found on server.");
      return null;
    }
    const data: DemoSessionData = await res.json();
    cachedSessionData = data;
    return data;
  } catch (err) {
    console.error("[offlinePlayer] Failed to load /demo-session.json:", err);
    return null;
  }
}

/**
 * Starts continuous offline replay of the saved session.
 */
export async function startOfflineReplay(customSpeed?: number): Promise<boolean> {
  const data = await loadDemoSession();
  if (!data || !data.frames || data.frames.length === 0) {
    return false;
  }

  stopOfflineReplay();
  isPaused = false;
  currentFrameIndex = 0;

  const store = useHaloStore.getState();
  store.setOffline(true);
  store.setConnectionStatus(true, false, null);
  store.setHello(data.hello);

  const initialStatus: StatusMsg = {
    type: "status",
    state: "running",
    subject: data.metadata.subject,
    model: data.metadata.model,
    mode: "open",
  };
  store.setStatus(initialStatus);

  const speed = customSpeed || store.config.speed || 1.0;
  const intervalMs = Math.max(10, Math.round(100 / speed));

  const streamNextFrame = () => {
    if (isPaused) return;

    const frame = data.frames[currentFrameIndex];
    if (frame) {
      store.addFrame(frame);
    }

    currentFrameIndex = (currentFrameIndex + 1) % data.frames.length;
  };

  replayTimer = setInterval(streamNextFrame, intervalMs);
  return true;
}

/**
 * Stops or tears down offline replay.
 */
export function stopOfflineReplay(): void {
  if (replayTimer) {
    clearInterval(replayTimer);
    replayTimer = null;
  }
  isPaused = false;
}

/**
 * Pause / Resume offline replay.
 */
export function togglePauseOfflineReplay(): void {
  isPaused = !isPaused;
  const store = useHaloStore.getState();
  const currentStatus = store.status;
  if (currentStatus) {
    store.setStatus({
      ...currentStatus,
      state: isPaused ? "paused" : "running",
    });
  }
}

/**
 * Updates offline replay speed dynamically.
 */
export function setOfflineReplaySpeed(speed: number): void {
  const store = useHaloStore.getState();
  store.setConfig({ speed });
  if (replayTimer && cachedSessionData) {
    clearInterval(replayTimer);
    const intervalMs = Math.max(10, Math.round(100 / speed));
    replayTimer = setInterval(() => {
      if (isPaused || !cachedSessionData) return;
      const frame = cachedSessionData.frames[currentFrameIndex];
      if (frame) {
        store.addFrame(frame);
      }
      currentFrameIndex = (currentFrameIndex + 1) % cachedSessionData.frames.length;
    }, intervalMs);
  }
}
