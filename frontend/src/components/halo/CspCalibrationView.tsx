"use client";

import React, { useEffect, useState, useCallback } from "react";
import { GlassPanel } from "./GlassPanel";
import { Pill, SectionLabel } from "./Primitives";
import montage2D from "@/lib/montage_2d.json";
import { Cpu, CheckCircle2 } from "lucide-react";

interface CspApiResponse {
  subject: number;
  channels: string[];
  left_pattern: Record<string, number>;
  right_pattern: Record<string, number>;
  left_weights: number[];
  right_weights: number[];
  trial_accuracy: number;
  trial_kappa: number;
}

interface MiniTopomapProps {
  title: string;
  pattern: Record<string, number>;
  accentColor: string;
}

function MiniTopomap({ title, pattern, accentColor }: MiniTopomapProps) {
  const montage = montage2D as Record<
    string,
    { x: number; y: number; rx: number; ry: number }
  >;

  // Find min and max weight to normalize
  const weights = Object.values(pattern);
  const maxAbs = Math.max(...weights.map((w) => Math.abs(w)), 0.001);

  return (
    <div className="flex flex-col items-center p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex-1">
      <span className="text-xs font-mono font-semibold mb-2" style={{ color: accentColor }}>
        {title}
      </span>

      {/* SVG Head Topomap */}
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          {/* Outer Head Contour */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1.2"
          />

          {/* Nose triangle */}
          <polygon
            points="46,8 54,8 50,2"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.2"
          />

          {/* Left Ear */}
          <path
            d="M 8,44 Q 4,50 8,56"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.2"
          />

          {/* Right Ear */}
          <path
            d="M 92,44 Q 96,50 92,56"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1.2"
          />

          {/* Electrodes */}
          {Object.entries(montage).map(([ch, pos]) => {
            const weight = pattern[ch] ?? 0;
            const norm = weight / maxAbs; // -1 to 1
            const cx = pos.x * 100;
            const cy = pos.y * 100;

            // Highlight C3 and C4
            const isMotor = ch === "C3" || ch === "C4";
            const radius = isMotor ? 3.5 : 2.5;

            // Color based on positive or negative weight
            const fill =
              norm >= 0
                ? accentColor
                : "rgba(255, 255, 255, 0.3)";
            const opacity = Math.max(0.25, Math.abs(norm));

            return (
              <g key={ch} className="transition-all duration-300">
                {/* Glow ring for motor electrodes */}
                {isMotor && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius + 2}
                    fill={accentColor}
                    opacity={0.3}
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={fill}
                  opacity={opacity}
                  stroke={isMotor ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)"}
                  strokeWidth={isMotor ? 0.8 : 0.4}
                />
                <text
                  x={cx}
                  y={cy + 5.5}
                  fontSize="4"
                  fontFamily="monospace"
                  fill={isMotor ? "#FFFFFF" : "#8A919C"}
                  textAnchor="middle"
                  className="select-none pointer-events-none"
                  fontWeight={isMotor ? "bold" : "normal"}
                >
                  {ch}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between w-full text-[10px] font-mono text-muted mt-2 border-t border-white/5 pt-1.5 px-2">
        <span>Weights max: {maxAbs.toFixed(3)}</span>
        <span>C3 &amp; C4 motor</span>
      </div>
    </div>
  );
}

export function CspCalibrationView({
  currentSubject = 1,
  onSubjectChange,
}: {
  currentSubject?: number;
  onSubjectChange?: (sub: number) => void;
}) {
  const [selectedSubject, setSelectedSubject] = useState(currentSubject);
  const [calibrating, setCalibrating] = useState(false);
  const [cspData, setCspData] = useState<CspApiResponse | null>(null);
  const [progress, setProgress] = useState(0);

  const runCalibration = useCallback(async (sub: number) => {
    setSelectedSubject(sub);
    setCalibrating(true);
    setProgress(0);

    // 2-second calibration animation
    const startTime = Date.now();
    const duration = 2000;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(timer);
      }
    }, 40);

    try {
      const res = await fetch(`http://localhost:8000/api/csp/${sub}`);
      if (res.ok) {
        const data = await res.json();
        // Wait full 2 seconds for animation experience
        setTimeout(() => {
          setCspData(data);
          setCalibrating(false);
          if (onSubjectChange) onSubjectChange(sub);
        }, Math.max(0, duration - (Date.now() - startTime)));
      } else {
        // Fallback demo weights if backend offline
        setTimeout(() => {
          setCalibrating(false);
        }, duration);
      }
    } catch {
      setTimeout(() => {
        setCalibrating(false);
      }, duration);
    }
  }, [onSubjectChange]);

  useEffect(() => {
    runCalibration(currentSubject);
  }, [currentSubject, runCalibration]);

  return (
    <GlassPanel variant="default" className="p-6 border-white/10 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SectionLabel icon={<Cpu className="w-3.5 h-3.5 text-purple-400" />}>
              What The Model Learned
            </SectionLabel>
            <Pill variant="glass" size="sm" className="font-mono text-[10px]">
              Spatial Filters
            </Pill>
          </div>
          <h3 className="text-base font-semibold text-text tracking-tight">
            Common Spatial Pattern (CSP) Topographies
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Eigenvector spatial decomposition highlighting contralateral sensorimotor cortex activations.
          </p>
        </div>

        {/* Subject selector pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-muted uppercase mr-1">Subject:</span>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((sub) => (
            <button
              key={sub}
              type="button"
              disabled={calibrating}
              onClick={() => runCalibration(sub)}
              className={`w-7 h-7 rounded-full text-xs font-mono transition-all flex items-center justify-center ${
                selectedSubject === sub
                  ? "bg-[#4CC9F0] text-[#07080A] font-bold shadow-[0_0_10px_rgba(76,201,240,0.6)]"
                  : "text-muted hover:text-text hover:bg-white/10"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {/* Calibration Animation Overlay */}
      {calibrating && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-cyan-400/40 animate-ping" />
            <span className="w-12 h-12 rounded-full border-2 border-dashed border-cyan-400 animate-spin" />
            <Cpu className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-text">
              Fitting decoder for Subject {selectedSubject}...
            </h4>
            <p className="text-xs text-muted font-mono">
              Optimizing Common Spatial Patterns (CSP) on Session 1 trials ({progress}%)
            </p>
          </div>
          <div className="w-64 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4CC9F0] to-[#FFB547] transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Topomap Results */}
      {!calibrating && cspData && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-mono text-muted">
              What the model learned: left-hand vs right-hand
            </span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                Held-Out Accuracy: {(cspData.trial_accuracy * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] font-mono text-muted">
                (κ = {cspData.trial_kappa.toFixed(3)})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MiniTopomap
              title="Left-Hand Motor Imagery (Component 1)"
              pattern={cspData.left_pattern}
              accentColor="#4CC9F0"
            />
            <MiniTopomap
              title="Right-Hand Motor Imagery (Component 22)"
              pattern={cspData.right_pattern}
              accentColor="#FFB547"
            />
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
