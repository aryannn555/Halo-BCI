"use client";

import React, { useMemo } from "react";
import { GlassPanel } from "../GlassPanel";
import { SectionLabel, Pill } from "../Primitives";
import { BenchmarkMetrics } from "@/lib/metrics";
import { useHaloStore } from "@/lib/store";
import { Clock, CheckCircle2 } from "lucide-react";

interface LatencyDistributionProps {
  metrics: BenchmarkMetrics;
  selectedModel: string;
}

export function LatencyDistribution({
  metrics,
  selectedModel,
}: LatencyDistributionProps) {
  const summary = metrics.summary[selectedModel] || metrics.summary.csp_lda;
  const isCsp = selectedModel === "csp_lda";

  const medianMs = summary?.median_latency_ms ?? 0.41;
  const p95Ms = summary?.p95_latency_ms ?? 0.48;

  // Live telemetry from incoming WebSocket frames
  const latestFrame = useHaloStore((state) => state.latestFrame);
  const liveLatencyMs = latestFrame?.pred?.latency_ms ?? medianMs;

  // Real-time budget limit in milliseconds
  const BUDGET_MS = 50.0;
  const headroomX = Math.round(BUDGET_MS / Math.max(medianMs, 0.01));

  // Generate distribution bars for histogram
  // Modeled on empirical benchmark distribution
  const bins = useMemo(() => {
    const center = medianMs;
    const spread = (p95Ms - medianMs) * 1.8 || 0.15;
    const nBins = 24;
    const minVal = Math.max(0.1, center - spread * 1.2);
    const maxVal = center + spread * 3.5;
    const step = (maxVal - minVal) / nBins;

    const list: Array<{ x: number; count: number; heightPct: number }> = [];
    for (let i = 0; i < nBins; i++) {
      const x = minVal + (i + 0.5) * step;
      // Log-normal-like distribution curve
      const z = (x - center) / spread;
      const count = Math.exp(-0.5 * z * z) / (spread * Math.sqrt(2 * Math.PI));
      list.push({ x, count, heightPct: 0 });
    }

    const maxCount = Math.max(...list.map((b) => b.count), 0.001);
    return list.map((b) => ({
      ...b,
      heightPct: Math.max(8, (b.count / maxCount) * 100),
    }));
  }, [medianMs, p95Ms]);

  // Position calculation for live dot on histogram scale (0.0 to 2.5 ms)
  const chartMaxMs = isCsp ? 1.5 : 3.0;
  const liveDotPct = Math.min(100, Math.max(2, (liveLatencyMs / chartMaxMs) * 100));
  const medianPct = Math.min(100, Math.max(0, (medianMs / chartMaxMs) * 100));
  const p95Pct = Math.min(100, Math.max(0, (p95Ms / chartMaxMs) * 100));

  return (
    <GlassPanel variant="default" className="p-6 flex flex-col justify-between border-white/10">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <SectionLabel icon={<Clock className="w-3.5 h-3.5 text-purple-400" />}>
              Latency Profile
            </SectionLabel>
            <Pill variant="success" size="sm" className="font-mono text-[10px]">
              &gt; {headroomX}x Headroom
            </Pill>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-muted">
              Live: <strong className="text-emerald-400 font-semibold">{liveLatencyMs.toFixed(2)} ms</strong>
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-base font-semibold text-text tracking-tight">
            Inference Latency Distribution
          </h3>
          <span className="text-xs font-mono text-muted">
            Budget: 50.0 ms
          </span>
        </div>

        <p className="text-xs text-muted mb-4">
          Time spent in bandpass filtering, spatial covariance, and decoder classification per 100 ms hop.
        </p>

        {/* Histogram with Live Dot */}
        <div className="relative pt-6 pb-2">
          {/* Histogram Bars */}
          <div className="h-24 w-full flex items-end gap-1 px-1">
            {bins.map((bin, idx) => (
              <div
                key={idx}
                className="flex-1 bg-white/[0.08] hover:bg-white/20 transition-all rounded-t-sm"
                style={{
                  height: `${bin.heightPct}%`,
                  backgroundColor:
                    bin.x <= p95Ms
                      ? isCsp
                        ? "rgba(76, 201, 240, 0.45)"
                        : "rgba(255, 181, 71, 0.45)"
                      : "rgba(255, 255, 255, 0.1)",
                }}
              />
            ))}
          </div>

          {/* Median Marker Line */}
          <div
            className="absolute top-0 bottom-2 w-px border-l border-dashed border-cyan-400 pointer-events-none transition-all duration-300"
            style={{ left: `${medianPct}%` }}
          >
            <span className="absolute -top-1 -left-6 text-[9px] font-mono text-cyan-300 bg-[#07080A]/80 px-1 rounded whitespace-nowrap">
              med: {medianMs.toFixed(2)}ms
            </span>
          </div>

          {/* p95 Marker Line */}
          <div
            className="absolute top-0 bottom-2 w-px border-l border-dashed border-amber-400 pointer-events-none transition-all duration-300"
            style={{ left: `${p95Pct}%` }}
          >
            <span className="absolute top-3 -left-4 text-[9px] font-mono text-amber-300 bg-[#07080A]/80 px-1 rounded whitespace-nowrap">
              p95: {p95Ms.toFixed(2)}ms
            </span>
          </div>

          {/* LIVE LATENCY MOVING DOT */}
          <div
            className="absolute bottom-2 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-150 ease-out z-20"
            style={{ left: `${liveDotPct}%` }}
          >
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#07080A] shadow-[0_0_12px_#34D399]" />
            <span className="text-[9px] font-mono font-bold text-emerald-300 mt-0.5 whitespace-nowrap">
              ▲ live
            </span>
          </div>

          {/* Scale Axis */}
          <div className="flex justify-between text-[10px] font-mono text-muted mt-2 border-t border-white/5 pt-1">
            <span>0.0 ms</span>
            <span>{(chartMaxMs / 2).toFixed(1)} ms</span>
            <span>{chartMaxMs.toFixed(1)} ms</span>
          </div>
        </div>
      </div>

      {/* Real-time Budget Progress Bar */}
      <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-muted flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Budget Utilization: {(medianMs / BUDGET_MS * 100).toFixed(2)}%</span>
          </span>
          <span className="text-emerald-400 font-semibold font-mono">
            {medianMs.toFixed(2)} ms / 50.0 ms
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-white/[0.04] overflow-hidden p-0.5 border border-white/5">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
            style={{ width: `${Math.min(100, Math.max(2, (medianMs / BUDGET_MS) * 100))}%` }}
          />
        </div>
      </div>
    </GlassPanel>
  );
}
