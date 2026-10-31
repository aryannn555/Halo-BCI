"use client";

import React, { useEffect, useRef, useState } from "react";
import { useHaloStore } from "@/lib/store";
import { GlassPanel } from "./GlassPanel";
import { SectionLabel } from "./Primitives";
import { Activity, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BandDef {
  id: string;
  name: string;
  range: string;
  baseFreq: number;
  color: string;
  accentClass: string;
}

const BANDS: BandDef[] = [
  { id: "gamma", name: "GAMMA", range: "30–45 Hz", baseFreq: 34.5, color: "#818cf8", accentClass: "text-indigo-400" },
  { id: "beta", name: "BETA", range: "13–30 Hz", baseFreq: 24.5, color: "#38bdf8", accentClass: "text-[#38bdf8]" },
  { id: "alpha", name: "ALPHA / MU", range: "8–12 Hz", baseFreq: 10.2, color: "#4cc9f0", accentClass: "text-[#4cc9f0]" },
  { id: "theta", name: "THETA", range: "4–8 Hz", baseFreq: 6.4, color: "#ffb547", accentClass: "text-[#ffb547]" },
  { id: "delta", name: "DELTA", range: "1–4 Hz", baseFreq: 2.2, color: "#f43f5e", accentClass: "text-rose-400" },
];

export function SpectralBandsCard({ className }: { className?: string }) {
  const status = useHaloStore((state) => state.status);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<number>(0);

  // Active hover/inspect band
  const [activeBand, setActiveBand] = useState<BandDef>(BANDS[1]); // BETA by default
  const isRunning = status?.state === "running";

  // Real-time canvas wave renderer (60 fps)
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Increment phase
      phaseRef.current += isRunning ? 0.08 : 0.02;
      const phase = phaseRef.current;

      const rowHeight = height / BANDS.length;

      BANDS.forEach((band, idx) => {
        const yCenter = (idx + 0.5) * rowHeight;
        const isSelected = activeBand.id === band.id;

        // Wave path
        ctx.beginPath();
        ctx.strokeStyle = isSelected ? band.color : `${band.color}88`;
        ctx.lineWidth = isSelected ? 2.0 : 1.2;

        const freqFactor = (idx + 1) * 1.8;
        const amp = (isSelected ? 9 : 6) * (isRunning ? 1.0 : 0.5);

        for (let x = 0; x < width; x += 2) {
          const t = x / width;
          // Organic EEG oscillation = sum of 3 harmonics
          const y =
            yCenter +
            Math.sin(t * 18 * freqFactor + phase * freqFactor) * amp * 0.7 +
            Math.sin(t * 32 * freqFactor - phase * 1.2) * amp * 0.25 +
            Math.cos(t * 8 + phase * 0.5) * amp * 0.15;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Subtle glow under active wave
        if (isSelected) {
          ctx.shadowColor = band.color;
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isRunning, activeBand]);

  return (
    <GlassPanel
      variant="default"
      className={cn(
        "relative flex flex-col justify-between p-5 bg-[#0D0F12]/80 backdrop-blur-2xl border-white/10 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SectionLabel icon={<Activity className="w-3.5 h-3.5 text-[#4CC9F0]" />}>
            Rhythmic EEG Spectra
          </SectionLabel>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/5 text-[11px] text-muted font-mono">
          <span>Continuous Welch</span>
          <ChevronDown className="w-3 h-3 text-muted/70" />
        </div>
      </div>

      {/* Main Wave Oscillogram Container */}
      <div className="relative flex-1 min-h-[190px] flex">
        {/* Left labels column */}
        <div className="w-24 flex flex-col justify-between py-1 z-10 select-none">
          {BANDS.map((band) => {
            const isSelected = activeBand.id === band.id;
            return (
              <button
                key={band.id}
                onClick={() => setActiveBand(band)}
                className={cn(
                  "flex items-center justify-between text-left transition-colors py-0.5",
                  isSelected ? "text-white font-semibold" : "text-muted hover:text-text"
                )}
              >
                <span className="text-[11px] font-mono tracking-tight">{band.name}</span>
              </button>
            );
          })}
        </div>

        {/* Waves Canvas */}
        <div className="relative flex-1">
          <canvas
            ref={canvasRef}
            width={380}
            height={190}
            className="w-full h-full block"
          />
        </div>

        {/* Right frequency readouts */}
        <div className="w-16 flex flex-col justify-between py-1 text-right z-10 select-none">
          {BANDS.map((band) => (
            <span
              key={band.id}
              className="text-[11px] font-mono tabular-nums text-muted/80"
            >
              {band.baseFreq.toFixed(1)} Hz
            </span>
          ))}
        </div>

        {/* Floating VisionOS Glass Tooltip Card (Matching Reference Screenshot) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-2xl halo-glass bg-[#14171B]/90 backdrop-blur-2xl border-white/15 shadow-2xl max-w-[190px] animate-in fade-in">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              {activeBand.name}
            </span>
            <span className="text-[9px] font-mono text-muted/60">{activeBand.range}</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-xl font-mono font-bold text-text tabular-nums">
              {activeBand.baseFreq} Hz
            </span>
            <span className="text-[10px] text-muted">peak</span>
          </div>
          <div className="h-6 w-full rounded-lg bg-black/40 p-1 flex items-center justify-center">
            <span className="text-[10px] font-mono text-[#4CC9F0] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4CC9F0] animate-pulse" />
              Live Acquisition
            </span>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
