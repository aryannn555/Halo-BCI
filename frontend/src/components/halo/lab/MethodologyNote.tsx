"use client";

import React, { useState } from "react";
import { GlassPanel } from "../GlassPanel";
import { Pill } from "../Primitives";
import { BenchmarkMetrics } from "@/lib/metrics";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  ChevronDown,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Database,
  Calendar,
  Layers,
} from "lucide-react";

interface MethodologyNoteProps {
  metrics: BenchmarkMetrics;
  selectedModel: string;
}

export function MethodologyNote({
  metrics,
  selectedModel,
}: MethodologyNoteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const summary = metrics.summary[selectedModel] || metrics.summary.csp_lda;
  const isCsp = selectedModel === "csp_lda";

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(metrics, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `halo_bci_metrics_${selectedModel}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopySummary = () => {
    const text = `Halo BCI Benchmark Summary (${isCsp ? "CSP + LDA" : "EEGNet"}):
• Mean Trial Accuracy: ${(summary.mean_trial_accuracy * 100).toFixed(1)}% ± ${(summary.std_trial_accuracy * 100).toFixed(1)}% (Chance = 50.0%)
• Mean Cohen's Kappa: ${summary.mean_kappa.toFixed(3)} ± ${summary.std_kappa.toFixed(3)}
• Mean Macro F1: ${(summary.mean_macro_f1 * 100).toFixed(1)}%
• Wolpaw Bitrate (ITR): ${summary.mean_itr_bits_per_min.toFixed(2)} bits/min
• Median Inference Latency: ${summary.median_latency_ms.toFixed(2)} ms (p95: ${summary.p95_latency_ms.toFixed(2)} ms)
• Dataset: BCI Competition IV-2a (BNCI2014_001), 9 subjects, 22 channels, 250 Hz
• Protocol: Strict Cross-Session Held-Out (Session 1 Train -> Session 2 Test)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <GlassPanel variant="default" className="p-6 border-white/10 transition-all">
      {/* Header & Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 text-left group"
        >
          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-cyan-400 group-hover:bg-white/[0.08] transition-colors">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Experimental Protocol
              </span>
              <Pill variant="muted" size="sm" className="font-mono text-[10px]">
                Rigorous Methodology
              </Pill>
            </div>
            <h3 className="text-base font-semibold text-text group-hover:text-cyan-300 transition-colors flex items-center gap-2">
              <span>How We Measured (Cross-Session Validation &amp; Honest Limits)</span>
              <ChevronDown
                className={`w-4 h-4 text-muted transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </h3>
          </div>
        </button>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            onClick={handleCopySummary}
            variant="outline"
            className="rounded-full h-8 px-3.5 bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-xs text-text flex items-center gap-1.5 shadow-sm font-mono"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-muted" />
                <span>Copy Summary</span>
              </>
            )}
          </Button>

          <Button
            onClick={handleDownloadJson}
            variant="outline"
            className="rounded-full h-8 px-3.5 bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-xs text-text flex items-center gap-1.5 shadow-sm font-mono"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Download metrics.json</span>
          </Button>
        </div>
      </div>

      {/* Collapsible Content with Framer Motion Animation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs leading-relaxed">
              {/* Card 1: Cross-Session Protocol */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold font-mono text-[11px]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Cross-Session Split</span>
                </div>
                <p className="text-muted">
                  Models are calibrated strictly on <strong>Session 1 (0train)</strong> (144 trials) and tested on <strong>Session 2 (1test)</strong> (144 trials) recorded on a different day. Zero cross-contamination or synthetic trial leakage.
                </p>
              </div>

              {/* Card 2: Window vs Trial Evaluation */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono text-[11px]">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Window vs. Trial</span>
                </div>
                <p className="text-muted">
                  <strong>Window accuracy</strong> evaluates individual 2.0 s sliding slices cropped at 0.25 s train / 0.1 s test stride. <strong>Trial accuracy</strong> evaluates the accumulated decision over the complete 4.0 s cue epoch.
                </p>
              </div>

              {/* Card 3: Dataset & Seeds */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-semibold font-mono text-[11px]">
                  <Database className="w-3.5 h-3.5" />
                  <span>Dataset &amp; Parameters</span>
                </div>
                <p className="text-muted">
                  <strong>BCI Competition IV-2a</strong> (BNCI2014_001), 22 scalp Ag/AgCl channels, 250 Hz sampling, 4th-order Butterworth SOS bandpass (8–30 Hz). Fixed random seed 42 for complete reproducibility.
                </p>
              </div>

              {/* Card 4: Honest Scientific Limits */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-semibold font-mono text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Honest Limitations</span>
                </div>
                <p className="text-muted">
                  Small cohort (N=9). Subject S2 exhibits known motor imagery illiteracy (~50% chance). Per-subject calibration required; playback uses validated archival telemetry, not wet-electrode live caps.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}
