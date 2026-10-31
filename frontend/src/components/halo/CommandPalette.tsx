"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Search,
  Activity,
  Compass,
  Cpu,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useHaloStore } from "@/lib/store";
import { sendHaloConfig, sendHaloControl } from "@/lib/useHalo";
import { KeyHint } from "./Primitives";
import { toast } from "sonner";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  category: "Navigation" | "Controls" | "Subject" | "Model" | "Noise";
  title: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const status = useHaloStore((state) => state.status);
  const hello = useHaloStore((state) => state.hello);
  const currentSubject = useHaloStore((state) => state.config.subject);
  const currentModel = useHaloStore((state) => state.config.model);
  const currentNoise = useHaloStore((state) => state.config.noise_snr_db);

  const isRunning = status?.state === "running";

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      // Navigation
      {
        id: "nav-overview",
        category: "Navigation",
        title: "Overview",
        description: "System health, live probability gauge, quick status",
        icon: <Compass className="w-4 h-4 text-emerald-400" />,
        shortcut: "1",
        action: () => router.push("/"),
      },
      {
        id: "nav-live",
        category: "Navigation",
        title: "Live Stream",
        description: "Raw multichannel EEG, spectrogram, band power ERD/ERS",
        icon: <Activity className="w-4 h-4 text-[#4CC9F0]" />,
        shortcut: "2",
        action: () => router.push("/live"),
      },
      {
        id: "nav-assist",
        category: "Navigation",
        title: "Assistive Workspace",
        description: "Real-time 2D cursor arena and dwell-to-select speller",
        icon: <Cpu className="w-4 h-4 text-[#FFB547]" />,
        shortcut: "3",
        action: () => router.push("/assist"),
      },
      {
        id: "nav-lab",
        category: "Navigation",
        title: "Metrics Lab",
        description: "Confusion matrix, ROC curves, latency, and noise benchmarks",
        icon: <Sliders className="w-4 h-4 text-purple-400" />,
        shortcut: "4",
        action: () => router.push("/lab"),
      },

      // Controls
      {
        id: "ctrl-toggle",
        category: "Controls",
        title: isRunning ? "Pause Replay Stream" : "Start Replay Stream",
        description: isRunning ? "Halt streaming frames" : "Resume streaming from BCI IV 2a",
        icon: isRunning ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />,
        shortcut: "Space",
        action: () => {
          sendHaloControl(isRunning ? "pause" : "start");
          toast.success(isRunning ? "Replay paused" : "Replay started");
        },
      },
      {
        id: "ctrl-reset",
        category: "Controls",
        title: "Reset Replay Session",
        description: "Rewind stream to trial 1",
        icon: <RotateCcw className="w-4 h-4 text-rose-400" />,
        action: () => {
          sendHaloControl("reset");
          toast.info("Replay session reset to trial 1");
        },
      },
      {
        id: "ctrl-speed-1",
        category: "Controls",
        title: "Playback Speed: 1.0x Real-time",
        description: "Standard 250 Hz replay timing (100 ms hops)",
        icon: <Zap className="w-4 h-4 text-white/60" />,
        action: () => {
          sendHaloControl("change_speed", { speed: 1.0 });
          toast.info("Playback speed set to 1.0x");
        },
      },
      {
        id: "ctrl-speed-2",
        category: "Controls",
        title: "Playback Speed: 2.0x Fast-forward",
        description: "2x acceleration for rapid epoch inspection",
        icon: <Zap className="w-4 h-4 text-amber-400" />,
        action: () => {
          sendHaloControl("change_speed", { speed: 2.0 });
          toast.info("Playback speed set to 2.0x");
        },
      },
      {
        id: "ctrl-speed-4",
        category: "Controls",
        title: "Playback Speed: 4.0x Maximum",
        description: "4x acceleration for rapid full-session sweeps",
        icon: <Zap className="w-4 h-4 text-rose-400" />,
        action: () => {
          sendHaloControl("change_speed", { speed: 4.0 });
          toast.info("Playback speed set to 4.0x");
        },
      },

      // Noise Toggle
      {
        id: "noise-toggle",
        category: "Noise",
        title: currentNoise === null ? "Inject Noise: 10 dB SNR" : "Clean Signal (Disable Noise)",
        description: currentNoise === null ? "Corrupt incoming raw EEG with synthetic pink noise" : "Restore pristine test epoch stream",
        icon: currentNoise === null ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-emerald-400" />,
        shortcut: "N",
        action: () => {
          const nextNoise = currentNoise === null ? 10.0 : null;
          sendHaloConfig({ noise_snr_db: nextNoise });
          toast.info(nextNoise ? "Noise injection active (10 dB SNR)" : "Noise disabled (Clean signal)");
        },
      },
    ];

    // Subjects
    const availableSubjects = hello?.subjects || [1, 2, 3, 4, 5, 6, 7, 8, 9];
    availableSubjects.forEach((sub) => {
      list.push({
        id: `subject-${sub}`,
        category: "Subject",
        title: `Subject ${sub} ${sub === currentSubject ? "(Active)" : ""}`,
        description: `Load held-out evaluation session for participant ${sub}`,
        icon: <span className="w-4 h-4 text-center font-mono text-xs text-muted font-bold">{sub}</span>,
        action: () => {
          sendHaloControl("change_subject", { subject: sub });
          toast.success(`Switched to Subject ${sub}`);
        },
      });
    });

    // Models
    const availableModels = hello?.models || ["csp_lda", "eegnet", "shallow_fbcsp"];
    availableModels.forEach((mod) => {
      list.push({
        id: `model-${mod}`,
        category: "Model",
        title: `${mod.toUpperCase()} ${mod === currentModel ? "(Active)" : ""}`,
        description: `Switch inference pipeline to ${mod}`,
        icon: <Cpu className="w-4 h-4 text-[#4CC9F0]" />,
        action: () => {
          sendHaloConfig({ model: mod });
          toast.success(`Model switched to ${mod}`);
        },
      });
    });

    return list;
  }, [router, isRunning, currentNoise, hello, currentSubject, currentModel]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-[#0D0F12]/95 backdrop-blur-2xl border-white/10 rounded-3xl p-0 overflow-hidden text-text shadow-2xl">
        {/* Search header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <Search className="w-5 h-5 text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, scene, subject, or model..."
            className="w-full bg-transparent border-none text-sm text-text placeholder:text-muted/60 focus:outline-none"
            autoFocus
          />
          <KeyHint>ESC</KeyHint>
        </div>

        {/* Results list */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              No matching commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onOpenChange(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-white/[0.08] text-text"
                      : "text-muted hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? "bg-white/10 border-white/20"
                          : "bg-white/[0.03] border-white/5"
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-text truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-muted truncate">
                        {item.description}
                      </div>
                    </div>
                  </div>
                  {item.shortcut && (
                    <KeyHint className="shrink-0 ml-3">{item.shortcut}</KeyHint>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[11px] text-muted/60">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>Halo System Controller</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
