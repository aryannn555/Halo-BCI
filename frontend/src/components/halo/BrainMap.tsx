"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { useHaloStore } from "@/lib/store";
import { GlassPanel } from "./GlassPanel";
import { SectionLabel } from "./Primitives";
import { StatNumber } from "./StatNumber";
import montage2D from "@/lib/montage_2d.json";
import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

// Standard channel names in BCI IV 2a order
const CHANNELS = [
  "Fz", "FC3", "FC1", "FCz", "FC2", "FC4",
  "C5", "C3", "C1", "Cz", "C2", "C4", "C6",
  "CP3", "CP1", "CPz", "CP2", "CP4",
  "P1", "Pz", "P2", "Oz"
];

const C3_INDEX = 7;
const C4_INDEX = 11;

export function BrainMap({ className }: { className?: string }) {
  const latestFrame = useHaloStore((state) => state.latestFrame);
  const frameHistory = useHaloStore((state) => state.frameHistory);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filtered/smoothed ERD strengths per channel (0 to 0.6)
  const smoothedStrengthsRef = useRef<Float32Array>(new Float32Array(CHANNELS.length));

  // Current mu ratios
  const c3Mu = latestFrame?.bandpower?.mu?.[C3_INDEX] ?? 1.0;
  const c4Mu = latestFrame?.bandpower?.mu?.[C4_INDEX] ?? 1.0;

  // History buffer for 10s sparklines (at ~10 fps, 100 frames)
  const c3Sparkline = useMemo(() => {
    const history = frameHistory.slice(-100);
    if (history.length < 2) return "";
    const values = history.map((f) => f.bandpower?.mu?.[C3_INDEX] ?? 1.0);
    const minVal = 0.4;
    const maxVal = 1.6;
    const w = 90;
    const h = 24;

    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const clamped = Math.max(minVal, Math.min(maxVal, v));
        const y = h - ((clamped - minVal) / (maxVal - minVal)) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [frameHistory]);

  const c4Sparkline = useMemo(() => {
    const history = frameHistory.slice(-100);
    if (history.length < 2) return "";
    const values = history.map((f) => f.bandpower?.mu?.[C4_INDEX] ?? 1.0);
    const minVal = 0.4;
    const maxVal = 1.6;
    const w = 90;
    const h = 24;

    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const clamped = Math.max(minVal, Math.min(maxVal, v));
        const y = h - ((clamped - minVal) / (maxVal - minVal)) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [frameHistory]);

  // IDW Heatmap Rendering on Canvas
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const res = 120;
    canvas.width = res;
    canvas.height = res;
    const imgData = ctx.createImageData(res, res);
    const data = imgData.data;

    // Initialize RGB to 255 (monochrome white) and alpha to 0
    for (let i = 0; i < res * res; i++) {
      const idx = i * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 0;
    }

    // Precalculate electrode pixel locations
    const elecPixels = CHANNELS.map((ch) => {
      const pos = (montage2D as Record<string, { x: number; y: number }>)[ch] || { x: 0.5, y: 0.5 };
      return {
        x: pos.x * res,
        y: pos.y * res,
      };
    });

    // Precalculate IDW weights lookup matrix for pixels inside the head circle
    const radius = res * 0.42;
    const cx = res * 0.5;
    const cy = res * 0.5;

    const insidePixelOffsets: number[] = [];
    const insideWeightsList: number[] = [];
    const insideScaleFactors: number[] = [];

    for (let py = 0; py < res; py++) {
      for (let px = 0; px < res; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);

        if (distFromCenter <= radius) {
          const pixelIdx = (py * res + px) * 4;
          insidePixelOffsets.push(pixelIdx);

          let sumW = 0;
          const weights: number[] = new Array(CHANNELS.length);
          for (let i = 0; i < CHANNELS.length; i++) {
            const ep = elecPixels[i];
            const d2 = (px - ep.x) * (px - ep.x) + (py - ep.y) * (py - ep.y);
            const w = 1 / (d2 + 18);
            weights[i] = w;
            sumW += w;
          }

          // Normalized weights so sum = 1
          const invSumW = sumW > 0 ? 1 / sumW : 0;
          for (let i = 0; i < CHANNELS.length; i++) {
            insideWeightsList.push(weights[i] * invSumW);
          }

          // Precompute alpha scaling factor: edge falloff * max opacity (178) / 0.45
          const edgeFalloff = Math.max(0, 1 - Math.pow(distFromCenter / radius, 4));
          insideScaleFactors.push((178 * edgeFalloff) / 0.45);
        }
      }
    }

    const numInside = insidePixelOffsets.length;
    const pixelIndices = new Int32Array(insidePixelOffsets);
    const weightsMatrix = new Float32Array(insideWeightsList);
    const alphaScales = new Float32Array(insideScaleFactors);

    const render = () => {
      // 1. Update smoothed ERD strengths with exponential moving average
      const currentMu = useHaloStore.getState().latestFrame?.bandpower?.mu ?? [];
      const smoothed = smoothedStrengthsRef.current;

      for (let i = 0; i < CHANNELS.length; i++) {
        const muRatio = currentMu[i] ?? 1.0;
        const targetStrength = Math.max(0, Math.min(0.6, 1.0 - muRatio));
        // Smooth transition alpha = 0.18
        smoothed[i] += (targetStrength - smoothed[i]) * 0.18;
      }

      // 2. High-performance IDW rasterization using precomputed lookup matrix
      for (let p = 0; p < numInside; p++) {
        const pIdx = pixelIndices[p];
        const wBase = p * 22;

        let rawIntensity = 0;
        for (let i = 0; i < 22; i++) {
          rawIntensity += weightsMatrix[wBase + i] * smoothed[i];
        }

        // Alpha scales with normalized intensity, max 178 (~70% white)
        const alpha = Math.min(178, Math.max(0, Math.round(rawIntensity * alphaScales[p])));
        data[pIdx + 3] = alpha;
      }

      ctx.putImageData(imgData, 0, 0);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <GlassPanel
      variant="default"
      className={cn(
        "relative flex flex-col justify-between p-4 bg-[#0D0F12]/85 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <SectionLabel icon={<Brain className="w-3.5 h-3.5 text-muted" />}>
          Sensorimotor Topomap
        </SectionLabel>
        <span className="text-[10.5px] font-mono text-muted/70">
          μ-Band ERD
        </span>
      </div>

      {/* Main Top-Down Head Diagram (220px) */}
      <div className="relative w-[220px] h-[220px] mx-auto my-auto select-none">
        {/* Soft IDW Heatmap Canvas clipped to head */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full rounded-full pointer-events-none z-0"
        />

        {/* Clean SVG Head Outline & Electrodes */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full overflow-visible z-10 pointer-events-none"
        >
          {/* Subtle Left & Right Ears */}
          <path
            d="M 6.5 44 C 3 44 3 56 6.5 56"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <path
            d="M 93.5 44 C 97 44 97 56 93.5 56"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.25"
            strokeLinecap="round"
          />

          {/* Nose triangle at top */}
          <path
            d="M 45 7.5 L 50 1.5 L 55 7.5"
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />

          {/* Head circular boundary */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1.25"
          />

          {/* 22 Electrodes from montage_2d.json */}
          {CHANNELS.map((ch) => {
            const pos = (montage2D as Record<string, { x: number; y: number }>)[ch] || { x: 0.5, y: 0.5 };
            const cx = pos.x * 100;
            const cy = pos.y * 100;

            const isC3 = ch === "C3";
            const isC4 = ch === "C4";
            const isCz = ch === "Cz";

            return (
              <g key={ch}>
                {/* Electrode dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isC3 || isC4 ? 2.8 : 1.4}
                  fill={isC3 ? "#4CC9F0" : isC4 ? "#FFB547" : "rgba(255, 255, 255, 0.75)"}
                  stroke={isC3 ? "#4CC9F0" : isC4 ? "#FFB547" : "rgba(255, 255, 255, 0.3)"}
                  strokeWidth={isC3 || isC4 ? "1.5" : "0.5"}
                />

                {/* Highlight labels for C3, Cz, C4 */}
                {(isC3 || isC4 || isCz) && (
                  <text
                    x={isC3 ? cx - 4 : isC4 ? cx + 4 : cx}
                    y={isCz ? cy - 3.5 : cy + 1}
                    textAnchor={isC3 ? "end" : isC4 ? "start" : "middle"}
                    fill={isC3 ? "#4CC9F0" : isC4 ? "#FFB547" : "rgba(255, 255, 255, 0.8)"}
                    fontSize="5"
                    fontFamily="Geist Mono, monospace"
                    fontWeight="bold"
                  >
                    {ch}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Scientific Neurophysiology Caption */}
      <div className="text-[10px] text-muted/80 text-center px-2 mb-2 italic select-none">
        Imagining the left hand dims the right motor cortex (C4); the right hand dims C3.
      </div>

      {/* Band Power Sparklines Footer */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
        {/* C3 Sparkline card */}
        <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="text-[#4CC9F0] font-bold">C3 (Left Cortex)</span>
            <span className="text-muted/60">μ-ratio</span>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <StatNumber
              value={c3Mu}
              decimals={2}
              size="sm"
              valueClassName="font-mono text-sm font-semibold text-text"
            />
            <span className="text-[9px] font-mono text-muted/60">
              {c3Mu < 0.9 ? "ERD" : c3Mu > 1.1 ? "ERS" : "Base"}
            </span>
          </div>
          <div className="h-6 w-full mt-1 overflow-hidden">
            <svg width="90" height="24" className="w-full h-full overflow-visible">
              <line x1="0" y1="12" x2="90" y2="12" stroke="rgba(255,255,255,0.1)" strokeDasharray="2,2" />
              {c3Sparkline && (
                <polyline
                  fill="none"
                  stroke="#4CC9F0"
                  strokeWidth="1.25"
                  points={c3Sparkline}
                />
              )}
            </svg>
          </div>
        </div>

        {/* C4 Sparkline card */}
        <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
            <span className="text-[#FFB547] font-bold">C4 (Right Cortex)</span>
            <span className="text-muted/60">μ-ratio</span>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <StatNumber
              value={c4Mu}
              decimals={2}
              size="sm"
              valueClassName="font-mono text-sm font-semibold text-text"
            />
            <span className="text-[9px] font-mono text-muted/60">
              {c4Mu < 0.9 ? "ERD" : c4Mu > 1.1 ? "ERS" : "Base"}
            </span>
          </div>
          <div className="h-6 w-full mt-1 overflow-hidden">
            <svg width="90" height="24" className="w-full h-full overflow-visible">
              <line x1="0" y1="12" x2="90" y2="12" stroke="rgba(255,255,255,0.1)" strokeDasharray="2,2" />
              {c4Sparkline && (
                <polyline
                  fill="none"
                  stroke="#FFB547"
                  strokeWidth="1.25"
                  points={c4Sparkline}
                />
              )}
            </svg>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
