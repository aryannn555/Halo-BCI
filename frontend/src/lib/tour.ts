"use client";

import { create } from "zustand";
import { sendHaloConfig, sendHaloControl } from "./useHalo";
import { startOfflineReplay } from "./offlinePlayer";
import { useHaloStore } from "./store";

export interface TourStep {
  id: string;
  route: string;
  durationS: number;
  title: string;
  caption: string;
  action?: () => void | Promise<void>;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "overview",
    route: "/",
    durationS: 15,
    title: "1/6 • The Problem & The Hope",
    caption:
      "Halo restores communication and physical control for people living with ALS and quadriplegia by translating motor imagery EEG rhythms into discrete actions.",
  },
  {
    id: "live",
    route: "/live",
    durationS: 35,
    title: "2/6 • Real-Time Neural Stream (2x Replay)",
    caption:
      "Continuous streaming at 2x speed. Observe C3 (cyan) and C4 (amber) motor channels. The Intent Ring smooths probabilities with exponential moving average and dwell thresholding.",
    action: () => {
      sendHaloControl("change_speed", { speed: 2.0 });
      sendHaloControl("start");
      useHaloStore.getState().setConfig({ speed: 2.0 });
    },
  },
  {
    id: "assist_commands",
    route: "/assist",
    durationS: 45,
    title: "3/6 • Assistive Command Board",
    caption:
      "Assist converts motor intent into discrete binary control. The binary search tree requires only 3 intended decisions to trigger wheelchair navigation or emergency calls.",
    action: () => {
      sendHaloConfig({ mode: "scripted" });
    },
  },
  {
    id: "assist_keyboard",
    route: "/assist",
    durationS: 30,
    title: "4/6 • Predictive Huffman Keyboard",
    caption:
      "Typing with neural intent: a weight-balanced binary tree minimizes decision fatigue, supplemented by continuous language-model prefix word completions.",
  },
  {
    id: "lab",
    route: "/lab",
    durationS: 40,
    title: "5/6 • Scientific Verification & Noise Sweep",
    caption:
      "Held-out cross-session benchmarks show 90.2% accuracy. Injected 50 Hz powerline hum and thermal noise down to -5 dB demonstrate robust bandpass SOS filtering.",
    action: async () => {
      // Simulate brief noise sweep demo
      sendHaloConfig({ noise_snr_db: 5.0 });
      setTimeout(() => {
        sendHaloConfig({ noise_snr_db: -5.0 });
      }, 15000);
      setTimeout(() => {
        sendHaloConfig({ noise_snr_db: null });
      }, 30000);
    },
  },
  {
    id: "closing",
    route: "/lab",
    durationS: 15,
    title: "6/6 • What We Proved & What Is Next",
    caption:
      "Sub-millisecond inference and 100 ms streaming make non-invasive BCI practical today. Next steps: live LSL/BrainFlow headset streaming, 4-class imagery, and on-device quantization.",
  },
];

export interface TourStoreState {
  isActive: boolean;
  currentStepIndex: number;
  timeRemainingS: number;
  isPaused: boolean;

  startTour: () => void;
  stopTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  togglePause: () => void;
  tick: () => void;
}

export const useTourStore = create<TourStoreState>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,
  timeRemainingS: TOUR_STEPS[0].durationS,
  isPaused: false,

  startTour: () => {
    // If backend is not connected, auto-launch offline replay
    const haloStore = useHaloStore.getState();
    if (!haloStore.connected) {
      startOfflineReplay(2.0);
    }

    const firstStep = TOUR_STEPS[0];
    set({
      isActive: true,
      currentStepIndex: 0,
      timeRemainingS: firstStep.durationS,
      isPaused: false,
    });

    if (firstStep.action) {
      firstStep.action();
    }
  },

  stopTour: () => {
    set({ isActive: false, isPaused: false });
    // Restore 1.0x speed
    sendHaloControl("change_speed", { speed: 1.0 });
    sendHaloConfig({ noise_snr_db: null });
  },

  nextStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      const step = TOUR_STEPS[nextIdx];
      set({
        currentStepIndex: nextIdx,
        timeRemainingS: step.durationS,
      });
      if (step.action) {
        step.action();
      }
    } else {
      get().stopTour();
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      const step = TOUR_STEPS[prevIdx];
      set({
        currentStepIndex: prevIdx,
        timeRemainingS: step.durationS,
      });
      if (step.action) {
        step.action();
      }
    }
  },

  togglePause: () => {
    set((state) => ({ isPaused: !state.isPaused }));
  },

  tick: () => {
    const { isActive, isPaused, timeRemainingS, nextStep } = get();
    if (!isActive || isPaused) return;

    if (timeRemainingS > 1) {
      set({ timeRemainingS: timeRemainingS - 1 });
    } else {
      nextStep();
    }
  },
}));

export function startTour() {
  useTourStore.getState().startTour();
}

export function stopTour() {
  useTourStore.getState().stopTour();
}
