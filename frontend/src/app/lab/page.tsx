"use client";

import React, { useEffect, useState } from "react";
import { useHaloStore } from "@/lib/store";
import { sendHaloConfig } from "@/lib/useHalo";
import { fetchMetrics, BenchmarkMetrics } from "@/lib/metrics";
import { EmptyState, ErrorState } from "@/components/halo/States";
import { HeadlineHero } from "@/components/halo/lab/HeadlineHero";
import { SubjectAccuracyChart } from "@/components/halo/lab/SubjectAccuracyChart";
import { ConfusionMatrixPanel } from "@/components/halo/lab/ConfusionMatrixPanel";
import { LatencyDistribution } from "@/components/halo/lab/LatencyDistribution";
import { NoiseRobustnessLab } from "@/components/halo/lab/NoiseRobustnessLab";
import { PipelineDiagram } from "@/components/halo/lab/PipelineDiagram";
import { MethodologyNote } from "@/components/halo/lab/MethodologyNote";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, FlaskConical, BarChart3 } from "lucide-react";

export default function LabPage() {
  const [metrics, setMetrics] = useState<BenchmarkMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected model for the page: "csp_lda" or "eegnet"
  const [selectedModel, setSelectedModel] = useState<string>("csp_lda");

  // Subject filter (null = all subjects, 1..9 = filtered subject)
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);

  // Synchronize with HaloStore backend connection
  const connected = useHaloStore((state) => state.connected);

  const loadMetricsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMetrics();
      if (data && data.summary && data.subjects) {
        setMetrics(data);
        if (data.default_model && (data.default_model === "csp_lda" || data.default_model === "eegnet")) {
          setSelectedModel(data.default_model);
        }
      } else {
        setError("Benchmark metrics data not found in backend/results/metrics.json.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load metrics";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetricsData();
  }, []);

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    sendHaloConfig({ model });
    useHaloStore.getState().setConfig({ model });
  };

  const handleDownloadReport = () => {
    window.open("http://localhost:8000/api/report", "_blank");
  };

  // If metrics failed to load or metrics.json is missing, show designed empty state
  if (!loading && (!metrics || error)) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-6 animate-in fade-in duration-300">
        <EmptyState
          icon={<FlaskConical className="w-8 h-8 text-amber-400" />}
          title="Benchmark Metrics Not Generated Yet"
          description="Offline cross-validation benchmark results (metrics.json) were not found on the backend. Run the evaluation pipeline to compute per-subject metrics and cross-session statistics."
          actionLabel="Retry Loading Metrics"
          onAction={loadMetricsData}
        />

        <div className="p-5 rounded-2xl bg-[#0D0F12]/80 border border-white/10 font-mono text-xs text-muted space-y-2">
          <div className="text-text font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Generate Metrics Command:</span>
          </div>
          <div className="bg-black/60 p-3 rounded-xl border border-white/5 text-cyan-300 select-all overflow-x-auto">
            cd backend &amp;&amp; .venv/bin/python -m ml.evaluate
          </div>
          <p className="text-[11px] text-muted">
            This will evaluate CSP + LDA and EEGNet across all 9 held-out subjects and write backend/results/metrics.json.
          </p>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (loading || !metrics) {
    return (
      <div className="space-y-6 animate-pulse py-6">
        <div className="h-10 w-72 bg-white/[0.04] rounded-2xl" />
        <div className="h-56 w-full bg-white/[0.03] rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-80 bg-white/[0.03] rounded-3xl" />
          <div className="lg:col-span-5 h-80 bg-white/[0.03] rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Scene Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Scientific Benchmarks
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">
            Quantitative Evaluation &amp; Metrics Lab
          </h1>
          <p className="text-xs sm:text-sm text-muted max-w-2xl mt-1 leading-relaxed">
            Rigorous held-out cross-session validation across all 9 BCI Competition IV-2a participants.
            Real-time live streaming integration with dynamic noise stress testing.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={loadMetricsData}
            variant="outline"
            className="rounded-full h-8 px-3 bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-xs text-text flex items-center gap-1.5 font-mono shadow-sm"
          >
            <RefreshCw className="w-3 h-3 text-muted" />
            <span>Refresh</span>
          </Button>

          <Button
            onClick={handleDownloadReport}
            variant="outline"
            className="rounded-full h-8 px-3.5 bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-xs text-text flex items-center gap-1.5 font-mono shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>PDF Report</span>
          </Button>
        </div>
      </div>

      {!connected && (
        <ErrorState
          title="Live Stream Server Disconnected"
          message="FastAPI backend is offline or disconnected. Metrics are displayed from cached results, but live C3/C4 previews and live latency markers require the server."
        />
      )}

      {/* 1. DOMINANT HERO HEADLINE PANEL */}
      <HeadlineHero
        metrics={metrics}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
      />

      {/* 2. BENTO ROW 1: PER-SUBJECT ACCURACY (7 COLS) & CONFUSION MATRIX (5 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          <SubjectAccuracyChart
            metrics={metrics}
            selectedModel={selectedModel}
            selectedSubject={selectedSubject}
            onSelectSubject={setSelectedSubject}
          />
        </div>

        <div className="lg:col-span-5">
          <ConfusionMatrixPanel
            metrics={metrics}
            selectedModel={selectedModel}
            selectedSubject={selectedSubject}
            onResetSubject={() => setSelectedSubject(null)}
          />
        </div>
      </div>

      {/* 3. BENTO ROW 2: LATENCY PROFILE (5 COLS) & NOISE ROBUSTNESS LAB (7 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5">
          <LatencyDistribution
            metrics={metrics}
            selectedModel={selectedModel}
          />
        </div>

        <div className="lg:col-span-7">
          <NoiseRobustnessLab metrics={metrics} />
        </div>
      </div>

      {/* 4. HORIZONTAL PIPELINE DIAGRAM */}
      <PipelineDiagram selectedModel={selectedModel} />

      {/* 5. METHODOLOGY & HONEST LIMITS NOTE */}
      <MethodologyNote
        metrics={metrics}
        selectedModel={selectedModel}
      />
    </div>
  );
}
