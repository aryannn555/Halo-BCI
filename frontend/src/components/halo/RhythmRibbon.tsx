"use client";

import React, { useEffect, useRef } from "react";
import { GlassPanel } from "./GlassPanel";
import { useHaloStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface RhythmItem {
  id: string;
  title: string;
  greek: string;
  symbol: string;
  freq: number;
  range: string;
  color: string;
  speed: number;
  amp: number;
}

const RHYTHMS: RhythmItem[] = [
  { id: "gamma", title: "Concentration", greek: "GAMMA", symbol: "γ", freq: 34.5, range: "30–45 Hz", color: "#818cf8", speed: 0.12, amp: 8 },
  { id: "beta", title: "Active Mind", greek: "BETA", symbol: "β", freq: 24.5, range: "13–30 Hz", color: "#38bdf8", speed: 0.09, amp: 7 },
  { id: "alpha", title: "Reflective / Mu", greek: "ALPHA", symbol: "α", freq: 8.7, range: "8–12 Hz", color: "#4cc9f0", speed: 0.05, amp: 9 },
  { id: "delta", title: "Drowsiness", greek: "DELTA", symbol: "δ", freq: 5.1, range: "0.5–4 Hz", color: "#f43f5e", speed: 0.03, amp: 10 },
  { id: "theta", title: "Sensorimotor", greek: "THETA", symbol: "θ", freq: 9.8, range: "4–8 Hz", color: "#ffb547", speed: 0.04, amp: 8 },
];

function MiniWave({ rhythm, isRunning }: { rhythm: RhythmItem; isRunning: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<number>(Math.random() * 10);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      phaseRef.current += isRunning ? rhythm.speed : 0.01;
      const phase = phaseRef.current;

      ctx.beginPath();
      ctx.strokeStyle = rhythm.color;
      ctx.lineWidth = 1.5;

      const w = canvas.width;
      const h = canvas.height;
      const mid = h / 2;

      for (let x = 0; x < w; x += 2) {
        const t = x / w;
        const y = mid + Math.sin(t * 14 + phase) * rhythm.amp * 0.7 + Math.cos(t * 22 - phase * 0.8) * (rhythm.amp * 0.3);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [rhythm, isRunning]);

  return (
    <canvas
      ref={canvasRef}
      width={140}
      height={32}
      className="w-full h-8 block"
    />
  );
}

export function RhythmRibbon({ className }: { className?: string }) {
  const status = useHaloStore((state) => state.status);
  const isRunning = status?.state === "running";

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3", className)}>
      {RHYTHMS.map((rhythm) => (
        <GlassPanel
          key={rhythm.id}
          variant="default"
          className="p-3.5 bg-[#0D0F12]/80 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all flex flex-col justify-between"
        >
          {/* Card Top: Title & Greek Pill */}
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] font-medium text-muted truncate">
              {rhythm.title}
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/5 text-[9px] font-mono font-bold text-muted/80">
              {rhythm.greek}
            </span>
          </div>

          {/* Card Mid: Big Symbol & Frequency */}
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className="text-lg font-mono font-bold leading-none"
              style={{ color: rhythm.color }}
            >
              {rhythm.symbol}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-mono font-semibold text-text tabular-nums leading-none">
                {rhythm.freq}
              </span>
              <span className="text-[10px] text-muted font-mono">Hz</span>
            </div>
          </div>

          {/* Card Bottom: Animated Oscilloscope Canvas */}
          <div className="rounded-lg bg-black/30 p-1 border border-white/5 overflow-hidden">
            <MiniWave rhythm={rhythm} isRunning={isRunning} />
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[9.5px] font-mono text-muted/60">
            <span>Range: {rhythm.range}</span>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rhythm.color }} />
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
