"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Compass,
  Activity,
  Cpu,
  Sliders,
  Play,
  Pause,
  Command,
  HelpCircle,
  Maximize,
  Minimize,
  ChevronDown,
} from "lucide-react";
import { useHaloStore } from "@/lib/store";
import { sendHaloConfig, sendHaloControl } from "@/lib/useHalo";
import { startOfflineReplay } from "@/lib/offlinePlayer";
import { StatusDot, Pill } from "./Primitives";
import { CommandPalette } from "./CommandPalette";
import { HelpDialog } from "./HelpDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: Compass, key: "1" },
  { href: "/live", label: "Live Stream", icon: Activity, key: "2" },
  { href: "/assist", label: "Assist", icon: Cpu, key: "3" },
  { href: "/lab", label: "Lab", icon: Sliders, key: "4" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const subjectMenuRef = useRef<HTMLDivElement | null>(null);

  const connected = useHaloStore((state) => state.connected);
  const connecting = useHaloStore((state) => state.connecting);
  const status = useHaloStore((state) => state.status);
  const hello = useHaloStore((state) => state.hello);
  const currentSubject = useHaloStore((state) => state.config.subject);
  const currentSpeed = useHaloStore((state) => state.config.speed);
  const currentNoise = useHaloStore((state) => state.config.noise_snr_db);
  const isOffline = useHaloStore((state) => state.isOffline);
  const offlineOffered = useHaloStore((state) => state.offlineOffered);

  const isRunning = status?.state === "running";

  // Dismiss subject dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        subjectMenuRef.current &&
        !subjectMenuRef.current.contains(e.target as Node)
      ) {
        setSubjectMenuOpen(false);
      }
    };
    if (subjectMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [subjectMenuOpen]);

  // Sync fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Command + K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
        return;
      }

      // Help: ?
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      // Space: Start / Pause
      if (e.code === "Space") {
        e.preventDefault();
        const action = isRunning ? "pause" : "start";
        sendHaloControl(action);
        toast.info(isRunning ? "Replay stream paused" : "Replay stream started");
        return;
      }

      // 1..4: Scene jump
      if (e.key === "1") router.push("/");
      if (e.key === "2") router.push("/live");
      if (e.key === "3") router.push("/assist");
      if (e.key === "4") router.push("/lab");

      // N: Toggle noise
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        const nextNoise = currentNoise === null ? 10.0 : null;
        sendHaloConfig({ noise_snr_db: nextNoise });
        toast.info(nextNoise ? "Noise injection ON (10 dB SNR)" : "Noise injection OFF (Clean)");
      }

      // F: Fullscreen
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, isRunning, currentNoise]);

  const handleSpeedCycle = () => {
    const nextSpeed = currentSpeed === 1.0 ? 2.0 : currentSpeed === 2.0 ? 4.0 : 1.0;
    sendHaloControl("change_speed", { speed: nextSpeed });
    useHaloStore.getState().setConfig({ speed: nextSpeed });
    toast.info(`Playback speed: ${nextSpeed}x`);
  };

  const handleSubjectSelect = (sub: number) => {
    sendHaloControl("change_subject", { subject: sub });
    useHaloStore.getState().setConfig({ subject: sub });
    setSubjectMenuOpen(false);
    toast.success(`Subject changed to #${sub}`);
  };

  const handlePlayToggle = () => {
    const action = isRunning ? "pause" : "start";
    sendHaloControl(action);
    toast.info(isRunning ? "Replay paused" : "Replay started");
  };

  return (
    <>
      <header className="sticky top-3 z-40 w-full px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between gap-4 pointer-events-none">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0 pointer-events-auto">
          <Link
            href="/"
            className="group flex items-center gap-2.5 px-3 py-1.5 rounded-full halo-glass hover:bg-white/[0.06] transition-all duration-200"
          >
            {/* Visual Halo ring logo */}
            <div className="relative w-5 h-5 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-[#4CC9F0]/60 animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#4CC9F0] to-[#FFB547]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-text group-hover:text-white">
                HALO
              </span>
              <span className="text-[10px] font-mono text-muted/70 tracking-widest hidden sm:inline">
                BCI-2A
              </span>
            </div>
          </Link>
        </div>

        {/* Center: visionOS Floating Glass Nav Pill */}
        <nav
          className="relative flex items-center p-1 rounded-full halo-glass shadow-glass pointer-events-auto"
          aria-label="Main Navigation"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-full text-xs font-medium transition-colors select-none z-10",
                  isActive ? "text-white" : "text-muted hover:text-text"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-text" : "text-muted")} />
                <span>{item.label}</span>

                {isActive && (
                  <motion.div
                    layoutId="nav-pill-active"
                    className="absolute inset-0 rounded-full bg-white/[0.12] border border-white/20 shadow-sm -z-10"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 32,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Telemetry & Session Controls Cluster */}
        <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
          {/* Honest Replay Badge */}
          <Pill
            variant="glass"
            size="sm"
            className="hidden xl:inline-flex text-[10.5px] text-muted/80 tracking-wide border-white/5"
            title="Stream replayed from recorded BCI Competition IV 2a epochs (held-out test session)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CC9F0]/70" />
            <span>Replay • BCI IV 2a</span>
          </Pill>

          {/* Subject Dropdown / Picker */}
          <div className="relative" ref={subjectMenuRef}>
            <button
              onClick={() => setSubjectMenuOpen((p) => !p)}
              className="flex items-center gap-1.5 px-3 min-h-[40px] rounded-full halo-glass hover:bg-white/[0.08] text-xs font-mono text-text transition-colors"
              title="Select BCI subject (1..9)"
              aria-label="Select BCI subject"
            >
              <span className="text-muted text-[11px]">S</span>
              <span className="font-semibold">{currentSubject}</span>
              <ChevronDown className="w-3 h-3 text-muted ml-0.5" />
            </button>

            {subjectMenuOpen && (
              <div className="absolute top-full mt-2 right-0 w-36 py-1.5 rounded-2xl bg-[#0D0F12]/95 backdrop-blur-2xl border border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Select Subject
                </div>
                {(hello?.subjects || [1, 2, 3, 4, 5, 6, 7, 8, 9]).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSubjectSelect(s)}
                    className={cn(
                      "w-full px-3 py-2 min-h-[40px] text-xs text-left flex items-center justify-between hover:bg-white/[0.08] transition-colors",
                      s === currentSubject ? "text-[#4CC9F0] font-semibold" : "text-muted"
                    )}
                  >
                    <span>Subject {s}</span>
                    {s === currentSubject && <span className="w-1.5 h-1.5 rounded-full bg-[#4CC9F0]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Speed Control Pill */}
          <button
            onClick={handleSpeedCycle}
            className="flex items-center gap-1 px-3 min-h-[40px] rounded-full halo-glass hover:bg-white/[0.08] text-xs font-mono text-text transition-colors"
            title="Toggle playback speed (1.0x / 2.0x / 4.0x)"
            aria-label={`Playback speed: ${currentSpeed.toFixed(1)}x`}
          >
            <span className="text-muted text-[11px]">Speed</span>
            <span className="font-semibold text-amber-400">{currentSpeed.toFixed(1)}x</span>
          </button>

          {/* Stream Play / Pause Button */}
          <button
            onClick={handlePlayToggle}
            className={cn(
              "flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] rounded-full border transition-all duration-200 shadow-sm",
              isRunning
                ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
            )}
            title={isRunning ? "Pause stream (Space)" : "Start stream (Space)"}
            aria-label={isRunning ? "Pause stream" : "Start stream"}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Connection / Offline Badge */}
          {isOffline ? (
            <Pill
              variant="amber"
              size="sm"
              className="flex items-center gap-1.5 px-3 min-h-[40px] text-xs font-mono shadow-sm"
              title="Replaying cached 120s Subject 3 session"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-amber-300">
                Offline Replay
              </span>
            </Pill>
          ) : !connected && offlineOffered ? (
            <button
              onClick={() => {
                startOfflineReplay();
                toast.success("Started offline replay of saved session");
              }}
              className="px-3 min-h-[40px] rounded-full text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all flex items-center gap-1.5 animate-pulse"
              title="FastAPI server offline. Click to launch 120s saved session."
              aria-label="Launch offline replay"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>Offline Replay</span>
            </button>
          ) : (
            <Pill
              variant="glass"
              size="sm"
              className="flex items-center gap-1.5 px-3 min-h-[40px] text-xs"
            >
              <StatusDot
                status={connected ? "online" : connecting ? "connecting" : "offline"}
                size="xs"
                pulse={connected}
              />
              <span className="hidden md:inline text-[11px] font-medium text-muted">
                {connected ? "Connected" : connecting ? "Reconnecting" : "Offline"}
              </span>
            </Pill>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full halo-glass hover:bg-white/[0.08] text-muted hover:text-text transition-colors"
            title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* Command Palette Trigger */}
          <button
            onClick={() => setCmdOpen(true)}
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full halo-glass hover:bg-white/[0.08] text-muted hover:text-text transition-colors"
            title="Command Palette (⌘K)"
            aria-label="Open Command Palette"
          >
            <Command className="w-4 h-4" />
          </button>

          {/* Help Shortcuts Dialog Trigger */}
          <button
            onClick={() => setHelpOpen(true)}
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full halo-glass hover:bg-white/[0.08] text-muted hover:text-text transition-colors"
            title="Shortcuts Guide (?)"
            aria-label="Open Shortcuts Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Global Modals */}
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
