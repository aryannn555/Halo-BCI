"use client";

import React from "react";
import { GlassPanel } from "./GlassPanel";
import { SectionLabel } from "./Primitives";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActivityDistributionCard({ className }: { className?: string }) {
  const segments = [
    { label: "Left Imagery", color: "bg-[#4CC9F0]", width: "35%", trials: "50 trials", text: "text-[#4CC9F0]" },
    { label: "Right Imagery", color: "bg-[#FFB547]", width: "38%", trials: "54 trials", text: "text-[#FFB547]" },
    { label: "Rest Gap", color: "bg-emerald-400", width: "15%", trials: "22 trials", text: "text-emerald-400" },
    { label: "Artifact / Gap", color: "bg-purple-400", width: "12%", trials: "18 trials", text: "text-purple-400" },
  ];

  return (
    <GlassPanel
      variant="default"
      className={cn(
        "p-5 bg-[#0D0F12]/80 backdrop-blur-2xl border-white/10 flex flex-col justify-between",
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <SectionLabel icon={<BarChart3 className="w-3.5 h-3.5 text-[#FFB547]" />}>
          Session Epoch Breakdown
        </SectionLabel>
        <span className="text-[11px] font-mono text-muted/80">144 Trials • Session 1T</span>
      </div>

      {/* Segmented Bar Visualization */}
      <div className="space-y-3 my-auto">
        <div className="h-9 w-full rounded-2xl bg-white/[0.04] p-1 flex gap-1.5 border border-white/10 overflow-hidden shadow-inner">
          {segments.map((seg, idx) => (
            <div
              key={idx}
              style={{ width: seg.width }}
              className={cn("h-full rounded-xl transition-all relative group flex items-center justify-center", seg.color)}
            >
              <span className="text-[10px] font-mono font-bold text-black/75 truncate px-1">
                {seg.width}
              </span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {segments.map((seg, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={cn("w-2 h-2 rounded-full shrink-0", seg.color)} />
                <span className="text-muted truncate">{seg.label}</span>
              </div>
              <span className="text-[10px] font-mono text-text/80 pl-3.5">
                {seg.trials}
              </span>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}
