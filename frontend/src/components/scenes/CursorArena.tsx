"use client";

import React, { useEffect, useRef, useState } from "react";
import { FrameMessage } from "@/types/halo";
import { sounds } from "@/lib/audio";
import { Navigation, Target, RotateCcw, Flame, Trophy } from "lucide-react";

interface CursorArenaProps {
  latestFrame: FrameMessage | null;
  dwellMs?: number;
  onUpdateDwell?: (ms: number) => void;
}

export function CursorArena({
  latestFrame,
  dwellMs = 600,
  onUpdateDwell,
}: CursorArenaProps) {
  // Cursor coordinates (-100 to +100 for 1D axis, centered at 0)
  const [cursorPos, setCursorPos] = useState<number>(0);
  const [dwellProgress, setDwellProgress] = useState<number>(0);
  const [activeTarget, setActiveTarget] = useState<"left" | "right">("left");
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [recentTimes, setRecentTimes] = useState<number[]>([]);
  const [acquisitionAlert, setAcquisitionAlert] = useState<string | null>(null);

  // Trajectory history for path rendering
  const trajectoryRef = useRef<number[]>([]);
  const dwellStartTimeRef = useRef<number | null>(null);
  const targetStartTimeRef = useRef<number>(Date.now());
  const velocityRef = useRef<number>(0);

  // Manual key override option for testing/judging
  const manualInputRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") manualInputRef.current = -1.0;
      if (e.key === "ArrowRight") manualInputRef.current = 1.0;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        manualInputRef.current = 0.0;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Real-time animation loop for smooth cursor physics (spring-damper)
  useEffect(() => {
    let animId: number;

    const tick = () => {
      // Intent calculation
      let intent = 0;
      if (manualInputRef.current !== 0) {
        intent = manualInputRef.current;
      } else if (latestFrame?.pred) {
        const { left, right } = latestFrame.pred;
        // Directional force: right pushes positive, left pushes negative
        intent = right - left; // range roughly -1.0 to +1.0
      }

      setCursorPos((prev) => {
        // Apply acceleration based on neural intent
        const acceleration = intent * 2.8;
        velocityRef.current = (velocityRef.current + acceleration) * 0.88; // damping factor 0.88
        let nextPos = prev + velocityRef.current;

        // Boundaries: -90 to +90
        if (nextPos < -90) {
          nextPos = -90;
          velocityRef.current = 0;
        } else if (nextPos > 90) {
          nextPos = 90;
          velocityRef.current = 0;
        }

        // Record trajectory
        const traj = trajectoryRef.current;
        traj.push(nextPos);
        if (traj.length > 80) traj.shift();

        // Check dwell in active target zone
        const inLeftTarget = activeTarget === "left" && nextPos <= -60;
        const inRightTarget = activeTarget === "right" && nextPos >= 60;

        if (inLeftTarget || inRightTarget) {
          if (dwellStartTimeRef.current === null) {
            dwellStartTimeRef.current = Date.now();
            sounds.playTick();
          }
          const elapsed = Date.now() - dwellStartTimeRef.current;
          const progress = Math.min(1.0, elapsed / dwellMs);
          setDwellProgress(progress);

          if (progress >= 1.0) {
            // TARGET ACQUIRED!
            sounds.playAcquire();
            const timeToAcquire = (Date.now() - targetStartTimeRef.current) / 1000.0;
            setRecentTimes((t) => [timeToAcquire, ...t.slice(0, 9)]);
            setScore((s) => s + 1);
            setStreak((st) => st + 1);
            setAcquisitionAlert(`${activeTarget.toUpperCase()} TARGET ACQUIRED! (${timeToAcquire.toFixed(2)}s)`);
            setTimeout(() => setAcquisitionAlert(null), 1500);

            // Switch to next opposite target
            setActiveTarget((cur) => (cur === "left" ? "right" : "left"));
            dwellStartTimeRef.current = null;
            targetStartTimeRef.current = Date.now();
            setDwellProgress(0);
          }
        } else {
          dwellStartTimeRef.current = null;
          setDwellProgress(0);
        }

        return nextPos;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [latestFrame, activeTarget, dwellMs]);

  const handleReset = () => {
    setCursorPos(0);
    velocityRef.current = 0;
    setScore(0);
    setStreak(0);
    setDwellProgress(0);
    setRecentTimes([]);
    trajectoryRef.current = [];
    setActiveTarget("left");
    targetStartTimeRef.current = Date.now();
    dwellStartTimeRef.current = null;
  };

  const avgTime =
    recentTimes.length > 0
      ? (recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length).toFixed(2)
      : "--";

  const pred = latestFrame?.pred;
  const pLeft = pred?.left ?? 0.5;
  const pRight = pred?.right ?? 0.5;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
      {/* Dominant Panel: Virtual Cursor Arena (8 cols) */}
      <div className="lg:col-span-8 flex flex-col rounded-panel p-5 halo-glass border-halo-border shadow-glass">
        {/* Panel Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-halo-surface2 border border-halo-border">
              <Navigation className="h-4 w-4 text-halo-right" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Virtual Cursor Arena</h2>
              <p className="text-[11px] text-halo-muted">
                Closed-Loop Motor Imagery Steering • Dwell-to-Select ({dwellMs} ms)
              </p>
            </div>
          </div>

          {/* Dwell Time & Reset controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-halo-surface2 px-2.5 py-1 border border-halo-border text-[11px]">
              <span className="text-halo-muted mr-1.5">Dwell:</span>
              <select
                value={dwellMs}
                onChange={(e) => onUpdateDwell && onUpdateDwell(Number(e.target.value))}
                className="bg-transparent text-white focus:outline-none cursor-pointer font-mono"
              >
                <option value={400} className="bg-halo-surface2">400 ms (Fast)</option>
                <option value={600} className="bg-halo-surface2">600 ms (Balanced)</option>
                <option value={900} className="bg-halo-surface2">900 ms (Stable)</option>
                <option value={1200} className="bg-halo-surface2">1200 ms (Deliberate)</option>
              </select>
            </div>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] bg-halo-surface2 hover:bg-halo-surface3 border border-halo-border text-halo-muted hover:text-white transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* The Assistive Interactive Arena */}
        <div className="relative w-full h-[360px] rounded-2xl border border-halo-border bg-gradient-to-b from-halo-surface to-halo-surface2 overflow-hidden flex items-center justify-center">
          {/* Grid lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]" />

          {/* Neutral Center Mark */}
          <div className="absolute top-0 bottom-0 w-px bg-white/10 left-1/2 -translate-x-1/2" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-halo-muted uppercase tracking-wider">
            Center Rest
          </div>

          {/* Left Target Zone */}
          <div
            className={`absolute left-6 top-1/2 -translate-y-1/2 w-32 h-44 rounded-2xl border flex flex-col items-center justify-center transition-all ${
              activeTarget === "left"
                ? "border-halo-left bg-halo-left/10 shadow-glowLeft scale-105"
                : "border-halo-border/60 bg-halo-surface3/40 opacity-40"
            }`}
          >
            <div className="relative flex items-center justify-center">
              {/* Dwell Progress Circular Ring */}
              {activeTarget === "left" && dwellProgress > 0 && (
                <svg className="absolute w-20 h-20 -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="transparent"
                    stroke="#4CC9F0"
                    strokeWidth="4"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={(1 - dwellProgress) * (2 * Math.PI * 34)}
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
                  activeTarget === "left"
                    ? "bg-halo-left text-black font-bold border-halo-left"
                    : "bg-halo-surface2 text-halo-muted border-halo-border"
                }`}
              >
                <Target className="h-6 w-6" />
              </div>
            </div>
            <span className="mt-2.5 text-xs font-semibold text-white">Left Target</span>
            <span className="text-[10px] text-halo-left font-mono">
              {activeTarget === "left"
                ? dwellProgress > 0
                  ? `${Math.round(dwellProgress * 100)}% Dwell`
                  : "ACTIVE"
                : "Standby"}
            </span>
          </div>

          {/* Right Target Zone */}
          <div
            className={`absolute right-6 top-1/2 -translate-y-1/2 w-32 h-44 rounded-2xl border flex flex-col items-center justify-center transition-all ${
              activeTarget === "right"
                ? "border-halo-right bg-halo-right/10 shadow-glowRight scale-105"
                : "border-halo-border/60 bg-halo-surface3/40 opacity-40"
            }`}
          >
            <div className="relative flex items-center justify-center">
              {/* Dwell Progress Circular Ring */}
              {activeTarget === "right" && dwellProgress > 0 && (
                <svg className="absolute w-20 h-20 -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="transparent"
                    stroke="#FFB547"
                    strokeWidth="4"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={(1 - dwellProgress) * (2 * Math.PI * 34)}
                    strokeLinecap="round"
                  />
                </svg>
              )}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
                  activeTarget === "right"
                    ? "bg-halo-right text-black font-bold border-halo-right"
                    : "bg-halo-surface2 text-halo-muted border-halo-border"
                }`}
              >
                <Target className="h-6 w-6" />
              </div>
            </div>
            <span className="mt-2.5 text-xs font-semibold text-white">Right Target</span>
            <span className="text-[10px] text-halo-right font-mono">
              {activeTarget === "right"
                ? dwellProgress > 0
                  ? `${Math.round(dwellProgress * 100)}% Dwell`
                  : "ACTIVE"
                : "Standby"}
            </span>
          </div>

          {/* Historical Neural Trajectory Trail */}
          <div className="absolute inset-x-8 top-1/2 h-1 bg-white/5 -translate-y-1/2 pointer-events-none">
            {trajectoryRef.current.map((pos, idx) => {
              const alpha = (idx / trajectoryRef.current.length) * 0.45;
              const leftPercent = 50 + (pos / 100) * 45;
              return (
                <div
                  key={idx}
                  className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${leftPercent}%`,
                    top: "50%",
                    backgroundColor: pos < 0 ? "#4CC9F0" : "#FFB547",
                    opacity: alpha,
                  }}
                />
              );
            })}
          </div>

          {/* The Assistive Neural Cursor */}
          <div
            className="absolute top-1/2 -translate-y-1/2 z-20 transition-transform duration-75"
            style={{
              left: `${50 + (cursorPos / 100) * 45}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="relative flex items-center justify-center">
              {/* Outer Pulse Ring */}
              <div
                className={`absolute w-12 h-12 rounded-full border animate-ping opacity-25 ${
                  cursorPos < 0 ? "border-halo-left" : "border-halo-right"
                }`}
              />
              {/* Main Cursor Core */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-colors border-2 ${
                  cursorPos < 0
                    ? "bg-halo-left border-white text-black shadow-glowLeft"
                    : "bg-halo-right border-white text-black shadow-glowRight"
                }`}
              >
                <Navigation className="h-4 w-4 fill-current transform -rotate-45" />
              </div>
            </div>
          </div>

          {/* Acquisition Banner Popup */}
          {acquisitionAlert && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-halo-success/20 border border-halo-success text-halo-success text-xs font-bold tracking-wide backdrop-blur-md shadow-lg animate-in fade-in zoom-in-95">
              {acquisitionAlert}
            </div>
          )}

          {/* Bottom status text */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-halo-muted font-mono">
            <span>Intent Force: {((pRight - pLeft) * 100).toFixed(0)}%</span>
            <span>Manual Override: Left/Right Arrow Keys</span>
          </div>
        </div>

        {/* Bottom Neuro-Control Bar */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-halo-surface2 border border-halo-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-halo-muted block">Left Hand Imagery (Push Left)</span>
              <span className="text-sm font-semibold text-halo-left num-font">{(pLeft * 100).toFixed(1)}%</span>
            </div>
            <div className="h-8 w-1 rounded-full bg-halo-left" />
          </div>

          <div className="p-3 rounded-xl bg-halo-surface2 border border-halo-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-halo-muted block">Right Hand Imagery (Push Right)</span>
              <span className="text-sm font-semibold text-halo-right num-font">{(pRight * 100).toFixed(1)}%</span>
            </div>
            <div className="h-8 w-1 rounded-full bg-halo-right" />
          </div>
        </div>
      </div>

      {/* Side Bento Panels: Task Performance & Telemetry (4 cols) */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        {/* Score & Acquisition Scorecard */}
        <div className="rounded-panel p-5 halo-glass border-halo-border shadow-glass flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-halo-surface2 border border-halo-border">
                <Trophy className="h-4 w-4 text-halo-right" />
              </div>
              <h3 className="text-sm font-semibold text-white">Assistive Task Telemetry</h3>
            </div>
            {streak > 1 && (
              <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-halo-right/15 text-halo-right border border-halo-right/30">
                <Flame className="h-3 w-3" />
                <span>{streak} Streak</span>
              </div>
            )}
          </div>

          {/* Main Target Counter */}
          <div className="p-4 rounded-xl bg-halo-surface2 border border-halo-border mb-4 text-center">
            <span className="text-[11px] font-mono uppercase text-halo-muted tracking-wider block">
              Targets Acquired
            </span>
            <span className="text-4xl font-extrabold text-white num-font tracking-tight mt-1 block">
              {score}
            </span>
          </div>

          {/* Performance Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
            <div className="p-3 rounded-xl bg-halo-surface2 border border-halo-border">
              <span className="text-[10px] text-halo-muted block">Avg Time to Target</span>
              <span className="text-base font-bold text-white num-font mt-0.5 block">{avgTime}s</span>
            </div>
            <div className="p-3 rounded-xl bg-halo-surface2 border border-halo-border">
              <span className="text-[10px] text-halo-muted block">Active Dwell Budget</span>
              <span className="text-base font-bold text-white num-font mt-0.5 block">{dwellMs} ms</span>
            </div>
          </div>

          {/* Recent Trial Times Table */}
          <div>
            <span className="text-[11px] font-medium text-white mb-2 block">Recent Acquisitions</span>
            {recentTimes.length === 0 ? (
              <p className="text-[11px] text-halo-muted italic py-2">
                Steer the cursor into the highlighted target to record dwell acquisitions.
              </p>
            ) : (
              <div className="space-y-1.5">
                {recentTimes.slice(0, 4).map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-halo-surface3 border border-halo-border text-[11px]"
                  >
                    <span className="text-halo-muted">Attempt #{score - idx}</span>
                    <span className="text-halo-success font-mono font-medium">{t.toFixed(2)}s</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Clinical Application Context */}
        <div className="rounded-panel p-5 halo-glass border-halo-border shadow-glass flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-semibold text-white mb-1.5">Assistive Rehabilitation Impact</h4>
            <p className="text-[11px] text-halo-muted leading-relaxed">
              Virtual cursor acquisition provides neurofeedback for post-stroke hemiparesis rehabilitation and serves as a continuous intent driver for robotic arm prosthetics.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-halo-border/80 flex items-center justify-between text-[11px] text-halo-muted">
            <span>Damping Factor: 0.88</span>
            <span>Update Rate: 60 FPS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
