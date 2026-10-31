"use client";

import React from "react";
import { GlassPanel } from "../GlassPanel";
import { SectionLabel, Pill } from "../Primitives";
import { BenchmarkMetrics } from "@/lib/metrics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";
import { Users, X } from "lucide-react";

interface SubjectAccuracyChartProps {
  metrics: BenchmarkMetrics;
  selectedModel: string;
  selectedSubject: number | null;
  onSelectSubject: (subject: number | null) => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomBarTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl bg-[#0D0F12]/95 backdrop-blur-xl border border-white/10 p-3 shadow-2xl font-mono text-xs z-50">
        <div className="text-text font-semibold mb-2 flex items-center justify-between border-b border-white/10 pb-1">
          <span>{label}</span>
          <span className="text-[10px] text-muted font-normal">Held-Out Test</span>
        </div>
        <div className="space-y-1.5">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted text-[11px]">{entry.name}:</span>
              </div>
              <span className="font-bold text-text tabular-nums">
                {entry.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-1 border-t border-white/5 text-[10px] text-muted">
          Click bar or chip to filter confusion matrix
        </div>
      </div>
    );
  }
  return null;
}

export function SubjectAccuracyChart({
  metrics,
  selectedModel,
  selectedSubject,
  onSelectSubject,
}: SubjectAccuracyChartProps) {
  // Build data points for each subject
  const data = metrics.subjects_evaluated.map((sub) => {
    const subStr = String(sub);
    const cspMetrics = metrics.subjects[subStr]?.csp_lda;
    const eegnetMetrics = metrics.subjects[subStr]?.eegnet;

    const cspAcc = cspMetrics ? cspMetrics.trial_accuracy * 100 : 0;
    const eegnetAcc = eegnetMetrics ? eegnetMetrics.trial_accuracy * 100 : 0;

    return {
      subject: `S${sub}`,
      subId: sub,
      "CSP + LDA": cspAcc,
      EEGNet: eegnetAcc,
    };
  });

  const activeSummary = metrics.summary[selectedModel] || metrics.summary.csp_lda;
  const activeMeanAcc = activeSummary ? activeSummary.mean_trial_accuracy * 100 : 90.2;
  const isCsp = selectedModel === "csp_lda";

  return (
    <GlassPanel variant="default" className="p-6 flex flex-col justify-between h-full border-white/10">
      <div>
        {/* Chart Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SectionLabel icon={<Users className="w-3.5 h-3.5 text-cyan-400" />}>
                Cross-Subject Generalization
              </SectionLabel>
              {selectedSubject !== null ? (
                <button
                  type="button"
                  onClick={() => onSelectSubject(null)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all shadow-sm"
                >
                  <span>Filtered: Subject {selectedSubject}</span>
                  <X className="w-3 h-3" />
                </button>
              ) : (
                <Pill variant="muted" size="sm" className="font-mono text-[10px]">
                  All 9 Subjects
                </Pill>
              )}
            </div>
            <h3 className="text-base font-semibold text-text tracking-tight">
              Per-Subject Trial Accuracy
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Click any participant to drill down into confusion matrix &amp; class performance
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#4CC9F0]" />
              <span className="text-muted">CSP + LDA</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#FFB547]" />
              <span className="text-muted">EEGNet</span>
            </div>
          </div>
        </div>

        {/* Quick Subject Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap my-2.5 pt-1">
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider mr-1">
            Filter:
          </span>
          <button
            type="button"
            onClick={() => onSelectSubject(null)}
            className={`px-2 py-0.5 rounded-full text-xs font-mono transition-all ${
              selectedSubject === null
                ? "bg-white/20 text-white font-bold shadow-sm"
                : "text-muted hover:text-text hover:bg-white/5"
            }`}
          >
            All
          </button>
          {metrics.subjects_evaluated.map((sub) => {
            const isSelected = selectedSubject === sub;
            return (
              <button
                key={sub}
                type="button"
                onClick={() => onSelectSubject(isSelected ? null : sub)}
                className={`w-6 h-6 rounded-full text-xs font-mono transition-all flex items-center justify-center ${
                  isSelected
                    ? "bg-[#4CC9F0] text-[#07080A] font-bold shadow-[0_0_8px_rgba(76,201,240,0.6)]"
                    : "text-muted hover:text-text hover:bg-white/10"
                }`}
              >
                {sub}
              </button>
            );
          })}
        </div>

        {/* Chart Canvas */}
        <div className="w-full h-64 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
              barCategoryGap={16}
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="subject"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8A919C", fontSize: 11, fontFamily: "monospace" }}
              />
              <YAxis
                domain={[40, 100]}
                ticks={[50, 60, 70, 80, 90, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8A919C", fontSize: 10, fontFamily: "monospace" }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={<CustomBarTooltip />}
                cursor={{ fill: "rgba(255, 255, 255, 0.03)" }}
              />

              {/* Chance level at 50% */}
              <ReferenceLine
                y={50}
                stroke="rgba(255, 255, 255, 0.25)"
                strokeDasharray="4 4"
                label={{
                  value: "Chance 50%",
                  fill: "rgba(255, 255, 255, 0.4)",
                  fontSize: 9,
                  fontFamily: "monospace",
                  position: "insideBottomRight",
                  offset: 5,
                }}
              />

              {/* Active Model Mean Accuracy line */}
              <ReferenceLine
                y={activeMeanAcc}
                stroke={isCsp ? "#4CC9F0" : "#FFB547"}
                strokeDasharray="3 3"
                strokeOpacity={0.6}
                label={{
                  value: `Mean ${activeMeanAcc.toFixed(1)}%`,
                  fill: isCsp ? "#4CC9F0" : "#FFB547",
                  fontSize: 9,
                  fontFamily: "monospace",
                  position: "insideTopRight",
                  offset: -5,
                }}
              />

              {/* CSP + LDA Bar */}
              <Bar
                dataKey="CSP + LDA"
                name="CSP + LDA"
                fill="#4CC9F0"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                onClick={(entry) => {
                  const item = entry as unknown as { subId?: number; payload?: { subId?: number } };
                  const sub = item?.payload?.subId ?? item?.subId;
                  if (sub !== undefined) {
                    onSelectSubject(selectedSubject === sub ? null : sub);
                  }
                }}
                className="cursor-pointer transition-opacity"
              >
                {data.map((entry) => {
                  const isSelected = selectedSubject === entry.subId;
                  const isDimmed = selectedSubject !== null && !isSelected;
                  return (
                    <Cell
                      key={`csp-cell-${entry.subId}`}
                      fill="#4CC9F0"
                      opacity={isDimmed ? 0.25 : 1.0}
                      stroke={isSelected ? "#FFFFFF" : "transparent"}
                      strokeWidth={isSelected ? 1.5 : 0}
                    />
                  );
                })}
              </Bar>

              {/* EEGNet Bar */}
              <Bar
                dataKey="EEGNet"
                name="EEGNet"
                fill="#FFB547"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                onClick={(entry) => {
                  const item = entry as unknown as { subId?: number; payload?: { subId?: number } };
                  const sub = item?.payload?.subId ?? item?.subId;
                  if (sub !== undefined) {
                    onSelectSubject(selectedSubject === sub ? null : sub);
                  }
                }}
                className="cursor-pointer transition-opacity"
              >
                {data.map((entry) => {
                  const isSelected = selectedSubject === entry.subId;
                  const isDimmed = selectedSubject !== null && !isSelected;
                  return (
                    <Cell
                      key={`eegnet-cell-${entry.subId}`}
                      fill="#FFB547"
                      opacity={isDimmed ? 0.25 : 1.0}
                      stroke={isSelected ? "#FFFFFF" : "transparent"}
                      strokeWidth={isSelected ? 1.5 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-[11px] font-mono text-muted">
        <span>Model comparison across 144 trials/subject</span>
        <span>BCI IV-2a held-out test session</span>
      </div>
    </GlassPanel>
  );
}
