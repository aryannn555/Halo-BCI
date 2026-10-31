"use client";

import React from "react";
import { GlassPanel } from "../GlassPanel";
import { StatNumber } from "../StatNumber";
import { SectionLabel, Pill } from "../Primitives";
import { BenchmarkMetrics } from "@/lib/metrics";
import { Zap, Activity, Clock, ShieldCheck, Gauge, Cpu } from "lucide-react";

interface HeadlineHeroProps {
  metrics: BenchmarkMetrics;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export function HeadlineHero({
  metrics,
  selectedModel,
  onSelectModel,
}: HeadlineHeroProps) {
  const summary = metrics.summary[selectedModel] || metrics.summary.csp_lda;

  const meanTrialAcc = summary ? summary.mean_trial_accuracy * 100 : 90.2;
  const stdTrialAcc = summary ? summary.std_trial_accuracy * 100 : 15.6;
  const meanKappa = summary ? summary.mean_kappa : 0.804;
  const stdKappa = summary ? summary.std_kappa : 0.311;
  const meanF1 = summary ? summary.mean_macro_f1 * 100 : 89.7;
  const meanItr = summary ? summary.mean_itr_bits_per_min : 10.91;
  const medianLatency = summary ? summary.median_latency_ms : 0.41;
  const p95Latency = summary ? summary.p95_latency_ms : 0.48;

  const isCsp = selectedModel === "csp_lda";

  return (
    <GlassPanel variant="hero" className="p-6 sm:p-8 overflow-hidden relative border-white/10">
      {/* Background radial glow */}
      <div
        className={`absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700 ${
          isCsp ? "bg-[#4CC9F0]" : "bg-[#FFB547]"
        }`}
      />

      <div className="relative z-10 flex flex-col gap-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <SectionLabel icon={<ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />}>
              Gold Standard Evaluation
            </SectionLabel>
            <Pill variant="glass" size="sm" className="font-mono text-[10px]">
              Held-Out Session 2 Test
            </Pill>
            <Pill variant={isCsp ? "cyan" : "amber"} size="sm" className="font-mono text-[10px]">
              9 Subjects
            </Pill>
          </div>

          {/* Model Switcher Segmented Control */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted select-none">
              Architecture:
            </span>
            <div className="inline-flex rounded-full bg-white/[0.04] p-1 border border-white/10 shadow-inner">
              <button
                type="button"
                onClick={() => onSelectModel("csp_lda")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono transition-all duration-200 ${
                  isCsp
                    ? "bg-[#4CC9F0] text-[#07080A] font-bold shadow-[0_0_12px_rgba(76,201,240,0.5)]"
                    : "text-muted hover:text-text hover:bg-white/5"
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>CSP + LDA</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectModel("eegnet")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-mono transition-all duration-200 ${
                  !isCsp
                    ? "bg-[#FFB547] text-[#07080A] font-bold shadow-[0_0_12px_rgba(255,181,71,0.5)]"
                    : "text-muted hover:text-text hover:bg-white/5"
                }`}
              >
                <Cpu className="w-3 h-3" />
                <span>EEGNet (CNN)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Stat & Secondary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Headline Stat (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-white/10 pb-6 lg:pb-0 lg:pr-8">
            <span className="text-xs font-mono uppercase tracking-wider text-muted mb-1 flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isCsp ? "bg-[#4CC9F0] shadow-[0_0_8px_#4CC9F0]" : "bg-[#FFB547] shadow-[0_0_8px_#FFB547]"
                }`}
              />
              Mean Trial-Level Accuracy
            </span>

            <div className="flex items-baseline gap-2">
              <StatNumber
                value={meanTrialAcc}
                decimals={1}
                unit="%"
                size="xl"
                valueClassName={isCsp ? "text-[#4CC9F0]" : "text-[#FFB547]"}
              />
              <span className="text-base sm:text-lg font-mono text-muted/70 tracking-tight">
                ± {stdTrialAcc.toFixed(1)}%
              </span>
            </div>

            <p className="text-xs text-muted/80 mt-2 font-mono">
              chance = 50.0%, held-out session, per-subject models
            </p>
          </div>

          {/* Secondary Stats Grid (7 cols) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Cohen's Kappa */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-1.5 text-muted mb-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider">Cohen&apos;s Kappa</span>
              </div>
              <StatNumber
                value={meanKappa}
                decimals={3}
                size="md"
                valueClassName="text-text"
              />
              <span className="text-[10px] text-muted font-mono mt-0.5 block">
                ± {stdKappa.toFixed(3)}
              </span>
            </div>

            {/* Macro F1 */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-1.5 text-muted mb-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider">Macro F1</span>
              </div>
              <StatNumber
                value={meanF1}
                decimals={1}
                unit="%"
                size="md"
                valueClassName="text-emerald-400"
              />
              <span className="text-[10px] text-muted font-mono mt-0.5 block">
                Balanced Classes
              </span>
            </div>

            {/* Wolpaw ITR */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-1.5 text-muted mb-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider">Bitrate (ITR)</span>
              </div>
              <StatNumber
                value={meanItr}
                decimals={2}
                unit="bpm"
                size="md"
                valueClassName="text-amber-400"
              />
              <span className="text-[10px] text-muted font-mono mt-0.5 block">
                bits / min
              </span>
            </div>

            {/* Inference Latency */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-1.5 text-muted mb-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider">Inference</span>
              </div>
              <StatNumber
                value={medianLatency}
                decimals={2}
                unit="ms"
                size="md"
                valueClassName="text-purple-400"
              />
              <span className="text-[10px] text-muted font-mono mt-0.5 block">
                p95: {p95Latency.toFixed(2)} ms
              </span>
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
