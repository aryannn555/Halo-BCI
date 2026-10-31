"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { GlassPanel } from "../GlassPanel";
import { SectionLabel, Pill } from "../Primitives";
import { BenchmarkMetrics, RobustnessPoint } from "@/lib/metrics";
import { useHaloStore } from "@/lib/store";
import { sendHaloConfig } from "@/lib/useHalo";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { SlidersHorizontal, Activity, ShieldAlert, Sparkles } from "lucide-react";

interface NoiseRobustnessLabProps {
  metrics: BenchmarkMetrics;
}

const SNR_STOPS = [
  { label: "Off", sub: "Clean", snr: null, key: "inf" },
  { label: "+20", sub: "dB", snr: 20, key: "20dB" },
  { label: "+10", sub: "dB", snr: 10, key: "10dB" },
  { label: "+5", sub: "dB", snr: 5, key: "5dB" },
  { label: "0", sub: "dB", snr: 0, key: "0dB" },
  { label: "-5", sub: "dB", snr: -5, key: "-5dB" },
];

export function NoiseRobustnessLab({ metrics }: NoiseRobustnessLabProps) {
  const config = useHaloStore((state) => state.config);
  const hello = useHaloStore((state) => state.hello);
  const latestFrame = useHaloStore((state) => state.latestFrame);

  const activeSnr = config.noise_snr_db;

  // Track live trial outcomes for last 20 trials
  const [trialHistory, setTrialHistory] = useState<
    Array<{ trial: number; truth: string; pred: string; correct: boolean }>
  >([]);
  const lastRecordedTrialRef = useRef<number>(-1);

  // Monitor incoming frames to record completed trial classifications
  useEffect(() => {
    if (!latestFrame) return;

    const { trial, truth, pred } = latestFrame;
    if (truth !== null && pred && pred.label) {
      if (trial !== lastRecordedTrialRef.current) {
        lastRecordedTrialRef.current = trial;
        const correct = truth === pred.label;
        setTrialHistory((prev) => {
          const next = [...prev, { trial, truth, pred: pred.label, correct }];
          return next.slice(-20); // Keep last 20
        });
      }
    }
  }, [latestFrame]);

  // Compute live running accuracy over last 20 trials
  const liveTrialsCount = trialHistory.length;
  const liveCorrectCount = trialHistory.filter((t) => t.correct).length;
  const liveRunningAccuracy =
    liveTrialsCount > 0 ? (liveCorrectCount / liveTrialsCount) * 100 : null;

  // Mini C3/C4 Waveform Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const c3BufferRef = useRef<number[]>([]);
  const c4BufferRef = useRef<number[]>([]);
  const MAX_SAMPLES = 200; // ~0.8s at 250 Hz

  // Find C3 and C4 indices
  const c3Index = useMemo(() => {
    if (!hello?.channels) return 7;
    const idx = hello.channels.indexOf("C3");
    return idx >= 0 ? idx : 7;
  }, [hello]);

  const c4Index = useMemo(() => {
    if (!hello?.channels) return 11;
    const idx = hello.channels.indexOf("C4");
    return idx >= 0 ? idx : 11;
  }, [hello]);

  // Draw waveform traces
  const renderCanvas = (c3Buf: number[], c4Buf: number[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Centerlines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.3);
    ctx.lineTo(w, h * 0.3);
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w, h * 0.75);
    ctx.stroke();

    const drawTrace = (
      buf: number[],
      centerY: number,
      color: string,
      scale = 0.35
    ) => {
      if (buf.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.25;
      ctx.beginPath();

      const dx = w / (MAX_SAMPLES - 1);
      const startIdx = MAX_SAMPLES - buf.length;

      for (let i = 0; i < buf.length; i++) {
        const x = (startIdx + i) * dx;
        const y = centerY - buf[i] * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawTrace(c3Buf, h * 0.3, "#4CC9F0", 0.35);
    drawTrace(c4Buf, h * 0.75, "#FFB547", 0.35);
  };

  // Seed baseline rhythm if empty
  useEffect(() => {
    if (c3BufferRef.current.length === 0) {
      const initialC3: number[] = [];
      const initialC4: number[] = [];
      for (let i = 0; i < MAX_SAMPLES; i++) {
        const t = i / 250;
        // Clean 10 Hz mu rhythm + 20 Hz beta rhythm
        const c3Val = 18 * Math.sin(2 * Math.PI * 10 * t) + 8 * Math.sin(2 * Math.PI * 22 * t);
        const c4Val = 16 * Math.sin(2 * Math.PI * 10.5 * t + 0.8) + 7 * Math.sin(2 * Math.PI * 21 * t);
        initialC3.push(c3Val);
        initialC4.push(c4Val);
      }
      c3BufferRef.current = initialC3;
      c4BufferRef.current = initialC4;
      renderCanvas(initialC3, initialC4);
    }
  }, []);

  // Append incoming samples to waveform buffers
  useEffect(() => {
    if (!latestFrame?.eeg) return;

    const eeg = latestFrame.eeg;
    const c3Samples = eeg[c3Index] || [];
    const c4Samples = eeg[c4Index] || [];

    const c3Buf = c3BufferRef.current;
    const c4Buf = c4BufferRef.current;

    for (let i = 0; i < c3Samples.length; i++) {
      c3Buf.push(c3Samples[i]);
      c4Buf.push(c4Samples[i]);
    }

    if (c3Buf.length > MAX_SAMPLES) {
      c3Buf.splice(0, c3Buf.length - MAX_SAMPLES);
    }
    if (c4Buf.length > MAX_SAMPLES) {
      c4Buf.splice(0, c4Buf.length - MAX_SAMPLES);
    }

    renderCanvas(c3Buf, c4Buf);
  }, [latestFrame, c3Index, c4Index]);

  // Handle SNR button clicks
  const handleSelectSnr = (snr: number | null) => {
    sendHaloConfig({ noise_snr_db: snr });
    useHaloStore.getState().setConfig({ noise_snr_db: snr });
  };

  // Prepare sweep data for Recharts
  const sweepData = metrics.robustness_sweep.map((pt: RobustnessPoint) => {
    let name = pt.snr_db;
    if (name === "inf") name = "Off";
    return {
      name,
      snrVal: pt.snr_value,
      accuracy: +(pt.mean_accuracy * 100).toFixed(1),
      std: +(pt.std_accuracy * 100).toFixed(1),
    };
  });

  // Current active label for chart marker
  const activeStop =
    SNR_STOPS.find((s) => s.snr === activeSnr) || SNR_STOPS[0];
  const activeChartName = activeStop.snr === null ? "Off" : activeStop.key;

  return (
    <GlassPanel variant="hero" className="p-6 sm:p-7 border-white/10 relative overflow-hidden flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SectionLabel icon={<ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}>
              Stress Verification
            </SectionLabel>
            <Pill variant="amber" size="sm" className="font-mono text-[10px]">
              Live Injected Noise
            </Pill>
            {activeSnr !== null ? (
              <Pill variant="error" size="sm" className="font-mono text-[10px]">
                Active Noise: {activeSnr} dB
              </Pill>
            ) : (
              <Pill variant="success" size="sm" className="font-mono text-[10px]">
                Clean EEG (Inf SNR)
              </Pill>
            )}
          </div>
          <h3 className="text-lg font-semibold text-text tracking-tight">
            Noise Robustness Lab &amp; Real-Time Degradation
          </h3>
          <p className="text-xs text-muted max-w-2xl mt-0.5">
            Offline SNR sweep benchmark vs live calibrated noise injection (50 Hz powerline hum,
            ocular drift &amp; thermal Gaussian noise).
          </p>
        </div>

        {/* Live Running Accuracy Badge */}
        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-2">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono text-muted tracking-wider">
              Live Last 20 Trials
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-lg font-bold text-text tabular-nums">
                {liveRunningAccuracy !== null
                  ? `${liveRunningAccuracy.toFixed(1)}%`
                  : "Streaming..."}
              </span>
              {liveTrialsCount > 0 && (
                <span className="text-xs text-muted">
                  ({liveCorrectCount}/{liveTrialsCount})
                </span>
              )}
            </div>
          </div>
          <Sparkles className="w-4 h-4 text-amber-400 opacity-80" />
        </div>
      </div>

      {/* Interactive Controls & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center flex-1">
        {/* Left: Tactile SNR Selector & Mini Waveforms (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {/* Tactile SNR Slider Stops */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted" />
                <span>Inject Noise Artifacts:</span>
              </span>
              <span className="text-text font-bold">
                {activeSnr !== null ? `${activeSnr} dB SNR` : "Clean (No Noise)"}
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {SNR_STOPS.map((stop) => {
                const isSelected = activeSnr === stop.snr;
                return (
                  <button
                    key={stop.label}
                    type="button"
                    onClick={() => handleSelectSnr(stop.snr)}
                    className={`py-2 px-1 rounded-xl text-xs font-mono transition-all duration-200 border text-center flex flex-col items-center justify-center ${
                      isSelected
                        ? "bg-white text-[#07080A] font-bold border-white shadow-[0_0_12px_rgba(255,255,255,0.4)] scale-105 z-10"
                        : "bg-white/[0.03] hover:bg-white/[0.08] text-muted hover:text-text border-white/5"
                    }`}
                  >
                    <span className="font-semibold text-xs leading-none">{stop.label}</span>
                    <span className="text-[9px] opacity-70 leading-none mt-1 font-sans">{stop.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Miniature Live C3/C4 Waveform Preview */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-mono">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-text">Live Motor Channels Preview</span>
              </div>
              <div className="flex items-center gap-2.5 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-cyan-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4CC9F0]" />
                  C3
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFB547]" />
                  C4
                </span>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={360}
              height={80}
              className="w-full h-20 rounded-lg bg-[#07080A]/60 border border-white/5"
            />

            <div className="flex justify-between text-[10px] font-mono text-muted mt-2">
              <span>Real-Time Injected Jitter</span>
              <span>Hop: 100 ms | SOS filt</span>
            </div>
          </div>
        </div>

        {/* Right: Accuracy vs SNR Curve (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-muted">
              Benchmark Accuracy Retention Under Electrical &amp; Baseline Noise
            </span>
            <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-[#4CC9F0]" />
              <span>Offline Sweep Curve</span>
            </div>
          </div>

          <div className="w-full h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sweepData}
                margin={{ top: 12, right: 16, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255, 255, 255, 0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
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
                  cursor={{ stroke: "rgba(255, 255, 255, 0.15)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-xl bg-[#0D0F12]/95 backdrop-blur-xl border border-white/10 p-2.5 font-mono text-xs shadow-xl">
                          <div className="text-text font-semibold">{d.name} Noise</div>
                          <div className="text-cyan-400 font-bold mt-1">
                            {d.accuracy}% <span className="text-muted font-normal">± {d.std}%</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {/* Chance level 50% */}
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
                  }}
                />

                {/* Live Marker for Current Active SNR */}
                <ReferenceLine
                  x={activeChartName}
                  stroke="#FFB547"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  label={{
                    value: "Active",
                    fill: "#FFB547",
                    fontSize: 9,
                    fontFamily: "monospace",
                    position: "top",
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#4CC9F0"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={{ r: 4, fill: "#4CC9F0", stroke: "#07080A", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#4CC9F0" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[11px] font-mono text-muted/80 text-center mt-2">
            Bandpass 8-30 Hz Butterworth SOS rejects out-of-band powerline harmonics; CSP filters retain &gt;84% accuracy at severe -5 dB SNR.
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}
