"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useHaloStore } from "@/lib/store";
import { useDecisions, DecisionRecord } from "@/lib/useDecisions";
import { IntentRing } from "@/components/halo/IntentRing";
import { DecisionLog } from "@/components/halo/assist/DecisionLog";
import { ArenaInterface } from "@/components/halo/assist/ArenaInterface";
import { KeyboardInterface } from "@/components/halo/assist/KeyboardInterface";
import { CommandBoardInterface } from "@/components/halo/assist/CommandBoardInterface";
import { SectionLabel, Pill, KeyHint } from "@/components/halo/Primitives";
import { ErrorState } from "@/components/halo/States";
import {
  Crosshair,
  Keyboard,
  HeartHandshake,
  Bot,
  User,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AssistPage() {
  const connected = useHaloStore((state) => state.connected);

  const [activeTab, setActiveTab] = useState<"arena" | "keyboard" | "commands">("arena");

  // Dynamic provider ref for whichever interface is currently mounted
  const activeIntendedProviderRef = useRef<(() => "left" | "right" | null) | null>(null);

  const registerIntendedProvider = useCallback((provider: () => "left" | "right" | null) => {
    activeIntendedProviderRef.current = provider;
  }, []);

  const getIntended = useCallback(() => {
    return activeIntendedProviderRef.current ? activeIntendedProviderRef.current() : null;
  }, []);

  const handleDecisionFired = useCallback((record: DecisionRecord) => {
    // Forward decision to active interface handler
    const win = window as unknown as {
      __arenaHandleDecision?: (d: "left" | "right") => void;
      __keyboardHandleDecision?: (d: "left" | "right") => void;
      __commandHandleDecision?: (d: "left" | "right") => void;
    };

    if (win.__arenaHandleDecision) win.__arenaHandleDecision(record.decided);
    if (win.__keyboardHandleDecision) win.__keyboardHandleDecision(record.decided);
    if (win.__commandHandleDecision) win.__commandHandleDecision(record.decided);
  }, []);

  const {
    userMode,
    setUserMode,
    records,
    clearLog,
    stats,
    requestNextDecision,
  } = useDecisions({
    getIntended,
    onDecision: handleDecisionFired,
    decisionsPerChar: activeTab === "keyboard" ? 4.2 : 3.0,
  });

  // Re-request decision when switching tabs or when connected
  useEffect(() => {
    if (connected && userMode === "auto") {
      const timer = setTimeout(() => {
        requestNextDecision();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [connected, activeTab, userMode, requestNextDecision]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Persistent Honest Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2 rounded-2xl bg-white/[0.03] border border-white/10 text-xs backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#4CC9F0] shrink-0" />
          <span className="font-mono text-text">
            Simulated user — each decision plays a real recording of that imagery and is decoded live.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted/70 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>BCI IV 2a Scripted Replay</span>
        </div>
      </div>

      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SectionLabel icon={<Zap className="w-3.5 h-3.5 text-[#4CC9F0]" />}>
              Closed-Loop Assistive BCI
            </SectionLabel>
            <Pill variant="cyan" size="sm">
              Continuous Dwell Selection
            </Pill>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">
            Neural Agency & Assistive Actuation
          </h1>
          <p className="text-xs text-muted max-w-2xl leading-relaxed">
            Translate continuous motor-imagery intent into physical agency. Choose between
            1D target pursuit in the Virtual Cursor Arena, language composition in the Binary
            Keyboard, or high-priority Caregiver Commands.
          </p>
        </div>

        {/* Top Controls: Segmented Interface Selector & Auto/Manual Mode Switch */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Interface Segmented Selector */}
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/10">
            <button
              onClick={() => setActiveTab("arena")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-full text-xs font-mono font-medium transition-all",
                activeTab === "arena"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-muted hover:text-text"
              )}
              aria-label="Select Arena Interface"
            >
              <Crosshair className="w-3.5 h-3.5 text-[#4CC9F0]" />
              <span>Arena</span>
            </button>

            <button
              onClick={() => setActiveTab("keyboard")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-full text-xs font-mono font-medium transition-all",
                activeTab === "keyboard"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-muted hover:text-text"
              )}
              aria-label="Select Keyboard Interface"
            >
              <Keyboard className="w-3.5 h-3.5 text-[#FFB547]" />
              <span>Keyboard</span>
            </button>

            <button
              onClick={() => setActiveTab("commands")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-full text-xs font-mono font-medium transition-all",
                activeTab === "commands"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-muted hover:text-text"
              )}
              aria-label="Select Commands Interface"
            >
              <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
              <span>Commands</span>
            </button>
          </div>

          {/* Auto / Manual User Mode Switch */}
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/10">
            <button
              onClick={() => setUserMode("auto")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-full text-xs font-mono transition-all",
                userMode === "auto"
                  ? "bg-[#4CC9F0]/20 text-[#4CC9F0] border border-[#4CC9F0]/30 font-semibold"
                  : "text-muted hover:text-text"
              )}
              title="Simulated user pursues the target task automatically"
              aria-label="Switch to Auto mode"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Auto</span>
            </button>

            <button
              onClick={() => setUserMode("manual")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-full text-xs font-mono transition-all",
                userMode === "manual"
                  ? "bg-[#FFB547]/20 text-[#FFB547] border border-[#FFB547]/30 font-semibold"
                  : "text-muted hover:text-text"
              )}
              title="Manual mode: press Left or Right arrow key to imagine that hand"
              aria-label="Switch to Manual mode"
            >
              <User className="w-3.5 h-3.5" />
              <span>Manual</span>
              <div className="flex items-center gap-0.5 ml-1">
                <KeyHint className="text-[8.5px] px-1 py-0">←</KeyHint>
                <KeyHint className="text-[8.5px] px-1 py-0">→</KeyHint>
              </div>
            </button>
          </div>
        </div>
      </div>

      {!connected && (
        <ErrorState
          title="FastAPI Replay Service Disconnected"
          message="Could not reach ws://localhost:8000/ws. Launch backend replay server to stream closed-loop trials."
        />
      )}

      {/* Bento Grid: Main Active Interface (~2/3) & Right Column Telemetry (~1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Main Active Interface (8 of 12 cols) */}
        <div className="lg:col-span-8 flex flex-col min-h-[520px]">
          {activeTab === "arena" && (
            <ArenaInterface
              registerIntendedProvider={registerIntendedProvider}
              className="flex-1 h-full"
            />
          )}

          {activeTab === "keyboard" && (
            <KeyboardInterface
              registerIntendedProvider={registerIntendedProvider}
              className="flex-1 h-full"
            />
          )}

          {activeTab === "commands" && (
            <CommandBoardInterface
              registerIntendedProvider={registerIntendedProvider}
              className="flex-1 h-full"
            />
          )}
        </div>

        {/* Right Column: Intent Ring & Decision Log (4 of 12 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <IntentRing className="h-[310px]" />
          <DecisionLog
            records={records}
            stats={stats}
            onClear={clearLog}
            className="flex-1 min-h-[360px]"
          />
        </div>
      </div>
    </div>
  );
}
