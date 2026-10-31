"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTourStore, TOUR_STEPS } from "@/lib/tour";
import { KeyHint } from "./Primitives";
import {
  Compass,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

export function TourOverlay() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = useTourStore((state) => state.isActive);
  const currentStepIndex = useTourStore((state) => state.currentStepIndex);
  const timeRemainingS = useTourStore((state) => state.timeRemainingS);
  const isPaused = useTourStore((state) => state.isPaused);

  const nextStep = useTourStore((state) => state.nextStep);
  const prevStep = useTourStore((state) => state.prevStep);
  const togglePause = useTourStore((state) => state.togglePause);
  const stopTour = useTourStore((state) => state.stopTour);
  const tick = useTourStore((state) => state.tick);

  const step = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];

  // Tick 1-second interval while active
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, tick]);

  // Handle route switching per step
  useEffect(() => {
    if (!isActive) return;
    if (step && pathname !== step.route) {
      router.push(step.route);
    }
  }, [isActive, currentStepIndex, step, pathname, router]);

  // Global key bindings for Guided Demo
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        stopTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      } else if (e.key === " " && e.target === document.body) {
        e.preventDefault();
        togglePause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, stopTour, nextStep, prevStep, togglePause]);

  if (!isActive) return null;

  const progressPct = Math.max(
    0,
    Math.min(100, ((step.durationS - timeRemainingS) / step.durationS) * 100)
  );

  return (
    <aside
      aria-label="Guided Tour Navigation"
      className="fixed bottom-6 inset-x-0 mx-auto max-w-3xl z-50 px-4 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="relative rounded-2xl bg-[#0D0F12]/92 backdrop-blur-2xl border border-white/15 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.7)] flex flex-col gap-2.5 overflow-hidden">
        {/* Step Progress Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-white/[0.08]">
          <div
            className="h-full bg-gradient-to-r from-[#4CC9F0] to-[#FFB547] transition-all duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Top Header inside Caption Bar */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-300">
              <Compass className="w-3 h-3" />
            </span>
            <span className="text-xs font-mono font-semibold text-text">
              {step.title}
            </span>
            <span className="text-[10px] font-mono text-muted/80">
              ({timeRemainingS}s)
            </span>
          </div>

          {/* Tour Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className="p-1 rounded-lg text-muted hover:text-text disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous Step (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={togglePause}
              className="p-1 rounded-lg text-muted hover:text-text transition-colors"
              title={isPaused ? "Resume Tour" : "Pause Tour"}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            <button
              onClick={nextStep}
              className="p-1 rounded-lg text-muted hover:text-text transition-colors"
              title="Next Step (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={stopTour}
              className="p-1 rounded-lg text-muted hover:text-rose-400 transition-colors ml-1"
              title="Exit Tour (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Narrator Caption */}
        <p className="text-xs sm:text-sm text-text font-sans leading-relaxed">
          {step.caption}
        </p>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between text-[10px] font-mono text-muted/70 pt-1 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span>Skip: <KeyHint>←</KeyHint> / <KeyHint>→</KeyHint></span>
            <span>Pause: <KeyHint>Space</KeyHint></span>
            <span>Exit: <KeyHint>Esc</KeyHint></span>
          </div>
          <span>Halo BCI Guided Demo</span>
        </div>
      </div>
    </aside>
  );
}
