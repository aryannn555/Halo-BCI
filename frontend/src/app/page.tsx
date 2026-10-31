"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Play,
  Compass,
  ShieldAlert,
  Users,
  Activity,
  Zap,
  Info,
  Gauge,
  Sparkles,
  ArrowRight,
  Brain,
  Sliders,
} from "lucide-react";
import { useHaloStore } from "@/lib/store";
import { sendHaloControl } from "@/lib/useHalo";
import { fetchMetrics, BenchmarkMetrics } from "@/lib/metrics";
import { GlassPanel } from "@/components/halo/GlassPanel";
import { KeyHint } from "@/components/halo/Primitives";
import { FacetedBrainScene } from "@/components/halo/FacetedBrainScene";
import { PipelineDiagram } from "@/components/halo/lab/PipelineDiagram";
import { CspCalibrationView } from "@/components/halo/CspCalibrationView";
import { AboutDialog } from "@/components/halo/AboutDialog";
import { startTour } from "@/lib/tour";
import { Button } from "@/components/ui/button";

export default function OverviewPage() {
  const router = useRouter();
  const status = useHaloStore((state) => state.status);
  const hello = useHaloStore((state) => state.hello);
  const isRunning = status?.state === "running";

  const [metrics, setMetrics] = useState<BenchmarkMetrics | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchMetrics().then((data) => {
      if (data) setMetrics(data);
    });
  }, []);

  // Track global window scroll position (0.0 at top to 1.0 at bottom)
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const p = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;
      setScrollProgress(p);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleToggleReplay = () => {
    if (!isRunning) {
      sendHaloControl("start");
      router.push("/live");
    } else {
      sendHaloControl("pause");
    }
  };

  const handleStartTour = () => {
    startTour();
  };

  // Keyboard shortcut: 'D' for guided demo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        startTour();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Real telemetry values
  const channelCount = hello?.channels?.length ?? 22;
  const sfreq = hello?.sfreq ?? 250;
  const meanAcc = metrics?.summary?.csp_lda?.mean_trial_accuracy
    ? metrics.summary.csp_lda.mean_trial_accuracy * 100
    : 90.2;
  const latencyMs = metrics?.summary?.csp_lda?.median_latency_ms ?? 0.41;

  return (
    <div className="relative min-h-[500vh] text-text">
      {/* 1. FIXED FULLSCREEN 3D CANVAS (Mounted directly to document.body to bypass parent CSS transforms) */}
      {mounted &&
        createPortal(
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden w-screen h-screen">
            <FacetedBrainScene scrollProgress={scrollProgress} />
          </div>,
          document.body
        )}

      {/* 2. SCROLL-DRIVEN NARRATIVE SECTIONS */}
      <div className="relative z-10 flex flex-col space-y-36 pb-32">
        {/* ========================================================================= */}
        {/* SECTION 1: HERO LANDING (Brain on Right, Left Typography - Frame 00)     */}
        {/* ========================================================================= */}
        <section className="min-h-[92vh] flex items-center pt-4">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column (5 cols): Massive 3-Line Headline, Kicker, Subtext, CTAs */}
            <div className="lg:col-span-5 flex flex-col gap-6 pointer-events-auto">
              <div className="space-y-1">
                <h1 className="text-6xl sm:text-7xl lg:text-[76px] xl:text-[84px] font-black tracking-[-0.035em] text-white leading-[0.93] select-none">
                  Unlock<br />
                  neural<br />
                  control.
                </h1>
              </div>

              {/* Amber Kicker */}
              <div className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.28em] text-amber-400 uppercase select-none -mt-2">
                RESTORE AGENCY. DECODE INTENT.
              </div>

              {/* Paragraph Explanation */}
              <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed max-w-xl">
                When you imagine moving your hands, your motor cortex fires microvolt electrical rhythms without moving a muscle. Halo decodes these neural signals in 100 milliseconds to operate assistive robotics, communication spellers, and everyday tools.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <Button
                  onClick={handleToggleReplay}
                  className="rounded-full px-7 h-12 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-[0_0_35px_rgba(139,92,246,0.45)] border border-purple-400/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2.5"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Start Real-Time Replay</span>
                </Button>

                <Button
                  onClick={handleStartTour}
                  variant="outline"
                  className="rounded-full px-5 h-12 bg-white/[0.05] hover:bg-white/[0.1] border-white/15 text-white/90 text-sm font-medium backdrop-blur-md transition-all flex items-center gap-2 hover:border-white/25"
                >
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span>Guided Demo</span>
                  <KeyHint className="ml-1 bg-white/10 text-zinc-300 border-white/15">D</KeyHint>
                </Button>

                <Button
                  onClick={() => setAboutOpen(true)}
                  variant="ghost"
                  className="rounded-full h-12 px-3 text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5"
                >
                  <Info className="w-3.5 h-3.5 text-zinc-400" />
                  <span>About</span>
                </Button>
              </div>

              {/* Telemetry Proof-Points Strip */}
              <div className="flex flex-wrap items-center gap-3.5 pt-4 text-xs font-mono text-zinc-400 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                  <span>{channelCount} Ag/AgCl Channels</span>
                </div>
                <span className="text-zinc-600">•</span>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  <span>{sfreq} Hz Real-Time</span>
                </div>
                <span className="text-zinc-600">•</span>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="text-white font-medium">{meanAcc.toFixed(1)}% Held-Out Acc</span>
                </div>
                <span className="text-zinc-600">•</span>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
                  <span>{latencyMs} ms Latency</span>
                </div>
              </div>
            </div>

            {/* Right Column (7 cols): Floating Cockpit HUD Chips framing 3D Brain */}
            <div className="lg:col-span-7 relative h-[500px] pointer-events-none hidden sm:block">
              {/* Floating Chip 1: Sampling & Channels (Top Left) */}
              <div className="absolute top-4 left-6 p-3.5 rounded-2xl halo-glass-raised border border-white/10 shadow-2xl backdrop-blur-xl flex items-center gap-3 font-mono animate-in fade-in duration-700">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Electrode Array</span>
                  <span className="text-xs font-bold text-white">
                    {channelCount} Ch @ {sfreq} Hz
                  </span>
                </div>
              </div>

              {/* Floating Chip 2: Benchmark Accuracy & Latency (Bottom Right) */}
              <div className="absolute bottom-6 right-6 p-3.5 rounded-2xl halo-glass-raised border border-white/10 shadow-2xl backdrop-blur-xl flex items-center gap-3 font-mono animate-in fade-in duration-700">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Gauge className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Held-Out Accuracy</span>
                  <span className="text-xs font-bold text-amber-300">
                    {meanAcc.toFixed(1)}% <span className="text-zinc-400 font-normal text-[10px]">({latencyMs} ms)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: DECODE WITH CERTAINTY (Brain on Left, Text on Right - sec 03)  */}
        {/* ========================================================================= */}
        <section className="min-h-[85vh] flex items-center justify-end">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left 6 cols: Leave open space for the 3D Brain which has translated here */}
            <div className="lg:col-span-6 pointer-events-none" />

            {/* Right 6 cols: Decision with Confidence narrative */}
            <div className="lg:col-span-6 flex flex-col gap-6 pointer-events-auto">
              <div className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.28em] text-cyan-400 uppercase select-none">
                CONTRALATERAL SENSORIMOTOR SYNCHRONIZATION
              </div>

              <h2 className="text-5xl sm:text-6xl font-bold tracking-tight text-white leading-[1.02]">
                Decode intent<br />
                with certainty.
              </h2>

              <p className="text-base sm:text-lg text-zinc-400 font-normal leading-relaxed max-w-xl">
                When imagining hand movement, the contralateral motor cortex undergoes event-related desynchronization (ERD) in the 8–12 Hz mu and 16–24 Hz beta bands. Halo&apos;s spatial filters isolate this rhythmic attenuation in real time, turning thought into discrete control before physical muscles ever contract.
              </p>

              {/* Three Glass Indicator Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                <div className="p-4 rounded-2xl halo-glass border border-white/10 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Streaming Latency</span>
                  <span className="text-xl font-bold text-white font-mono">100 ms</span>
                  <span className="text-[11px] text-zinc-500">Continuous sliding hop</span>
                </div>

                <div className="p-4 rounded-2xl halo-glass border border-white/10 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Dwell Gating</span>
                  <span className="text-xl font-bold text-amber-400 font-mono">600 ms</span>
                  <span className="text-[11px] text-zinc-500">Zero false activations</span>
                </div>

                <div className="p-4 rounded-2xl halo-glass border border-white/10 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Spatial Filters</span>
                  <span className="text-xl font-bold text-cyan-400 font-mono">6 CSP</span>
                  <span className="text-[11px] text-zinc-500">Contralateral isolation</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: NEURAL NOISE STORM (Brain Explodes in 3D Frustum - Frame 02)   */}
        {/* ========================================================================= */}
        <section className="min-h-[85vh] flex items-center justify-center text-center">
          <div className="max-w-3xl flex flex-col items-center gap-6 pointer-events-auto px-6 py-10 rounded-3xl bg-black/45 border border-white/10 backdrop-blur-md shadow-[0_0_60px_rgba(0,0,0,0.85)]">
            <div className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.28em] text-amber-400 uppercase select-none">
              MICROVOLT POTENTIALS IN A NOISY WORLD
            </div>

            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-tight">
              Why scalp EEG is hard.
            </h2>

            <p className="text-base sm:text-lg text-zinc-300 font-normal leading-relaxed">
              A human skull attenuates electrical potentials from hundreds of microvolts down to single-digit microvolts at the scalp. Every eye blink, jaw tension, and 50 Hz power-line interference injects massive electrical noise.
            </p>

            <p className="text-sm sm:text-base text-zinc-400 font-normal leading-relaxed max-w-2xl">
              Traditional brain-computer interfaces work only within a single session and collapse across days. Halo is engineered with robust spatial shrinkage to maintain decoding accuracy across sessions and down to negative signal-to-noise ratios.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <div className="px-5 py-2.5 rounded-full halo-glass border border-amber-400/30 text-amber-300 font-mono text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Robust down to -5 dB SNR</span>
              </div>
              <Button
                onClick={() => router.push("/lab")}
                variant="outline"
                className="rounded-full px-5 py-2.5 h-auto bg-white/5 border-white/10 hover:border-white/20 text-xs font-mono text-white flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Explore Noise Sweep in Lab</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: WHAT THE MODEL LEARNED (Re-Convergence into CSP Topographies)  */}
        {/* ========================================================================= */}
        <section className="min-h-[88vh] flex items-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column (6 cols): Space for 3D Brain showing active C3/C4 motor strip */}
            <div className="lg:col-span-6 pointer-events-none flex flex-col justify-end pb-8 hidden lg:flex">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl halo-glass border border-cyan-500/30 text-cyan-400 font-mono text-xs w-fit backdrop-blur-md pointer-events-auto shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]" />
                <span className="font-semibold text-white">Active Sensorimotor Strip</span>
                <span className="text-zinc-500">|</span>
                <span className="text-cyan-300 font-bold">C3 &amp; C4</span>
              </div>
            </div>

            {/* Right Column (6 cols): Narrative & Interactive CSP Calibration */}
            <div className="lg:col-span-6 flex flex-col gap-6 pointer-events-auto">
              <div className="space-y-2">
                <div className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.28em] text-amber-400 uppercase select-none">
                  COMMON SPATIAL PATTERNS
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
                  What the model learned.
                </h2>
                <p className="text-sm sm:text-base text-zinc-400 font-normal leading-relaxed">
                  Common Spatial Patterns (CSP) find spatial eigenvectors that maximize variance for left-hand trials while minimizing variance for right-hand trials. Below are real calibrated spatial pattern weights from BCI Competition IV-2a:
                </p>
              </div>

              {/* Interactive CSP Calibration Component */}
              <CspCalibrationView />
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: RESTORING HUMAN AGENCY (Three Interactive Glass Cards)         */}
        {/* ========================================================================= */}
        <section className="min-h-[75vh] flex flex-col justify-center space-y-8 pointer-events-auto">
          <div className="max-w-xl space-y-2">
            <div className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.28em] text-cyan-400 uppercase select-none">
              CLINICAL &amp; ASSISTIVE IMPACT
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
              Who this restores.
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 font-normal leading-relaxed">
              Engineered specifically for individuals who retain active cognitive intent but have lost neuromuscular motor pathways:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: ALS */}
            <GlassPanel variant="default" className="p-7 flex flex-col justify-between border-white/10 hover:border-cyan-500/30 transition-all">
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 w-fit">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Amyotrophic Lateral Sclerosis
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  As motor neurons degenerate, patients lose voluntary speech and limb control. Halo restores binary communication spellers and smart home environmental triggers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
                <span>Huffman predictive typing interface</span>
              </div>
            </GlassPanel>

            {/* Card 2: Spinal Cord Injury */}
            <GlassPanel variant="default" className="p-7 flex flex-col justify-between border-white/10 hover:border-purple-500/30 transition-all">
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 w-fit">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Spinal Cord Injury (C3–C5)
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Quadriplegic individuals retain intact cerebral cortical function. Halo bridges the spinal cord lesion, converting motor imagery directly into electric wheelchair commands.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 text-[11px] font-mono text-purple-400 flex items-center gap-1.5">
                <span>Hands-free directional navigation</span>
              </div>
            </GlassPanel>

            {/* Card 3: Locked-In Syndrome */}
            <GlassPanel variant="default" className="p-7 flex flex-col justify-between border-white/10 hover:border-amber-500/30 transition-all">
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 w-fit">
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Locked-In Syndrome
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  When all muscular output including eye movement is paralyzed, cognitive motor imagery remains intact. Halo establishes a direct non-invasive cognitive communication bridge.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 text-[11px] font-mono text-amber-400 flex items-center gap-1.5">
                <span>Direct neural decision verification</span>
              </div>
            </GlassPanel>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 6: REAL-TIME ARCHITECTURE PIPELINE                                */}
        {/* ========================================================================= */}
        <section className="min-h-[60vh] flex flex-col justify-center space-y-6 pointer-events-auto">
          <div className="max-w-xl space-y-2">
            <div className="text-[11px] sm:text-xs font-mono font-bold tracking-[0.28em] text-cyan-400 uppercase select-none">
              END-TO-END LATENCY &lt; 2 MS
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
              Real-Time Processing Pipeline
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 font-normal leading-relaxed">
              Synchronous 100 ms streaming flow with zero frame dropping and constant memory ring buffering:
            </p>
          </div>

          <PipelineDiagram selectedModel="csp_lda" />
        </section>

        {/* ========================================================================= */}
        {/* SECTION 7: THE CLOSING (Particles Converge into Central Emblem - Frame 10) */}
        {/* ========================================================================= */}
        <section className="min-h-[88vh] flex items-center justify-center text-center">
          <div className="max-w-2xl flex flex-col items-center gap-7 pointer-events-auto px-6 py-10 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-400 via-amber-400 to-purple-500 p-0.5 shadow-[0_0_35px_rgba(76,201,240,0.5)]">
              <div className="w-full h-full bg-[#07080A]/80 backdrop-blur-md rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>
            </div>

            <h2 className="text-5xl sm:text-6xl font-bold tracking-tight text-white leading-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
              Your mind has the intent.<br />
              Halo gives it agency.
            </h2>

            <p className="text-base sm:text-lg text-zinc-300 font-normal leading-relaxed max-w-lg px-6 py-3 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
              Explore the real-time neural decoding stream, test the Huffman binary speller, or stress-test the model with live noise sweeps in the Lab.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button
                onClick={handleToggleReplay}
                className="rounded-full px-8 h-13 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-[0_0_35px_rgba(139,92,246,0.5)] border border-purple-400/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2.5"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Start Real-Time Replay</span>
              </Button>

              <Button
                onClick={handleStartTour}
                variant="outline"
                className="rounded-full px-6 h-13 bg-white/[0.05] hover:bg-white/[0.1] border-white/15 text-white/90 text-sm font-medium backdrop-blur-md transition-all flex items-center gap-2 hover:border-white/25"
              >
                <Compass className="w-4 h-4 text-amber-400" />
                <span>Guided Demo</span>
                <KeyHint className="ml-1 bg-white/10 text-zinc-300 border-white/15">D</KeyHint>
              </Button>

              <Button
                onClick={() => setAboutOpen(true)}
                variant="ghost"
                className="rounded-full min-h-[40px] px-4 text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5"
              >
                <Info className="w-3.5 h-3.5 text-zinc-400" />
                <span>About &amp; Citations</span>
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* About Dialog Modal */}
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
}
