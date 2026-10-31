"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { useHaloStore } from "@/lib/store";
import { sendHaloControl } from "@/lib/useHalo";
import { GlassPanel } from "./GlassPanel";
import { Play, Pause, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const MOTOR_CHANNELS = ["C3", "Cz", "C4", "FC3", "FC4", "CP3", "CP4"];

const ALL_CHANNELS = [
  "Fz", "FC3", "FC1", "FCz", "FC2", "FC4",
  "C5", "C3", "C1", "Cz", "C2", "C4", "C6",
  "CP3", "CP1", "CPz", "CP2", "CP4",
  "P1", "Pz", "P2", "Oz"
];

const BUFFER_CAPACITY = 4500; // 18 seconds at 250 Hz

interface CueMarker {
  t: number;
  truth: "left" | "right";
}

export function Waveforms({ className }: { className?: string }) {
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);

  const status = useHaloStore((state) => state.status);

  // Settings
  const [channelMode, setChannelMode] = useState<"motor" | "all">("motor");
  const [timeWindow, setTimeWindow] = useState<number>(8); // 4, 8, 16s
  const [scaleUv, setScaleUv] = useState<number>(100); // 50 to 300 uV
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const isRunning = status?.state === "running";

  const activeChannels = useMemo(() => {
    return channelMode === "motor" ? MOTOR_CHANNELS : ALL_CHANNELS;
  }, [channelMode]);

  // Typed-array ring buffers
  const bufferRef = useRef<{
    t: Float64Array;
    channels: Map<string, Float32Array>;
    head: number;
    count: number;
    lastT: number;
    lastWallClock: number;
    markers: CueMarker[];
    lastTruth: string | null;
  }>({
    t: new Float64Array(BUFFER_CAPACITY),
    channels: new Map(),
    head: 0,
    count: 0,
    lastT: 0,
    lastWallClock: performance.now(),
    markers: [],
    lastTruth: null,
  });

  // Initialize channel buffers
  useEffect(() => {
    const map = bufferRef.current.channels;
    ALL_CHANNELS.forEach((ch) => {
      if (!map.has(ch)) {
        map.set(ch, new Float32Array(BUFFER_CAPACITY));
      }
    });
  }, []);

  // Subscribe directly to store frames without triggering React re-renders
  useEffect(() => {
    let prevFrameTime = -1;

    const unsubscribe = useHaloStore.subscribe((state) => {
      const frame = state.latestFrame;
      if (!frame || frame.t === prevFrameTime) return;
      prevFrameTime = frame.t;

      const buf = bufferRef.current;
      const sfreq = state.hello?.sfreq ?? 250;
      const hopSamples = frame.eeg && frame.eeg[0] ? frame.eeg[0].length : 25;
      const dt = 1 / sfreq;

      const channelsList = state.hello?.channels ?? ALL_CHANNELS;

      // Check if trial cue changed
      if (frame.truth && frame.truth !== buf.lastTruth) {
        buf.markers.push({ t: frame.t, truth: frame.truth });
        // Keep markers within buffer time range
        if (buf.markers.length > 50) buf.markers.shift();
      }
      buf.lastTruth = frame.truth;

      // Append samples
      for (let s = 0; s < hopSamples; s++) {
        const sampleT = frame.t - (hopSamples - 1 - s) * dt;
        const writeIdx = buf.head;

        buf.t[writeIdx] = sampleT;

        for (let c = 0; c < channelsList.length; c++) {
          const chName = channelsList[c];
          const arr = buf.channels.get(chName);
          if (arr && frame.eeg[c]) {
            arr[writeIdx] = frame.eeg[c][s] ?? 0;
          }
        }

        buf.head = (buf.head + 1) % BUFFER_CAPACITY;
        buf.count = Math.min(BUFFER_CAPACITY, buf.count + 1);
      }

      buf.lastT = frame.t;
      buf.lastWallClock = performance.now();
    });

    return () => unsubscribe();
  }, []);

  // uPlot instance management
  const uplotsRef = useRef<Map<string, uPlot>>(new Map());
  const chartRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Rebuild uPlot instances when active channels change
  useEffect(() => {
    // Destroy previous instances
    uplotsRef.current.forEach((u) => u.destroy());
    uplotsRef.current.clear();

    const chartWrapper = chartWrapperRef.current;
    if (!chartWrapper) return;

    const totalHeight = chartWrapper.clientHeight;
    const rowHeight = Math.max(18, Math.floor(totalHeight / activeChannels.length));
    const width = chartWrapper.clientWidth - 56; // 56px for channel label column

    activeChannels.forEach((ch) => {
      const rowElem = chartRowRefs.current.get(ch);
      if (!rowElem) return;

      const isC3 = ch === "C3";
      const isC4 = ch === "C4";

      const opts: uPlot.Options = {
        width: Math.max(100, width),
        height: rowHeight,
        cursor: { show: false },
        legend: { show: false },
        scales: {
          x: { time: false, auto: false },
          y: { auto: false, min: -scaleUv, max: scaleUv },
        },
        axes: [
          { show: false }, // No x-axis chrome
          { show: false }, // No y-axis chrome
        ],
        series: [
          {},
          {
            stroke: "rgba(255, 255, 255, 0.85)",
            width: 1.25,
            spanGaps: true,
          },
        ],
        hooks: {
          drawSeries: [
            (u: uPlot, sidx: number) => {
              if (sidx !== 1 || (!isC3 && !isC4)) return;
              const ctx = u.ctx;
              ctx.save();
              ctx.shadowColor = isC3 ? "#4CC9F0" : "#FFB547";
              ctx.shadowBlur = 10;
              ctx.lineWidth = 1.25;
              ctx.strokeStyle = isC3 ? "#4CC9F0" : "#FFB547";
              // Second glow pass
              const data = u.data;
              const xVals = data[0];
              const yVals = data[1];
              if (xVals && yVals && xVals.length > 1) {
                ctx.beginPath();
                let started = false;
                for (let i = 0; i < xVals.length; i++) {
                  const xv = xVals[i];
                  const yv = yVals[i];
                  if (xv != null && yv != null) {
                    const px = u.valToPos(xv, "x", true);
                    const py = u.valToPos(yv, "y", true);
                    if (!started) {
                      ctx.moveTo(px, py);
                      started = true;
                    } else {
                      ctx.lineTo(px, py);
                    }
                  }
                }
                ctx.stroke();
              }
              ctx.restore();
            },
          ],
        },
      };

      const initialData: uPlot.AlignedData = [[0, 1], [0, 0]];
      const u = new uPlot(opts, initialData, rowElem);
      uplotsRef.current.set(ch, u);
    });

    const activeUplots = uplotsRef.current;
    return () => {
      activeUplots.forEach((u) => u.destroy());
      activeUplots.clear();
    };
  }, [activeChannels, scaleUv]);

  // Update Y scales when scaleUv changes
  useEffect(() => {
    uplotsRef.current.forEach((u) => {
      u.setScale("y", { min: -scaleUv, max: scaleUv });
    });
  }, [scaleUv]);

  // Handle ResizeObserver
  useEffect(() => {
    const chartWrapper = chartWrapperRef.current;
    if (!chartWrapper) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width - 56;
        const totalHeight = entry.contentRect.height;
        const rowHeight = Math.max(18, Math.floor(totalHeight / activeChannels.length));

        uplotsRef.current.forEach((u) => {
          u.setSize({ width: Math.max(100, width), height: rowHeight });
        });

        if (overlayCanvasRef.current) {
          const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
          overlayCanvasRef.current.width = Math.round(width * dpr);
          overlayCanvasRef.current.height = Math.round(totalHeight * dpr);
          overlayCanvasRef.current.style.width = `${width}px`;
          overlayCanvasRef.current.style.height = `${totalHeight}px`;
        }
      }
    });

    observer.observe(chartWrapper);
    return () => observer.disconnect();
  }, [activeChannels]);

  // Main 60 FPS Continuous Scrolling Animation Loop
  useEffect(() => {
    let animId: number;
    let isVisible = true;

    const handleVisibility = () => {
      isVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const render = () => {
      animId = requestAnimationFrame(render);
      if (!isVisible || isPaused) return;

      const buf = bufferRef.current;
      const count = buf.count;
      if (count < 2) return;

      // Continuous wall-clock time sliding between 100ms hops
      const now = performance.now();
      const wallElapsed = (now - buf.lastWallClock) / 1000;
      // Cap extrapolation at 120ms to avoid runaway drift if stream pauses
      const extrapolatedT = buf.lastT + (isRunning ? Math.min(0.12, wallElapsed) : 0);

      const minX = extrapolatedT - timeWindow;
      const maxX = extrapolatedT;

      // Linearize circular ring buffer for uPlot
      const head = buf.head;
      const startIdx = (head - count + BUFFER_CAPACITY) % BUFFER_CAPACITY;

      // Extract time slice within [minX - 0.5, maxX + 0.1]
      const times: number[] = [];
      const bufferIndices: number[] = [];

      for (let i = 0; i < count; i++) {
        const idx = (startIdx + i) % BUFFER_CAPACITY;
        const t = buf.t[idx];
        if (t >= minX - 0.2 && t <= maxX + 0.1) {
          times.push(t);
          bufferIndices.push(idx);
        }
      }

      if (times.length < 2) return;

      // Update each uPlot chart
      activeChannels.forEach((ch) => {
        const u = uplotsRef.current.get(ch);
        const chBuf = buf.channels.get(ch);
        if (!u || !chBuf) return;

        const yVals: number[] = new Array(times.length);
        for (let i = 0; i < times.length; i++) {
          yVals[i] = chBuf[bufferIndices[i]];
        }

        u.setData([times, yVals], false);
        u.setScale("x", { min: minX, max: maxX });
      });

      // Render vertical cue markers on overlay canvas
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const ctx = overlay.getContext("2d");
        if (ctx) {
          const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
          const cssWidth = overlay.width / dpr;
          const cssHeight = overlay.height / dpr;

          ctx.save();
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          ctx.scale(dpr, dpr);

          buf.markers.forEach((marker) => {
            if (marker.t >= minX && marker.t <= maxX) {
              const xFrac = (marker.t - minX) / (maxX - minX);
              const xPos = xFrac * cssWidth;

              const isLeft = marker.truth === "left";
              const color = isLeft ? "#4CC9F0" : "#FFB547";

              ctx.strokeStyle = color;
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 4]);

              ctx.beginPath();
              ctx.moveTo(xPos, 0);
              ctx.lineTo(xPos, cssHeight);
              ctx.stroke();

              // Cue Label pill
              ctx.setLineDash([]);
              ctx.fillStyle = isLeft ? "rgba(76, 201, 240, 0.22)" : "rgba(255, 181, 71, 0.22)";
              ctx.strokeStyle = color;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(xPos + 4, 8, isLeft ? 38 : 44, 18, 4);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = color;
              ctx.font = "bold 9px Geist Mono, monospace";
              ctx.textAlign = "left";
              ctx.fillText(isLeft ? "LEFT" : "RIGHT", xPos + 9, 20);
            }
          });

          ctx.restore();
        }
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeChannels, timeWindow, scaleUv, isPaused, isRunning]);

  return (
    <GlassPanel
      variant="default"
      className={cn(
        "relative flex flex-col p-4 bg-[#0D0F12]/85 backdrop-blur-2xl border-white/10 overflow-hidden shadow-2xl",
        className
      )}
    >
      {/* Top Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-mono text-text">
            <Activity className="w-3.5 h-3.5 text-[#4CC9F0]" />
            <span className="font-semibold">{activeChannels.length} Channels</span>
          </div>

          {/* Mode Switch: Motor vs All */}
          <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-full border border-white/10">
            <button
              onClick={() => setChannelMode("motor")}
              className={cn(
                "px-3 py-0.5 rounded-full text-xs font-mono font-medium transition-colors",
                channelMode === "motor"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-muted hover:text-text"
              )}
            >
              Motor (7)
            </button>
            <button
              onClick={() => setChannelMode("all")}
              className={cn(
                "px-3 py-0.5 rounded-full text-xs font-mono font-medium transition-colors",
                channelMode === "all"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-muted hover:text-text"
              )}
            >
              All 22
            </button>
          </div>
        </div>

        {/* Right Controls: Scale Bracket, Time Window, Pause */}
        <div className="flex items-center gap-3">
          {/* Amplitude scale bracket */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-mono text-muted">
              <span>[</span>
              <span className="text-text font-medium">±{scaleUv} μV</span>
              <span>]</span>
            </div>
            <div className="w-20">
              <Slider
                value={[scaleUv]}
                min={50}
                max={300}
                step={25}
                onValueChange={(val) => setScaleUv(val[0])}
              />
            </div>
          </div>

          {/* Time window segmented pills */}
          <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-full border border-white/10">
            {[4, 8, 16].map((sec) => (
              <button
                key={sec}
                onClick={() => setTimeWindow(sec)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-mono transition-colors",
                  timeWindow === sec
                    ? "bg-white/15 text-white font-medium"
                    : "text-muted hover:text-text"
                )}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Pause Button */}
          <button
            onClick={() => setIsPaused((p) => !p)}
            className={cn(
              "p-1.5 rounded-full border transition-colors",
              isPaused
                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                : "halo-glass hover:bg-white/10 text-muted hover:text-text"
            )}
            title={isPaused ? "Resume visual trace" : "Pause visual trace"}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Stacked Waveforms Display Area */}
      <div
        ref={chartWrapperRef}
        className="relative flex-1 w-full min-h-[440px] flex flex-col justify-between pt-2 select-none"
      >
        {/* Transparent Canvas Overlay for Cue Markers */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 right-0 h-full pointer-events-none z-10"
          style={{ left: 56 }}
        />

        {activeChannels.map((ch) => {
          const isC3 = ch === "C3";
          const isC4 = ch === "C4";

          return (
            <div
              key={ch}
              className={cn(
                "relative w-full flex items-center group transition-colors",
                channelMode === "motor" ? "py-1 border-b border-white/[0.03]" : "py-0.5"
              )}
            >
              {/* Left Channel Label in Geist Mono */}
              <div className="w-14 flex items-center gap-1.5 shrink-0 select-none">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isC3 ? "bg-[#4CC9F0] shadow-[0_0_6px_#4CC9F0]" : isC4 ? "bg-[#FFB547] shadow-[0_0_6px_#FFB547]" : "bg-white/20"
                  )}
                />
                <span
                  className={cn(
                    "font-mono text-xs font-medium tracking-tight",
                    isC3 ? "text-[#4CC9F0] font-bold" : isC4 ? "text-[#FFB547] font-bold" : "text-muted group-hover:text-text"
                  )}
                >
                  {ch}
                </span>
              </div>

              {/* uPlot Chart Mount Container */}
              <div
                ref={(el) => {
                  if (el) chartRowRefs.current.set(ch, el);
                  else chartRowRefs.current.delete(ch);
                }}
                className="flex-1 overflow-hidden"
              />
            </div>
          );
        })}

        {/* Calm Illustrated Empty State (when stream is idle and no buffer samples) */}
        {!isRunning && bufferRef.current.count < 10 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center bg-[#07080A]/80 backdrop-blur-sm p-6">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-muted mb-4 shadow-sm">
              <Activity className="w-6 h-6 text-[#4CC9F0]" />
            </div>
            <h3 className="text-base font-semibold text-text mb-1.5">Stream Ready for Replay</h3>
            <p className="text-xs text-muted max-w-sm mb-5 leading-relaxed">
              Connect to the held-out BCI IV 2a session to visualize 250 Hz continuous microvolt waveforms and trial markers.
            </p>
            <Button
              onClick={() => sendHaloControl("start")}
              className="rounded-full px-6 h-10 font-semibold text-xs bg-gradient-to-r from-[#4CC9F0] to-[#FFB547] text-[#07080A] hover:opacity-90 shadow-lg flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Start Live Replay</span>
            </Button>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}
