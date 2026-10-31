"use client";

import React, { useEffect, useRef, useState } from "react";
import { FrameMessage, HelloMessage } from "@/types/halo";
import { Zap, CheckCircle2, AlertCircle, Clock, Activity, Cpu } from "lucide-react";

interface NeuroMonitorProps {
  latestFrame: FrameMessage | null;
  frameBufferRef: React.MutableRefObject<FrameMessage[]>;
  hello: HelloMessage | null;
  activeModel?: string;
}

// Channels to display in focal motor mode:
// C3 (left motor cortex), Cz (vertex), C4 (right motor cortex), FC3, FC4, CP3, CP4, Oz
const FOCAL_CHANNEL_NAMES = ["FC3", "FCz", "FC4", "C3", "Cz", "C4", "CP3", "CP4"];

export function NeuroMonitor({
  latestFrame,
  frameBufferRef,
  hello,
}: NeuroMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [channelMode, setChannelMode] = useState<"focal" | "all">("focal");
  const [scaleMicrovolts, setScaleMicrovolts] = useState<number>(100);

  // 60 FPS Canvas rendering loop reading directly from frameBufferRef
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;

      // Dark background fill
      ctx.fillStyle = "#0D0F12";
      ctx.fillRect(0, 0, width, height);

      const frames = frameBufferRef.current;
      if (frames.length === 0) {
        ctx.fillStyle = "#8A919C";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Press 'Stream' or Spacebar to begin live EEG replay stream", width / 2, height / 2);
        animId = requestAnimationFrame(render);
        return;
      }

      const allChannels = hello?.channels ?? [
        "Fz", "FC3", "FC1", "FCz", "FC2", "FC4",
        "C5", "C3", "C1", "Cz", "C2", "C4", "C6",
        "CP3", "CP1", "CPz", "CP2", "CP4",
        "P1", "Pz", "P2", "Oz"
      ];

      // Determine which channel indices to render
      const channelIndices: number[] = [];
      if (channelMode === "focal") {
        FOCAL_CHANNEL_NAMES.forEach((name) => {
          const idx = allChannels.indexOf(name);
          if (idx !== -1) channelIndices.push(idx);
        });
      } else {
        allChannels.forEach((_, idx) => channelIndices.push(idx));
      }

      const nVisible = channelIndices.length;
      if (nVisible === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const rowHeight = height / nVisible;

      // Draw faint baseline grid rows
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < nVisible; i++) {
        const yCenter = (i + 0.5) * rowHeight;
        ctx.beginPath();
        ctx.moveTo(0, yCenter);
        ctx.lineTo(width, yCenter);
        ctx.stroke();

        // Channel Label
        const chIdx = channelIndices[i];
        const chName = allChannels[chIdx];
        const isC3 = chName === "C3";
        const isC4 = chName === "C4";

        ctx.font = "10px monospace";
        ctx.textAlign = "left";
        if (isC3) {
          ctx.fillStyle = "#4CC9F0";
          ctx.fillText(`${chName} (Left Cortex)`, 12, yCenter - 4);
        } else if (isC4) {
          ctx.fillStyle = "#FFB547";
          ctx.fillText(`${chName} (Right Cortex)`, 12, yCenter - 4);
        } else {
          ctx.fillStyle = "rgba(242, 244, 247, 0.4)";
          ctx.fillText(chName, 12, yCenter - 4);
        }
      }

      // Flatten samples across recent frames
      // Each frame has 10 samples per channel
      const totalPoints = frames.reduce((acc, f) => acc + (f.eeg[0]?.length ?? 0), 0);
      if (totalPoints < 2) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dx = width / Math.max(100, totalPoints);

      // Draw each channel trace
      channelIndices.forEach((chIdx, row) => {
        const chName = allChannels[chIdx];
        const yCenter = (row + 0.5) * rowHeight;
        const vScale = (rowHeight * 0.45) / scaleMicrovolts;

        ctx.beginPath();
        let x = 0;
        let isFirst = true;

        if (chName === "C3") {
          ctx.strokeStyle = "#4CC9F0";
          ctx.lineWidth = 1.5;
        } else if (chName === "C4") {
          ctx.strokeStyle = "#FFB547";
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = "rgba(242, 244, 247, 0.75)";
          ctx.lineWidth = 1.0;
        }

        for (let f = 0; f < frames.length; f++) {
          const chSamples = frames[f].eeg[chIdx];
          if (!chSamples) continue;
          for (let s = 0; s < chSamples.length; s++) {
            const uV = chSamples[s];
            const y = yCenter - uV * vScale;
            if (isFirst) {
              ctx.moveTo(x, y);
              isFirst = false;
            } else {
              ctx.lineTo(x, y);
            }
            x += dx;
          }
        }
        ctx.stroke();
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [channelMode, scaleMicrovolts, hello, frameBufferRef]);

  // Extract C3 and C4 bandpower
  const allChannels = hello?.channels ?? [
    "Fz", "FC3", "FC1", "FCz", "FC2", "FC4",
    "C5", "C3", "C1", "Cz", "C2", "C4", "C6",
    "CP3", "CP1", "CPz", "CP2", "CP4",
    "P1", "Pz", "P2", "Oz"
  ];
  const c3Idx = allChannels.indexOf("C3");
  const c4Idx = allChannels.indexOf("C4");

  const c3Mu = latestFrame?.bandpower?.mu?.[c3Idx] ?? 0;
  const c4Mu = latestFrame?.bandpower?.mu?.[c4Idx] ?? 0;
  const c3Beta = latestFrame?.bandpower?.beta?.[c3Idx] ?? 0;
  const c4Beta = latestFrame?.bandpower?.beta?.[c4Idx] ?? 0;

  const pred = latestFrame?.pred;
  const pLeft = pred?.left ?? 0.5;
  const pRight = pred?.right ?? 0.5;
  const predLabel = pred?.label ?? "left";
  const confidence = pred?.confidence ?? 0.5;
  const latencyMs = pred?.latency_ms ?? 0.8;
  const truth = latestFrame?.truth ?? null;
  const trialId = latestFrame?.trial ?? 1;
  const isCorrect = truth !== null ? truth === predLabel : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
      {/* Dominant Panel: Real-time Multi-Channel Waveform Stream (8 cols) */}
      <div className="lg:col-span-8 flex flex-col rounded-panel p-5 halo-glass border-halo-border shadow-glass">
        {/* Panel Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-halo-surface2 border border-halo-border">
              <Activity className="h-4 w-4 text-halo-left" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Real-Time EEG Waveforms</h2>
              <p className="text-[11px] text-halo-muted">
                250 Hz Continuous Replay • 40 ms Hop ({channelMode === "focal" ? "8 Sensorimotor" : "22 Full 10-20"} Channels)
              </p>
            </div>
          </div>

          {/* Controls: Mode & Scale */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-halo-surface2 p-0.5 border border-halo-border text-xs">
              <button
                onClick={() => setChannelMode("focal")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  channelMode === "focal"
                    ? "bg-halo-surface3 text-white shadow-sm"
                    : "text-halo-muted hover:text-white"
                }`}
              >
                Sensorimotor (Focal)
              </button>
              <button
                onClick={() => setChannelMode("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  channelMode === "all"
                    ? "bg-halo-surface3 text-white shadow-sm"
                    : "text-halo-muted hover:text-white"
                }`}
              >
                All 22 Channels
              </button>
            </div>

            <div className="flex items-center rounded-lg bg-halo-surface2 px-2 py-1 border border-halo-border text-[11px]">
              <span className="text-halo-muted mr-1.5">Scale:</span>
              <select
                value={scaleMicrovolts}
                onChange={(e) => setScaleMicrovolts(Number(e.target.value))}
                className="bg-transparent text-white focus:outline-none cursor-pointer font-mono"
              >
                <option value={50} className="bg-halo-surface2">±50 µV</option>
                <option value={100} className="bg-halo-surface2">±100 µV</option>
                <option value={200} className="bg-halo-surface2">±200 µV</option>
              </select>
            </div>
          </div>
        </div>

        {/* 60 FPS Waveform Canvas */}
        <div className="relative w-full h-[360px] rounded-xl overflow-hidden border border-halo-border bg-halo-surface">
          <canvas
            ref={canvasRef}
            width={720}
            height={360}
            className="w-full h-full block"
          />

          {/* Canvas Floating Overlay: Live Timing & Replay Stamp */}
          <div className="absolute bottom-2 right-3 flex items-center gap-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] num-font text-halo-muted">
            <span>t = {latestFrame?.t?.toFixed(2) ?? "0.00"}s</span>
            <span className="text-white/20">•</span>
            <span>Trial #{trialId}</span>
          </div>
        </div>

        {/* Channel Legend & Neurophysio Guide */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-halo-muted">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-halo-left" />
              <span>C3: Left Motor (Right Hand ERD)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-halo-right" />
              <span>C4: Right Motor (Left Hand ERD)</span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-halo-muted/80">
            Common Average Reference + 8-30 Hz Butterworth
          </div>
        </div>
      </div>

      {/* Side Bento Panels: Neural Decoder & Sensorimotor Rhythms (4 cols) */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        {/* Top Side Panel: Neural Decoder HUD */}
        <div className="rounded-panel p-5 halo-glass border-halo-border shadow-glass flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-halo-surface2 border border-halo-border">
                <Cpu className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-white">Neural Intent Decoder</h3>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-halo-surface2 border border-halo-border text-halo-success">
              <Clock className="h-3 w-3" />
              <span>{latencyMs.toFixed(1)} ms</span>
            </div>
          </div>

          {/* Active Trial Cue State Banner */}
          <div
            className={`rounded-xl p-3 mb-4 border transition-colors ${
              truth === "left"
                ? "bg-halo-left/10 border-halo-left/30 text-halo-left"
                : truth === "right"
                ? "bg-halo-right/10 border-halo-right/30 text-halo-right"
                : "bg-halo-surface2 border-halo-border text-halo-muted"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-halo-muted">
                Cue Paradigm State
              </span>
              {truth !== null ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40">
                  ACTIVE TRIAL
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40">
                  REST INTERVAL
                </span>
              )}
            </div>
            <div className="mt-1 text-sm font-bold tracking-tight">
              {truth === "left" && "Left Hand Motor Imagery (C4 ERD)"}
              {truth === "right" && "Right Hand Motor Imagery (C3 ERD)"}
              {truth === null && "Inter-Trial Rest / Fixation Cross"}
            </div>
          </div>

          {/* Decoded Probabilities Bar */}
          <div className="space-y-3">
            {/* Left Hand Probability */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-halo-left font-medium">Left Hand Intent</span>
                <span className="num-font text-white font-semibold">{(pLeft * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-halo-surface3 overflow-hidden border border-white/5">
                <div
                  className="h-full rounded-full bg-halo-left transition-all duration-75"
                  style={{ width: `${Math.max(2, pLeft * 100)}%` }}
                />
              </div>
            </div>

            {/* Right Hand Probability */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-halo-right font-medium">Right Hand Intent</span>
                <span className="num-font text-white font-semibold">{(pRight * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-halo-surface3 overflow-hidden border border-white/5">
                <div
                  className="h-full rounded-full bg-halo-right transition-all duration-75"
                  style={{ width: `${Math.max(2, pRight * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Decoder Decision Summary */}
          <div className="mt-4 pt-3.5 border-t border-halo-border/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-halo-muted text-[11px] block">Decoded Action:</span>
              <span
                className={`font-semibold uppercase tracking-wider text-sm ${
                  predLabel === "left" ? "text-halo-left" : "text-halo-right"
                }`}
              >
                {predLabel} Hand ({(confidence * 100).toFixed(0)}%)
              </span>
            </div>

            {isCorrect !== null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-halo-surface2 border border-halo-border">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-halo-success" />
                    <span className="text-[11px] font-medium text-halo-success">Match</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-halo-error" />
                    <span className="text-[11px] font-medium text-halo-error">Mismatch</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Side Panel: Sensorimotor Rhythm ERD/ERS Spectral Power */}
        <div className="rounded-panel p-5 halo-glass border-halo-border shadow-glass flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-halo-surface2 border border-halo-border">
                  <Zap className="h-4 w-4 text-halo-left" />
                </div>
                <h3 className="text-sm font-semibold text-white">Sensorimotor Rhythms</h3>
              </div>
              <span className="text-[10px] font-mono text-halo-muted">Mu & Beta Power</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* C3 Electrode Box */}
              <div className="p-3 rounded-xl bg-halo-surface2 border border-halo-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-halo-left">C3 Channel</span>
                  <span className="text-[10px] text-halo-muted">Left</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-halo-muted">Mu (8-12Hz):</span>
                    <span className="num-font text-white">{c3Mu.toFixed(1)} µV²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-halo-muted">Beta (16-24Hz):</span>
                    <span className="num-font text-white">{c3Beta.toFixed(1)} µV²</span>
                  </div>
                </div>
              </div>

              {/* C4 Electrode Box */}
              <div className="p-3 rounded-xl bg-halo-surface2 border border-halo-border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-halo-right">C4 Channel</span>
                  <span className="text-[10px] text-halo-muted">Right</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-halo-muted">Mu (8-12Hz):</span>
                    <span className="num-font text-white">{c4Mu.toFixed(1)} µV²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-halo-muted">Beta (16-24Hz):</span>
                    <span className="num-font text-white">{c4Beta.toFixed(1)} µV²</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-halo-muted leading-relaxed">
            During motor imagery, contralateral desynchronization (ERD) causes Mu/Beta spectral power attenuation over the active hemisphere.
          </p>
        </div>
      </div>
    </div>
  );
}
