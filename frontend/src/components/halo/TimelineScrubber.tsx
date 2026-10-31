"use client";

import React from "react";
import { useHaloStore } from "@/lib/store";
import { GlassPanel } from "./GlassPanel";
import { Play, Pause, RotateCcw } from "lucide-react";
import { sendHaloControl } from "@/lib/useHalo";
import { KeyHint } from "./Primitives";
import { cn } from "@/lib/utils";

export function TimelineScrubber({ className }: { className?: string }) {
  const latestFrame = useHaloStore((state) => state.latestFrame);
  const status = useHaloStore((state) => state.status);

  const isRunning = status?.state === "running";
  const trial = latestFrame?.trial ?? 1;
  const t = latestFrame?.t ?? 0;
  const confidence = latestFrame?.pred?.confidence ?? 0.84;
  const latency = latestFrame?.pred?.latency_ms ?? 14.2;

  // Epoch progress: each epoch is ~4.0 seconds (streamed in 100ms hops)
  // Time within epoch roughly loops 0 to 4s
  const epochProgress = (t % 4.0) / 4.0;

  const handleToggle = () => {
    sendHaloControl(isRunning ? "pause" : "start");
  };

  const handleReset = () => {
    sendHaloControl("reset");
  };

  return (
    <div className={cn("relative w-full flex flex-col items-center", className)}>
      {/* Floating Glass Tooltip Tag above timeline handle (Matching Reference Screenshot) */}
      <div
        className="mb-2 p-2.5 rounded-2xl halo-glass bg-[#14171B]/95 backdrop-blur-2xl border-white/15 shadow-2xl flex items-center gap-4 transition-all duration-150 animate-in fade-in"
        style={{
          transform: `translateX(${Math.min(260, Math.max(-260, (epochProgress - 0.5) * 500))}px)`,
        }}
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            <span>Trial {trial} / 144</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-mono font-medium text-text">
            t = {t.toFixed(2)}s • {latency.toFixed(1)}ms
          </span>
        </div>

        <div className="h-6 w-[1px] bg-white/10" />

        <div className="flex flex-col text-right">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Confidence
          </span>
          <span className="text-xs font-mono font-bold text-[#4CC9F0]">
            {(confidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Main Timeline Bar Container */}
      <GlassPanel
        variant="default"
        className="w-full p-2.5 bg-[#0D0F12]/85 backdrop-blur-xl border-white/10 flex items-center gap-4 shadow-xl"
      >
        {/* Play/Pause Button */}
        <button
          onClick={handleToggle}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-all",
            isRunning
              ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
              : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
          )}
          title={isRunning ? "Pause replay (Space)" : "Start replay (Space)"}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {/* Rewind Button */}
        <button
          onClick={handleReset}
          className="p-1.5 rounded-full text-muted hover:text-text hover:bg-white/5 transition-colors"
          title="Rewind to trial 1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Timeline Scrub Track */}
        <div className="relative flex-1 h-5 flex items-center">
          {/* Tick marks behind track */}
          <div className="absolute inset-0 flex justify-between items-center px-1 pointer-events-none">
            {["0.0s", "0.5s", "1.0s", "1.5s", "2.0s", "2.5s", "3.0s", "3.5s", "4.0s"].map(
              (tick, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-[1px] h-2 bg-white/15" />
                  <span className="text-[9px] font-mono text-muted/60 mt-0.5 hidden md:block">
                    {tick}
                  </span>
                </div>
              )
            )}
          </div>

          {/* Background Track line */}
          <div className="relative w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4CC9F0] via-[#38bdf8] to-[#FFB547] rounded-full transition-all duration-100"
              style={{ width: `${epochProgress * 100}%` }}
            />
          </div>

          {/* Glowing Playhead Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#38bdf8] shadow-[0_0_12px_#38bdf8] pointer-events-none transition-all duration-100"
            style={{ left: `${epochProgress * 100}%` }}
          />
        </div>

        {/* Right Session Badge */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/10 shrink-0">
          <KeyHint className="text-[9px]">Space</KeyHint>
          <span className="text-[11px] font-mono text-muted">250 Hz</span>
        </div>
      </GlassPanel>
    </div>
  );
}
