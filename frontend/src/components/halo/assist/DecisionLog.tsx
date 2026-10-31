"use client";

import React from "react";
import { DecisionRecord, DecisionStats } from "@/lib/useDecisions";
import { GlassPanel } from "../GlassPanel";
import { SectionLabel } from "../Primitives";
import { StatNumber } from "../StatNumber";
import { Check, X, History, Trash2, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export interface DecisionLogProps {
  records: DecisionRecord[];
  stats: DecisionStats;
  onClear?: () => void;
  className?: string;
}

export function DecisionLog({
  records,
  stats,
  onClear,
  className,
}: DecisionLogProps) {
  return (
    <GlassPanel
      variant="default"
      className={cn(
        "flex flex-col p-4 bg-[#0D0F12]/85 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <SectionLabel icon={<History className="w-3.5 h-3.5 text-[#4CC9F0]" />}>
            Decision Log
          </SectionLabel>
          <span className="text-[11px] font-mono text-muted/70">
            ({records.length})
          </span>
        </div>

        {records.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="p-1 rounded-md text-muted/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Clear decision history"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live Stats Row */}
      <div className="grid grid-cols-3 gap-2 py-3 border-b border-white/5 text-center select-none">
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Accuracy
          </span>
          <StatNumber
            value={stats.accuracy}
            decimals={1}
            unit="%"
            size="sm"
            valueClassName="font-mono font-bold text-text text-sm"
          />
        </div>

        <div className="flex flex-col items-center border-x border-white/5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Decision Time
          </span>
          <StatNumber
            value={stats.avgDecisionMs}
            decimals={0}
            unit="ms"
            size="sm"
            valueClassName="font-mono font-bold text-text text-sm"
          />
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Throughput
          </span>
          <StatNumber
            value={stats.estCharsPerMin}
            decimals={1}
            unit="CPM"
            size="sm"
            valueClassName="font-mono font-bold text-[#4CC9F0] text-sm"
          />
        </div>
      </div>

      {/* Decision List (Newest on Top) */}
      <div className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 scrollbar-thin scrollbar-thumb-white/10">
        {records.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center text-muted/60 select-none">
            <Cpu className="w-6 h-6 mb-2 opacity-40 text-[#4CC9F0]" />
            <p className="text-xs font-mono">No decisions actuated yet</p>
            <p className="text-[10.5px] text-muted/40 max-w-[200px] mt-0.5">
              Decisions fire automatically when confidence sustains over dwell threshold.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {records.map((rec) => {
              const isLeft = rec.decided === "left";
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-xl border text-xs font-mono transition-all",
                    rec.correct
                      ? "bg-white/[0.02] border-white/5 hover:border-white/10"
                      : "bg-rose-500/[0.04] border-rose-500/20"
                  )}
                >
                  {/* Left: Decision Badge & Verification */}
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0 shadow-sm",
                        isLeft
                          ? "bg-[#4CC9F0] shadow-[0_0_6px_#4CC9F0]"
                          : "bg-[#FFB547] shadow-[0_0_6px_#FFB547]"
                      )}
                    />
                    <span
                      className={cn(
                        "font-bold uppercase tracking-wider text-[11px]",
                        isLeft ? "text-[#4CC9F0]" : "text-[#FFB547]"
                      )}
                    >
                      {rec.decided}
                    </span>

                    {/* Intended match status */}
                    {rec.intended !== null ? (
                      <span className="flex items-center gap-1 text-[10px]">
                        {rec.correct ? (
                          <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>match</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-500/20">
                            <X className="w-3 h-3 stroke-[3]" />
                            <span>wanted {rec.intended}</span>
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted/60">manual</span>
                    )}
                  </div>

                  {/* Right: Recording ID & Elapsed Dwell Time */}
                  <div className="flex items-center gap-2 text-[10px] text-muted/70">
                    <span
                      className="max-w-[90px] truncate font-mono text-[9.5px] text-muted/50"
                      title={rec.trial_id}
                    >
                      {rec.trial_id.split("_").slice(-2).join("_")}
                    </span>
                    <span className="font-semibold text-text tabular-nums">
                      {rec.decision_ms} ms
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </GlassPanel>
  );
}
