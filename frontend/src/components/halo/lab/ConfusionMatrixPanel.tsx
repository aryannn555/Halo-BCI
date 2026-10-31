"use client";

import React from "react";
import { GlassPanel } from "../GlassPanel";
import { SectionLabel, Pill } from "../Primitives";
import {
  BenchmarkMetrics,
  getConfusionMatrix,
  getClassMetrics,
} from "@/lib/metrics";
import { Grid, ArrowLeft, ArrowRight } from "lucide-react";

interface ConfusionMatrixPanelProps {
  metrics: BenchmarkMetrics;
  selectedModel: string;
  selectedSubject: number | null;
  onResetSubject?: () => void;
}

export function ConfusionMatrixPanel({
  metrics,
  selectedModel,
  selectedSubject,
  onResetSubject,
}: ConfusionMatrixPanelProps) {
  const cm = getConfusionMatrix(metrics, selectedModel, selectedSubject);
  const classMetrics = getClassMetrics(metrics, selectedModel, selectedSubject);

  const [[tn, fp], [fn, tp]] = cm;
  const actualLeftTotal = tn + fp || 1;
  const actualRightTotal = fn + tp || 1;
  const totalTrials = actualLeftTotal + actualRightTotal;

  const pctTN = (tn / actualLeftTotal) * 100;
  const pctFP = (fp / actualLeftTotal) * 100;
  const pctFN = (fn / actualRightTotal) * 100;
  const pctTP = (tp / actualRightTotal) * 100;

  return (
    <GlassPanel variant="default" className="p-6 flex flex-col justify-between h-full border-white/10">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SectionLabel icon={<Grid className="w-3.5 h-3.5 text-cyan-400" />}>
                Discrimination
              </SectionLabel>
              {selectedSubject !== null ? (
                <Pill variant="cyan" size="sm" className="font-mono text-[10px]">
                  Subject {selectedSubject} ({totalTrials} trials)
                </Pill>
              ) : (
                <Pill variant="muted" size="sm" className="font-mono text-[10px]">
                  All 9 Subjects ({totalTrials} trials)
                </Pill>
              )}
            </div>
            <h3 className="text-base font-semibold text-text tracking-tight">
              Confusion Matrix &amp; Precision / Recall
            </h3>
          </div>

          {selectedSubject !== null && onResetSubject && (
            <button
              type="button"
              onClick={onResetSubject}
              className="text-xs text-muted hover:text-cyan-400 font-mono underline transition-colors"
            >
              Reset filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Custom 2x2 Matrix (7 cols) */}
          <div className="md:col-span-7 flex flex-col gap-2">
            {/* Column Headers (Predicted) */}
            <div className="grid grid-cols-[84px_1fr_1fr] items-center text-center text-[11px] font-mono">
              <div className="text-muted/60 uppercase text-[9px] text-left pl-1">Actual ↓</div>
              <div className="text-cyan-400 font-medium flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" />
                <span>Pred Left</span>
              </div>
              <div className="text-amber-400 font-medium flex items-center justify-center gap-1">
                <span>Pred Right</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* Row 0: Actual Left Hand */}
            <div className="grid grid-cols-[84px_1fr_1fr] gap-2 items-center font-mono">
              <div className="text-[11px] font-medium text-cyan-400 pl-1 flex items-center gap-1">
                <ArrowLeft className="w-3 h-3 shrink-0" />
                <span>Left</span>
              </div>

              {/* True Left (TN) */}
              <div
                className="p-3.5 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden"
                style={{
                  backgroundColor: `rgba(76, 201, 240, ${0.12 + (pctTN / 100) * 0.28})`,
                  borderColor: `rgba(76, 201, 240, ${0.3 + (pctTN / 100) * 0.5})`,
                }}
              >
                <span className="text-xl font-bold text-text tabular-nums">
                  {pctTN.toFixed(1)}%
                </span>
                <span className="text-[11px] text-cyan-300/80 font-mono">
                  {tn} / {actualLeftTotal}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-cyan-400/70 font-sans mt-0.5">
                  True Left
                </span>
              </div>

              {/* False Right (FP) */}
              <div
                className="p-3.5 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden"
                style={{
                  backgroundColor: `rgba(255, 181, 71, ${0.04 + (pctFP / 100) * 0.2})`,
                  borderColor: `rgba(255, 181, 71, ${0.1 + (pctFP / 100) * 0.3})`,
                }}
              >
                <span className="text-xl font-bold text-text/80 tabular-nums">
                  {pctFP.toFixed(1)}%
                </span>
                <span className="text-[11px] text-amber-300/60 font-mono">
                  {fp} / {actualLeftTotal}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted font-sans mt-0.5">
                  False Right
                </span>
              </div>
            </div>

            {/* Row 1: Actual Right Hand */}
            <div className="grid grid-cols-[84px_1fr_1fr] gap-2 items-center font-mono">
              <div className="text-[11px] font-medium text-amber-400 pl-1 flex items-center gap-1">
                <ArrowRight className="w-3 h-3 shrink-0" />
                <span>Right</span>
              </div>

              {/* False Left (FN) */}
              <div
                className="p-3.5 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden"
                style={{
                  backgroundColor: `rgba(76, 201, 240, ${0.04 + (pctFN / 100) * 0.2})`,
                  borderColor: `rgba(76, 201, 240, ${0.1 + (pctFN / 100) * 0.3})`,
                }}
              >
                <span className="text-xl font-bold text-text/80 tabular-nums">
                  {pctFN.toFixed(1)}%
                </span>
                <span className="text-[11px] text-cyan-300/60 font-mono">
                  {fn} / {actualRightTotal}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted font-sans mt-0.5">
                  False Left
                </span>
              </div>

              {/* True Right (TP) */}
              <div
                className="p-3.5 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden"
                style={{
                  backgroundColor: `rgba(255, 181, 71, ${0.12 + (pctTP / 100) * 0.28})`,
                  borderColor: `rgba(255, 181, 71, ${0.3 + (pctTP / 100) * 0.5})`,
                }}
              >
                <span className="text-xl font-bold text-text tabular-nums">
                  {pctTP.toFixed(1)}%
                </span>
                <span className="text-[11px] text-amber-300/80 font-mono">
                  {tp} / {actualRightTotal}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-amber-400/70 font-sans mt-0.5">
                  True Right
                </span>
              </div>
            </div>
          </div>

          {/* Compact PR & F1 Bars (5 cols) */}
          <div className="md:col-span-5 flex flex-col gap-4 pl-0 md:pl-2 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0">
            {/* Left Hand Metric Bars */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#4CC9F0]" />
                  Left Imagery
                </span>
                <span className="text-muted text-[11px]">
                  F1: {(classMetrics.left_hand.f1 * 100).toFixed(1)}%
                </span>
              </div>

              {/* Precision bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-muted">
                  <span>Precision</span>
                  <span className="text-text tabular-nums font-semibold">
                    {(classMetrics.left_hand.precision * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4CC9F0] rounded-full transition-all duration-500"
                    style={{ width: `${classMetrics.left_hand.precision * 100}%` }}
                  />
                </div>
              </div>

              {/* Recall bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-muted">
                  <span>Recall</span>
                  <span className="text-text tabular-nums font-semibold">
                    {(classMetrics.left_hand.recall * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4CC9F0]/80 rounded-full transition-all duration-500"
                    style={{ width: `${classMetrics.left_hand.recall * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right Hand Metric Bars */}
            <div className="space-y-2 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FFB547]" />
                  Right Imagery
                </span>
                <span className="text-muted text-[11px]">
                  F1: {(classMetrics.right_hand.f1 * 100).toFixed(1)}%
                </span>
              </div>

              {/* Precision bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-muted">
                  <span>Precision</span>
                  <span className="text-text tabular-nums font-semibold">
                    {(classMetrics.right_hand.precision * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FFB547] rounded-full transition-all duration-500"
                    style={{ width: `${classMetrics.right_hand.precision * 100}%` }}
                  />
                </div>
              </div>

              {/* Recall bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-muted">
                  <span>Recall</span>
                  <span className="text-text tabular-nums font-semibold">
                    {(classMetrics.right_hand.recall * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FFB547]/80 rounded-full transition-all duration-500"
                    style={{ width: `${classMetrics.right_hand.recall * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-[11px] font-mono text-muted">
        <span>Row-normalised classification matrix</span>
        <span>Accuracy: {(((tn + tp) / totalTrials) * 100).toFixed(1)}%</span>
      </div>
    </GlassPanel>
  );
}
