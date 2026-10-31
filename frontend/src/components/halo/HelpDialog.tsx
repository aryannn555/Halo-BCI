"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { KeyHint } from "./Primitives";
import { Keyboard } from "lucide-react";

export interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const shortcuts = [
    { key: "Space", desc: "Start or pause live replay stream" },
    { key: "1", desc: "Jump to Overview scene" },
    { key: "2", desc: "Jump to Live Stream scene" },
    { key: "3", desc: "Jump to Assistive Workspace scene" },
    { key: "4", desc: "Jump to Metrics Lab scene" },
    { key: "N", desc: "Toggle noise injection (Clean vs 10 dB SNR)" },
    { key: "F", desc: "Toggle fullscreen presentation mode" },
    { key: "⌘ K", desc: "Open command palette" },
    { key: "?", desc: "Toggle this keyboard shortcuts dialog" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0D0F12]/95 backdrop-blur-2xl border-white/10 rounded-3xl p-6 text-text shadow-2xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-muted">
              <Keyboard className="w-4 h-4 text-white" />
            </div>
            <DialogTitle className="text-base font-semibold">Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted">
            Quick-access hotkeys for navigation, stream control, and simulation controls.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-white/5">
          {shortcuts.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2.5">
              <span className="text-xs text-muted">{item.desc}</span>
              <KeyHint className="font-semibold text-text">{item.key}</KeyHint>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-muted/60">
          <span>BCI Competition IV 2a Replay Engine</span>
          <span>Press ESC to dismiss</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
