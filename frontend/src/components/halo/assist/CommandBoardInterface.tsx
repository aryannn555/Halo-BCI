"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "../GlassPanel";
import { SectionLabel, Pill } from "../Primitives";
import {
  HeartHandshake,
  CheckCircle,
  XCircle,
  Droplet,
  AlertTriangle,
  Lightbulb,
  PhoneCall,
  Activity,
  Check,
  CheckCheck,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildCommandTree, findLeaf } from "@/lib/huffman";

const COMMANDS = [
  { id: "Yes", label: "Yes", icon: CheckCircle, category: "confirm", color: "emerald" },
  { id: "No", label: "No", icon: XCircle, category: "deny", color: "rose" },
  { id: "Water", label: "Water", icon: Droplet, category: "care", color: "cyan" },
  { id: "Help", label: "Help", icon: AlertTriangle, category: "urgent", color: "amber" },
  { id: "Lights", label: "Lights", icon: Lightbulb, category: "ambient", color: "amber" },
  { id: "Call family", label: "Call Family", icon: PhoneCall, category: "social", color: "cyan" },
  { id: "Pain", label: "Pain", icon: Activity, category: "urgent", color: "rose" },
  { id: "Done", label: "Done", icon: Check, category: "confirm", color: "emerald" },
];

export interface CommandBoardInterfaceProps {
  registerIntendedProvider?: (provider: () => "left" | "right" | null) => void;
  className?: string;
}

export function CommandBoardInterface({
  registerIntendedProvider,
  className,
}: CommandBoardInterfaceProps) {
  const [targetCommand, setTargetCommand] = useState<string>("Water");
  const [navPath, setNavPath] = useState<("left" | "right")[]>([]);
  const [confirmedCommand, setConfirmedCommand] = useState<string | null>(null);
  const [totalExecuted, setTotalExecuted] = useState<number>(0);

  const commandNames = useMemo(() => COMMANDS.map((c) => c.id), []);
  const rootTree = useMemo(() => buildCommandTree(commandNames), [commandNames]);

  const currentNode = useMemo(() => {
    let curr = rootTree;
    for (const step of navPath) {
      if (!curr.isLeaf) {
        curr = step === "left" ? curr.left : curr.right;
      }
    }
    return curr;
  }, [rootTree, navPath]);

  const leftIds = useMemo(() => (!currentNode.isLeaf ? currentNode.leftIds : []), [currentNode]);
  const rightIds = useMemo(() => (!currentNode.isLeaf ? currentNode.rightIds : []), [currentNode]);

  const executeCommand = useCallback((cmdId: string) => {
    setConfirmedCommand(cmdId);
    setTotalExecuted((e) => e + 1);
    setNavPath([]);

    setTimeout(() => {
      setConfirmedCommand((c) => (c === cmdId ? null : c));
    }, 3200);
  }, []);

  const getIntendedStep = useCallback((): "left" | "right" | null => {
    if (currentNode.isLeaf) return null;

    const found = findLeaf(currentNode, targetCommand);
    if (found && found.path.length > 0) {
      return found.path[0];
    }
    return "left";
  }, [currentNode, targetCommand]);

  useEffect(() => {
    registerIntendedProvider?.(getIntendedStep);
  }, [registerIntendedProvider, getIntendedStep]);

  const handleDecision = useCallback(
    (decision: "left" | "right") => {
      if (currentNode.isLeaf) {
        executeCommand(currentNode.id);
        return;
      }

      const nextSubtree = decision === "left" ? currentNode.left : currentNode.right;
      if (nextSubtree.isLeaf) {
        executeCommand(nextSubtree.id);
      } else {
        setNavPath((prev) => [...prev, decision]);
      }
    },
    [currentNode, executeCommand]
  );

  useEffect(() => {
    (window as unknown as { __commandHandleDecision?: (d: "left" | "right") => void }).__commandHandleDecision = handleDecision;
    return () => {
      delete (window as unknown as { __commandHandleDecision?: unknown }).__commandHandleDecision;
    };
  }, [handleDecision]);

  return (
    <GlassPanel
      variant="hero"
      className={cn(
        "relative flex flex-col justify-between p-6 bg-[#0D0F12]/85 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden min-h-[520px]",
        className
      )}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <SectionLabel icon={<HeartHandshake className="w-3.5 h-3.5 text-[#4CC9F0]" />}>
            Caregiver Command Board
          </SectionLabel>
          <Pill variant="cyan" size="sm">
            Max 3 Decisions
          </Pill>
        </div>

        {/* Target Selector for Simulation */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-muted text-[11px]">Simulated Target:</span>
          <select
            value={targetCommand}
            onChange={(e) => {
              setTargetCommand(e.target.value);
              setNavPath([]);
            }}
            className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-text focus:outline-none focus:ring-1 focus:ring-[#4CC9F0]"
          >
            {COMMANDS.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0D0F12]">
                {c.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setNavPath([])}
            className="p-1 rounded-md text-muted/60 hover:text-text hover:bg-white/5 transition-colors"
            title="Reset binary navigation tree"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main 4x2 Commands Grid (Vertically Centered) */}
      <div className="flex-1 flex flex-col justify-center py-4 select-none relative">
        {/* Large Confirmation Banner Card Overlay */}
        <AnimatePresence>
          {confirmedCommand && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: "spring", stiffness: 450, damping: 26 }}
              className="absolute inset-x-12 inset-y-4 z-30 flex flex-col items-center justify-center p-6 rounded-3xl bg-black/90 backdrop-blur-2xl border border-white/30 shadow-[0_0_50px_rgba(76,201,240,0.35)] text-center"
            >
              <button
                onClick={() => setConfirmedCommand(null)}
                className="absolute top-4 right-4 p-2 text-muted hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3 shadow-[0_0_20px_rgba(52,211,153,0.35)] animate-pulse">
                <CheckCheck className="w-7 h-7 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#4CC9F0] mb-1 font-semibold">
                Caregiver Alert Dispatched
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1.5">
                &ldquo;{confirmedCommand}&rdquo;
              </h2>
              <p className="text-xs font-mono text-muted max-w-sm mb-4 leading-relaxed">
                Action transmitted to hospital call station via 3-decision motor imagery dwell.
              </p>
              <button
                onClick={() => setConfirmedCommand(null)}
                className="px-5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-mono text-white border border-white/20 transition-all shadow-sm"
              >
                Dismiss Alert
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4x2 Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            const inLeft = leftIds.includes(cmd.id);
            const inRight = rightIds.includes(cmd.id);
            const isTarget = targetCommand === cmd.id;

            return (
              <motion.div
                key={cmd.id}
                layout
                animate={{
                  scale: inLeft || inRight ? 1.03 : 0.97,
                  opacity: inLeft || inRight ? 1 : 0.55,
                }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className={cn(
                  "relative flex flex-col items-center justify-center p-5 rounded-3xl border transition-all duration-300 min-h-[145px] shadow-sm",
                  inLeft
                    ? "bg-[#4CC9F0]/20 border-[#4CC9F0]/70 text-[#4CC9F0] shadow-[0_0_24px_rgba(76,201,240,0.25)] ring-1 ring-[#4CC9F0]/50"
                    : inRight
                    ? "bg-[#FFB547]/20 border-[#FFB547]/70 text-[#FFB547] shadow-[0_0_24px_rgba(255,181,71,0.25)] ring-1 ring-[#FFB547]/50"
                    : "bg-white/[0.02] border-white/5 text-muted/50"
                )}
              >
                {/* Simulated Target Badge */}
                {isTarget && (
                  <span className="absolute top-2.5 right-2.5 text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white font-semibold">
                    TARGET
                  </span>
                )}

                {/* Left/Right Branch Pill */}
                {(inLeft || inRight) && (
                  <span
                    className={cn(
                      "absolute top-2.5 left-2.5 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase",
                      inLeft ? "bg-[#4CC9F0]/30 text-[#4CC9F0]" : "bg-[#FFB547]/30 text-[#FFB547]"
                    )}
                  >
                    {inLeft ? "LEFT" : "RIGHT"}
                  </span>
                )}

                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center mb-2.5 shadow-sm",
                    inLeft
                      ? "bg-[#4CC9F0]/25 text-[#4CC9F0]"
                      : inRight
                      ? "bg-[#FFB547]/25 text-[#FFB547]"
                      : "bg-white/5 text-muted/40"
                  )}
                >
                  <Icon className="w-6 h-6 stroke-[2]" />
                </div>

                <span className="text-base font-bold tracking-tight font-sans text-center">
                  {cmd.label}
                </span>

                <span className="text-[10px] font-mono text-muted/60 mt-0.5 capitalize">
                  {cmd.category}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation Hierarchy */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs font-mono select-none">
        <div className="flex items-center gap-2">
          <span className="text-muted">Tree Step:</span>
          <div className="flex items-center gap-1.5">
            {["Root (8)", "Group (4)", "Choice (2)"].map((stepLabel, stepIdx) => (
              <span
                key={stepIdx}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-mono transition-all border",
                  stepIdx < navPath.length
                    ? "bg-[#4CC9F0]/20 border-[#4CC9F0]/40 text-[#4CC9F0] font-semibold"
                    : stepIdx === navPath.length
                    ? "bg-white/15 border-white/30 text-white font-bold animate-pulse"
                    : "bg-white/[0.02] border-white/5 text-muted/40"
                )}
              >
                {stepLabel}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted">
          <span>Commands Dispatched:</span>
          <span className="font-bold text-text">{totalExecuted}</span>
        </div>
      </div>
    </GlassPanel>
  );
}
