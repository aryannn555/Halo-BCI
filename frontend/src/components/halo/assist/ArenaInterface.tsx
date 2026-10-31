"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "../GlassPanel";
import { SectionLabel, Pill } from "../Primitives";
import { StatNumber } from "../StatNumber";
import { Crosshair, RotateCcw, Target as TargetIcon, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DecisionRecord } from "@/lib/useDecisions";

const NUM_SLOTS = 7;
const CENTER_SLOT = 3;

export interface ArenaInterfaceProps {
  onDecisionFired?: (record: DecisionRecord) => void;
  registerIntendedProvider?: (provider: () => "left" | "right" | null) => void;
  className?: string;
}

export function ArenaInterface({
  registerIntendedProvider,
  className,
}: ArenaInterfaceProps) {
  const [cursor, setCursor] = useState<number>(CENTER_SLOT);
  const [startSlot, setStartSlot] = useState<number>(CENTER_SLOT);
  const [target, setTarget] = useState<number>(5);
  const [stepsTaken, setStepsTaken] = useState<number>(0);
  const [targetsCompleted, setTargetsCompleted] = useState<number>(0);
  const [trail, setTrail] = useState<number[]>([]);
  const [lastFlash, setLastFlash] = useState<"left" | "right" | null>(null);
  const [isBursting, setIsBursting] = useState<boolean>(false);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const targetRef = useRef(target);
  targetRef.current = target;

  // Intended direction provider for the simulated auto user
  const getIntendedDirection = useCallback((): "left" | "right" | null => {
    const cur = cursorRef.current;
    const tgt = targetRef.current;
    if (cur < tgt) return "right";
    if (cur > tgt) return "left";
    return null;
  }, []);

  useEffect(() => {
    registerIntendedProvider?.(getIntendedDirection);
  }, [registerIntendedProvider, getIntendedDirection]);

  // Handle incoming decision to move cursor
  const handleDecision = useCallback((decision: "left" | "right") => {
    setLastFlash(decision);
    setTimeout(() => setLastFlash(null), 350);

    setCursor((prev) => {
      setTrail((t) => [prev, ...t].slice(0, 3));
      const next = decision === "left" ? Math.max(0, prev - 1) : Math.min(NUM_SLOTS - 1, prev + 1);
      return next;
    });

    setStepsTaken((s) => s + 1);
  }, []);

  useEffect(() => {
    (window as unknown as { __arenaHandleDecision?: (d: "left" | "right") => void }).__arenaHandleDecision = handleDecision;
    return () => {
      delete (window as unknown as { __arenaHandleDecision?: unknown }).__arenaHandleDecision;
    };
  }, [handleDecision]);

  // Check if cursor reached target
  useEffect(() => {
    if (cursor === target) {
      setIsBursting(true);
      setTargetsCompleted((c) => c + 1);

      const timer = setTimeout(() => {
        setIsBursting(false);
        let nextTgt = Math.floor(Math.random() * NUM_SLOTS);
        while (nextTgt === cursor) {
          nextTgt = Math.floor(Math.random() * NUM_SLOTS);
        }
        setStartSlot(cursor);
        setTarget(nextTgt);
        setStepsTaken(0);
        setTrail([]);
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [cursor, target]);

  const optimalSteps = Math.max(1, Math.abs(startSlot - target));
  const efficiency = Math.min(100, Math.round((optimalSteps / Math.max(optimalSteps, stepsTaken)) * 100));

  const handleResetArena = () => {
    setCursor(CENTER_SLOT);
    setStartSlot(CENTER_SLOT);
    setTarget(5);
    setStepsTaken(0);
    setTrail([]);
    setIsBursting(false);
  };

  return (
    <GlassPanel
      variant="hero"
      className={cn(
        "relative flex flex-col justify-between p-6 bg-[#0D0F12]/85 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden min-h-[520px]",
        className
      )}
    >
      {/* Top Arena Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <SectionLabel icon={<Crosshair className="w-3.5 h-3.5 text-[#4CC9F0]" />}>
            Virtual Cursor Arena
          </SectionLabel>
          <Pill variant="cyan" size="sm">
            1D Motor Control
          </Pill>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-muted">
            <span>Targets Reached:</span>
            <span className="font-bold text-text">{targetsCompleted}</span>
          </div>

          <div className="h-4 w-[1px] bg-white/10" />

          <button
            onClick={handleResetArena}
            aria-label="Reset Arena Simulation"
            className="flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-muted hover:text-text border border-white/10 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Track Stage (Vertically Centered) */}
      <div className="flex-1 flex flex-col items-center justify-center py-6 select-none relative">
        {/* Directional Decision Flash Aura */}
        <AnimatePresence>
          {lastFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.18 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "absolute inset-4 rounded-3xl pointer-events-none filter blur-3xl",
                lastFlash === "left" ? "bg-[#4CC9F0]" : "bg-[#FFB547]"
              )}
            />
          )}
        </AnimatePresence>

        {/* Horizontal Slot Track (Enhanced with lane dividers and depth highlight) */}
        <div className="relative w-full max-w-2xl px-6 py-8 rounded-3xl bg-black/60 border border-white/10 flex items-center justify-between gap-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] backdrop-blur-md">
          {Array.from({ length: NUM_SLOTS }).map((_, slotIdx) => {
            const isCursor = cursor === slotIdx;
            const isTarget = target === slotIdx;
            const isTrail = trail.includes(slotIdx) && !isCursor;
            const trailIndex = trail.indexOf(slotIdx);

            return (
              <div
                key={slotIdx}
                className={cn(
                  "relative flex-1 h-28 rounded-2xl flex flex-col items-center justify-center border transition-all duration-300",
                  isTarget
                    ? "border-white/90 bg-white/[0.09] shadow-[0_0_28px_rgba(255,255,255,0.3)] ring-1 ring-white/70"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                )}
              >
                {/* Target Pin Marker */}
                {isTarget && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: -4 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="absolute -top-3.5 px-2.5 py-0.5 rounded-full bg-white text-[#07080A] text-[9.5px] font-mono font-bold tracking-wider flex items-center gap-1 shadow-lg ring-1 ring-white/50"
                  >
                    <TargetIcon className="w-2.5 h-2.5 stroke-[3] text-black" />
                    <span>TARGET</span>
                  </motion.div>
                )}

                {/* Slot index caption */}
                <span className="text-[10px] font-mono text-muted/30 absolute bottom-2">
                  {slotIdx === CENTER_SLOT ? "MID" : `S${slotIdx}`}
                </span>

                {/* Fading Trail Orb */}
                {isTrail && (
                  <motion.div
                    initial={{ opacity: 0.45, scale: 0.8 }}
                    animate={{ opacity: Math.max(0.08, 0.45 - trailIndex * 0.16), scale: 0.65 }}
                    className="w-10 h-10 rounded-full bg-white/25 filter blur-sm pointer-events-none"
                  />
                )}

                {/* Glowing Orb Cursor */}
                {isCursor && (
                  <motion.div
                    layoutId="arenaCursorOrb"
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className={cn(
                      "relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl z-20 transition-all",
                      lastFlash === "left"
                        ? "bg-[#4CC9F0] shadow-[0_0_32px_#4CC9F0]"
                        : lastFlash === "right"
                        ? "bg-[#FFB547] shadow-[0_0_32px_#FFB547]"
                        : "bg-gradient-to-tr from-white to-sky-100 shadow-[0_0_26px_rgba(255,255,255,0.8)]"
                    )}
                  >
                    {/* Inner core pulse */}
                    <div className="w-5 h-5 rounded-full bg-white shadow-inner animate-pulse" />

                    {/* Target Arrival Burst Wave */}
                    {isBursting && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 1 }}
                        animate={{ scale: 3.8, opacity: 0 }}
                        transition={{ duration: 0.65, ease: "easeOut" }}
                        className="absolute inset-0 rounded-full border-2 border-white pointer-events-none"
                      />
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* Directional Navigation Indicators (Directly Under Track) */}
        <div className="w-full max-w-2xl flex items-center justify-between px-4 mt-5 text-xs font-mono select-none">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#4CC9F0]/10 border border-[#4CC9F0]/20 text-[#4CC9F0]">
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="font-semibold">Left Motor Imagery</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFB547]/10 border border-[#FFB547]/20 text-[#FFB547]">
            <span className="font-semibold">Right Motor Imagery</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        </div>
      </div>

      {/* Bottom Performance Metrics Bar */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5 select-none">
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm">
          <span className="text-xs font-mono text-muted">Steps Taken</span>
          <StatNumber
            value={stepsTaken}
            decimals={0}
            size="sm"
            valueClassName="font-mono font-bold text-text text-sm"
          />
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm">
          <span className="text-xs font-mono text-muted">Optimal Path</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-mono font-bold text-text">{optimalSteps}</span>
            <span className="text-[10px] font-mono text-muted">slots</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-sm">
          <span className="text-xs font-mono text-muted">Efficiency</span>
          <StatNumber
            value={efficiency}
            decimals={0}
            unit="%"
            size="sm"
            valueClassName={cn(
              "font-mono font-bold text-sm",
              efficiency >= 80 ? "text-emerald-400" : efficiency >= 50 ? "text-amber-400" : "text-rose-400"
            )}
          />
        </div>
      </div>
    </GlassPanel>
  );
}
