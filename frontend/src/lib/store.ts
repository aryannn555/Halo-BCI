"use client";

import { create } from "zustand";
import { FrameMsg, HelloMsg, StatusMsg } from "./contract";

export interface HaloConfig {
  model: string;
  noise_snr_db: number | null;
  threshold: number;
  dwell_ms: number;
  subject: number;
  speed: number;
  mode: "open" | "scripted";
}

export interface HaloStoreState {
  // Connection
  connected: boolean;
  connecting: boolean;
  error: string | null;
  isOffline: boolean;
  offlineOffered: boolean;

  // Server metadata
  hello: HelloMsg | null;
  status: StatusMsg | null;

  // Latest telemetry
  latestFrame: FrameMsg | null;
  frameHistory: FrameMsg[]; // Rolling buffer of last 600 frames (~60s at 10 fps)

  // Current session configuration
  config: HaloConfig;

  // Actions for inbound server messages
  setConnectionStatus: (connected: boolean, connecting: boolean, error?: string | null) => void;
  setOffline: (isOffline: boolean) => void;
  setOfflineOffered: (offered: boolean) => void;
  setHello: (hello: HelloMsg) => void;
  setStatus: (status: StatusMsg) => void;
  addFrame: (frame: FrameMsg) => void;
  setError: (error: string | null) => void;

  // Actions for outbound configuration
  setConfig: (patch: Partial<HaloConfig>) => void;
  clearHistory: () => void;
}

const MAX_HISTORY_FRAMES = 600;

export const useHaloStore = create<HaloStoreState>((set) => ({
  connected: false,
  connecting: false,
  error: null,
  isOffline: false,
  offlineOffered: false,

  hello: null,
  status: null,

  latestFrame: null,
  frameHistory: [],

  config: {
    model: "csp_lda",
    noise_snr_db: null,
    threshold: 0.65,
    dwell_ms: 600,
    subject: 1,
    speed: 1.0,
    mode: "open",
  },

  setConnectionStatus: (connected, connecting, error = null) =>
    set({ connected, connecting, error }),

  setOffline: (isOffline) => set({ isOffline }),
  setOfflineOffered: (offlineOffered) => set({ offlineOffered }),

  setHello: (hello) =>
    set((state) => ({
      hello,
      config: {
        ...state.config,
        model: hello.models.includes(state.config.model) ? state.config.model : hello.models[0] || "csp_lda",
        subject: hello.subjects.includes(state.config.subject) ? state.config.subject : hello.subjects[0] || 1,
      },
    })),

  setStatus: (status) =>
    set((state) => ({
      status,
      config: {
        ...state.config,
        model: status.model || state.config.model,
        subject: status.subject || state.config.subject,
        mode: status.mode || state.config.mode,
      },
    })),

  addFrame: (frame) =>
    set((state) => {
      const nextHistory = state.frameHistory.length >= MAX_HISTORY_FRAMES
        ? [...state.frameHistory.slice(state.frameHistory.length - MAX_HISTORY_FRAMES + 1), frame]
        : [...state.frameHistory, frame];

      return {
        latestFrame: frame,
        frameHistory: nextHistory,
      };
    }),

  setError: (error) => set({ error }),

  setConfig: (patch) =>
    set((state) => ({
      config: { ...state.config, ...patch },
    })),

  clearHistory: () =>
    set({
      latestFrame: null,
      frameHistory: [],
    }),
}));
