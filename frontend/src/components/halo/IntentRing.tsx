"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useHaloStore } from "@/lib/store";
import { useIntent, IntentFiredEvent } from "@/lib/useIntent";
import { GlassPanel } from "./GlassPanel";
import { StatNumber } from "./StatNumber";
import { SectionLabel } from "./Primitives";
import { Check, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IntentRingProps {
  onFired?: (event: IntentFiredEvent) => void;
  className?: string;
}

export function IntentRing({ onFired, className }: IntentRingProps) {
  const latestFrame = useHaloStore((state) => state.latestFrame);
  const config = useHaloStore((state) => state.config);
  const frameHistory = useHaloStore((state) => state.frameHistory);

  const threshold = config.threshold ?? 0.65;
  const truth = latestFrame?.truth ?? null;
  const latency = latestFrame?.pred?.latency_ms ?? 14.2;

  // Use the shared intent hook
  const { label, confidence, pLeft, pRight, armed, dwellProgress, fired } = useIntent(onFired);

  // Geometry constants
  const size = 280;
  const center = size / 2; // 140
  const radius = 105;
  const halfArcLength = Math.PI * radius; // ~329.87

  // Dwell outer ring
  const dwellRadius = 124;
  const dwellPerimeter = 2 * Math.PI * dwellRadius; // ~779.11

  // Threshold tick angles
  // Top is -pi/2
  const leftTickAngle = -Math.PI / 2 - Math.PI * threshold;
  const rightTickAngle = -Math.PI / 2 + Math.PI * threshold;

  const leftTick = {
    x1: center + (radius - 8) * Math.cos(leftTickAngle),
    y1: center + (radius - 8) * Math.sin(leftTickAngle),
    x2: center + (radius + 8) * Math.cos(leftTickAngle),
    y2: center + (radius + 8) * Math.sin(leftTickAngle),
  };

  const rightTick = {
    x1: center + (radius - 8) * Math.cos(rightTickAngle),
    y1: center + (radius - 8) * Math.sin(rightTickAngle),
    x2: center + (radius + 8) * Math.cos(rightTickAngle),
    y2: center + (radius + 8) * Math.sin(rightTickAngle),
  };

  // Sparkline of last 60 latencies
  const latencySparkline = useMemo(() => {
    const recent = frameHistory.slice(-60).map((f) => f.pred?.latency_ms ?? 15);
    if (recent.length < 2) return "";
    const minVal = Math.min(...recent, 5);
    const maxVal = Math.max(...recent, 30);
    const range = maxVal - minVal || 1;
    const w = 110;
    const h = 20;

    return recent
      .map((val, idx) => {
        const x = (idx / (recent.length - 1)) * w;
        const y = h - ((val - minVal) / range) * (h - 2) - 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [frameHistory]);

  const matchesCue = truth !== null && label === truth;

  return (
    <GlassPanel
      variant="default"
      className={cn(
        "relative flex flex-col items-center justify-between p-5 bg-[#0D0F12]/85 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden",
        className
      )}
    >
      <div className="w-full flex items-center justify-between mb-1">
        <SectionLabel icon={<Zap className="w-3.5 h-3.5 text-[#4CC9F0]" />}>
          Decoded Motor Intent
        </SectionLabel>
        <span className="text-[10.5px] font-mono text-muted/70">
          Threshold: {(threshold * 100).toFixed(0)}%
        </span>
      </div>

      {/* Main Responsive Intent Ring (viewBox 280x280) */}
      <div className="relative w-[250px] h-[250px] flex items-center justify-center my-auto select-none">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Glowing filter for armed pulses */}
            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="amberGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Arc Tracks */}
          <path
            d={`M ${center} ${center - radius} A ${radius} ${radius} 0 0 0 ${center} ${center + radius}`}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d={`M ${center} ${center - radius} A ${radius} ${radius} 0 0 1 ${center} ${center + radius}`}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Left Intent Arc (Cyan) */}
          <motion.path
            d={`M ${center} ${center - radius} A ${radius} ${radius} 0 0 0 ${center} ${center + radius}`}
            fill="none"
            stroke="#4CC9F0"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={halfArcLength}
            animate={{
              strokeDashoffset: halfArcLength * (1 - Math.min(1.0, pLeft)),
              filter: armed && label === "left" ? "url(#cyanGlow)" : "none",
              opacity: armed && label === "left" ? 1.0 : 0.75,
            }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          />

          {/* Right Intent Arc (Amber) */}
          <motion.path
            d={`M ${center} ${center - radius} A ${radius} ${radius} 0 0 1 ${center} ${center + radius}`}
            fill="none"
            stroke="#FFB547"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={halfArcLength}
            animate={{
              strokeDashoffset: halfArcLength * (1 - Math.min(1.0, pRight)),
              filter: armed && label === "right" ? "url(#amberGlow)" : "none",
              opacity: armed && label === "right" ? 1.0 : 0.75,
            }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          />

          {/* Threshold Ticks */}
          <line
            x1={leftTick.x1}
            y1={leftTick.y1}
            x2={leftTick.x2}
            y2={leftTick.y2}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1={rightTick.x1}
            y1={rightTick.y1}
            x2={rightTick.x2}
            y2={rightTick.y2}
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Outer Dwell Ring Track */}
          <circle
            cx={center}
            cy={center}
            r={dwellRadius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.04)"
            strokeWidth="2.5"
          />

          {/* Outer Dwell Ring Fill (Clockwise from 12 o'clock) */}
          <motion.circle
            cx={center}
            cy={center}
            r={dwellRadius}
            fill="none"
            stroke={label === "left" ? "#4CC9F0" : label === "right" ? "#FFB547" : "#FFFFFF"}
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            strokeDasharray={dwellPerimeter}
            animate={{
              strokeDashoffset: dwellPerimeter * (1 - dwellProgress),
              opacity: dwellProgress > 0 ? 1 : 0,
            }}
            transition={{ duration: 0.05, ease: "linear" }}
          />

          {/* Firing flash indicator */}
          {fired && (
            <motion.circle
              cx={center}
              cy={center}
              r={dwellRadius}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4"
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 1.06 }}
              transition={{ duration: 0.35 }}
            />
          )}
        </svg>

        {/* Center Readout Capsule */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {/* Decoded Label */}
          <div
            className={cn(
              "text-3xl font-bold tracking-tight font-sans transition-all duration-200",
              !armed
                ? "text-muted/50"
                : label === "left"
                ? "text-[#4CC9F0] drop-shadow-[0_0_12px_rgba(76,201,240,0.6)]"
                : "text-[#FFB547] drop-shadow-[0_0_12px_rgba(255,181,71,0.6)]"
            )}
          >
            {armed ? label?.toUpperCase() : "—"}
          </div>

          {/* Confidence StatNumber */}
          <StatNumber
            value={confidence * 100}
            decimals={1}
            unit="%"
            size="md"
            valueClassName="font-bold text-text text-xl"
            className="items-center"
          />

          {/* Cue Match Line */}
          <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono">
            <span className="text-muted/70">cue:</span>
            {truth ? (
              <span className="font-semibold text-text uppercase flex items-center gap-1">
                {truth}
                {matchesCue ? (
                  <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                ) : (
                  <X className="w-3 h-3 text-rose-400 stroke-[3]" />
                )}
              </span>
            ) : (
              <span className="text-muted/50">none</span>
            )}
          </div>
        </div>
      </div>

      {/* Latency & Micro-Sparkline Footer */}
      <div className="w-full flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Latency
          </span>
          <span className="text-xs font-mono font-bold text-text tabular-nums">
            {latency.toFixed(1)} ms
          </span>
        </div>

        {/* 60-frame sparkline */}
        <div className="flex items-center gap-1">
          <svg width="110" height="20" className="overflow-visible">
            {latencySparkline && (
              <polyline
                fill="none"
                stroke="rgba(76, 201, 240, 0.7)"
                strokeWidth="1.25"
                points={latencySparkline}
              />
            )}
          </svg>
        </div>
      </div>
    </GlassPanel>
  );
}
