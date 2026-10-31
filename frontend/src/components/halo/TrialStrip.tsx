"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHaloStore } from "@/lib/store";
import { GlassPanel } from "./GlassPanel";
import { StatNumber } from "./StatNumber";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompletedTrialRecord {
  trialNumber: number;
  cue: "left" | "right";
  correct: boolean;
  confidence: number;
}

export function TrialStrip({ className }: { className?: string }) {
  const latestFrame = useHaloStore((state) => state.latestFrame);
  const status = useHaloStore((state) => state.status);

  const [completedTrials, setCompletedTrials] = useState<CompletedTrialRecord[]>([]);

  // Accumulate predictions for current trial to compute the final 1s smoothed decision
  const currentTrialRef = useRef<{
    trial: number;
    cue: "left" | "right" | null;
    predictions: { left: number; right: number }[];
  }>({
    trial: 0,
    cue: null,
    predictions: [],
  });

  // Reset tracking when stream transitions to idle
  useEffect(() => {
    if (status?.state === "idle") {
      currentTrialRef.current = { trial: 0, cue: null, predictions: [] };
    }
  }, [status?.state]);

  useEffect(() => {
    if (!latestFrame) return;

    const cur = currentTrialRef.current;
    const frameTrial = latestFrame.trial;
    const frameCue = latestFrame.truth;

    // Condition A: Active trial imagery period just ended (transitioned from cue to rest null)
    // or jumped to a different trial with an active cue left uncommitted
    const activeTrialEnded =
      (frameCue === null && cur.cue !== null && cur.predictions.length >= 5) ||
      (frameTrial !== cur.trial && cur.cue !== null && cur.predictions.length >= 5);

    if (activeTrialEnded && cur.cue !== null) {
      // Evaluate final 1.0s window of the motor imagery epoch (last 10 frames at 100ms hop)
      const last1s = cur.predictions.slice(-10);
      const avgLeft = last1s.reduce((sum, p) => sum + p.left, 0) / last1s.length;
      const avgRight = last1s.reduce((sum, p) => sum + p.right, 0) / last1s.length;

      const predictedClass = avgLeft >= avgRight ? "left" : "right";
      const isCorrect = predictedClass === cur.cue;
      const targetConfidence = cur.cue === "left" ? avgLeft : avgRight;

      const record: CompletedTrialRecord = {
        trialNumber: cur.trial,
        cue: cur.cue,
        correct: isCorrect,
        confidence: targetConfidence,
      };

      setCompletedTrials((prev) => {
        const filtered = prev.filter((t) => t.trialNumber !== cur.trial);
        return [...filtered, record].slice(-24); // Keep last 24 trials
      });

      // Clear trial tracking
      cur.cue = null;
      cur.predictions = [];
    }

    // Condition B: In active imagery trial (truth is "left" or "right")
    if (frameCue !== null) {
      cur.trial = frameTrial;
      cur.cue = frameCue;
      if (latestFrame.pred) {
        cur.predictions.push({
          left: latestFrame.pred.left,
          right: latestFrame.pred.right,
        });
      }
    }
  }, [latestFrame]);

  // Compute running accuracy
  const totalCompleted = completedTrials.length;
  const correctCount = completedTrials.filter((t) => t.correct).length;
  const runningAccuracy = totalCompleted > 0 ? (correctCount / totalCompleted) * 100 : 100;
  const currentTrialNumber = latestFrame?.trial ?? 0;

  return (
    <GlassPanel
      variant="default"
      className={cn(
        "p-3 px-5 bg-[#0D0F12]/85 backdrop-blur-xl border-white/10 flex items-center justify-between gap-6 shadow-xl overflow-hidden",
        className
      )}
    >
      {/* Left Column: Running Accuracy & Trial Count */}
      <div className="flex items-center gap-6 shrink-0 select-none">
        <div className="flex items-baseline gap-2">
          <StatNumber
            value={runningAccuracy}
            decimals={1}
            unit="%"
            label="Live Accuracy"
            size="sm"
            valueClassName="font-mono text-base font-bold text-text"
          />
        </div>

        <div className="h-6 w-[1px] bg-white/10" />

        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Evaluation Progress
          </span>
          <span className="text-xs font-mono font-medium text-text">
            Trial {currentTrialNumber} / 144
          </span>
        </div>
      </div>

      {/* Right Column: Scrollable Compact Trial Chips (Newest on the right) */}
      <div className="flex-1 flex items-center justify-end gap-1.5 overflow-x-auto py-1 scrollbar-none">
        {totalCompleted === 0 ? (
          <div className="text-xs font-mono text-muted/60 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
            <span>Streaming trials... decisions will populate after each epoch</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {completedTrials.map((t) => {
              const isLeft = t.cue === "left";
              return (
                <motion.div
                  key={`${t.trialNumber}-${t.cue}`}
                  initial={{ opacity: 0, x: 20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-mono shrink-0 border shadow-sm transition-all",
                    t.correct
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                  )}
                  title={`Trial ${t.trialNumber} (${t.cue.toUpperCase()}): ${t.correct ? "CORRECT" : "INCORRECT"} (${(t.confidence * 100).toFixed(0)}%)`}
                >
                  {/* Cue indicator dot */}
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      isLeft ? "bg-[#4CC9F0] shadow-[0_0_6px_#4CC9F0]" : "bg-[#FFB547] shadow-[0_0_6px_#FFB547]"
                    )}
                  />

                  {/* Trial number */}
                  <span className="text-[11px] font-bold text-text">
                    T{t.trialNumber}
                  </span>

                  {/* Check / Cross */}
                  {t.correct ? (
                    <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                  ) : (
                    <X className="w-3 h-3 text-rose-400 stroke-[3]" />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </GlassPanel>
  );
}
