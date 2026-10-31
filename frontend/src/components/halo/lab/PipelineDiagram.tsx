"use client";

import React, { useEffect, useState } from "react";
import { GlassPanel } from "../GlassPanel";
import { SectionLabel, Pill } from "../Primitives";
import { useHaloStore } from "@/lib/store";
import {
  Activity,
  Filter,
  Layers,
  Cpu,
  TrendingUp,
  Target,
  Send,
  ChevronRight,
} from "lucide-react";

interface PipelineDiagramProps {
  selectedModel: string;
}

export function PipelineDiagram({ selectedModel }: PipelineDiagramProps) {
  const latestFrame = useHaloStore((state) => state.latestFrame);
  const isCsp = selectedModel === "csp_lda";

  // Pulse state triggered by incoming WebSocket frames
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    if (!latestFrame) return;
    // Advance pulse step sequentially across the 7 pipeline stages
    setPulseIndex((prev) => (prev + 1) % 7);
  }, [latestFrame]);

  const stages = [
    {
      id: "raw",
      title: "Raw EEG",
      subtitle: "22 ch, 250 Hz",
      detail: "22 Ag/AgCl channels, 250 Hz, μV scale",
      icon: Activity,
      color: "#4CC9F0",
    },
    {
      id: "filter",
      title: "Bandpass",
      subtitle: "8–30 Hz SOS",
      detail: "4th-order Butterworth SOS, filtfilt",
      icon: Filter,
      color: "#38BDF8",
    },
    {
      id: "window",
      title: "2 s Window",
      subtitle: "500 samples",
      detail: "100 ms hop (25 samples), ring buffer",
      icon: Layers,
      color: "#818CF8",
    },
    {
      id: "decoder",
      title: "Decoder",
      subtitle: isCsp ? "CSP + LDA" : "EEGNet (CNN)",
      detail: isCsp
        ? "6 spatial filters + shrinkage LDA"
        : "Depthwise/separable 2D convolutions",
      icon: Cpu,
      color: isCsp ? "#4CC9F0" : "#FFB547",
    },
    {
      id: "smooth",
      title: "Smoothing",
      subtitle: "EMA Filter",
      detail: "Exponential moving average & gate",
      icon: TrendingUp,
      color: "#A78BFA",
    },
    {
      id: "intent",
      title: "Intent Dwell",
      subtitle: "600 ms @ >0.65",
      detail: "Confidence accumulator threshold",
      icon: Target,
      color: "#F472B6",
    },
    {
      id: "interface",
      title: "Interface",
      subtitle: "Assist & Live",
      detail: "Tactile binary control (Huffman, Wheelchair)",
      icon: Send,
      color: "#34D399",
    },
  ];

  return (
    <GlassPanel variant="default" className="p-6 border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SectionLabel icon={<Layers className="w-3.5 h-3.5 text-cyan-400" />}>
              Architecture
            </SectionLabel>
            <Pill variant="glass" size="sm" className="font-mono text-[10px]">
              End-to-End Latency &lt; 2 ms
            </Pill>
          </div>
          <h3 className="text-base font-semibold text-text tracking-tight">
            Real-Time Neural Processing Pipeline
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Synchronous 100 ms streaming flow with zero frame dropping and constant memory ring buffering
          </p>
        </div>

        {/* Live sync pulse indicator */}
        <div className="flex items-center gap-2 text-xs font-mono text-muted">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Frame Synced (10 Hz)</span>
        </div>
      </div>

      {/* Pipeline Flow Container */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-[920px] py-2">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isPulsing = pulseIndex === idx;

            return (
              <React.Fragment key={stage.id}>
                {/* Stage Node Box */}
                <div
                  className={`flex-1 rounded-2xl p-3.5 border transition-all duration-300 relative flex flex-col justify-between ${
                    isPulsing
                      ? "bg-white/[0.08] border-white/30 shadow-[0_0_16px_rgba(255,255,255,0.15)] scale-[1.02]"
                      : "bg-white/[0.02] border-white/5 hover:border-white/10"
                  }`}
                >
                  {/* Top: Icon & Indicator */}
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="p-1.5 rounded-lg border"
                      style={{
                        backgroundColor: `${stage.color}15`,
                        borderColor: `${stage.color}30`,
                        color: stage.color,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <span className="text-[10px] font-mono text-muted">
                      0{idx + 1}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div>
                    <h4 className="text-xs font-semibold text-text truncate">
                      {stage.title}
                    </h4>
                    <p
                      className="text-[11px] font-mono font-medium truncate"
                      style={{ color: stage.color }}
                    >
                      {stage.subtitle}
                    </p>
                  </div>

                  {/* Technical detail */}
                  <p className="text-[10px] text-muted/80 leading-tight mt-2 border-t border-white/5 pt-1.5 font-sans line-clamp-2">
                    {stage.detail}
                  </p>
                </div>

                {/* Arrow Connector */}
                {idx < stages.length - 1 && (
                  <div className="flex items-center justify-center px-0.5 text-muted/40">
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-colors duration-200 ${
                        pulseIndex === idx ? "text-cyan-400" : "text-white/20"
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
}
