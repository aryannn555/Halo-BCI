"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pill } from "./Primitives";
import { Sparkles } from "lucide-react";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#0D0F12]/95 backdrop-blur-2xl border border-white/10 text-text p-6 rounded-3xl shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Pill variant="cyan" size="sm" className="font-mono text-[10px]">
              AI MANTHAN 2.0
            </Pill>
            <Pill variant="glass" size="sm" className="font-mono text-[10px]">
              Hackathon Project
            </Pill>
          </div>
          <DialogTitle className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <span>About Halo BCI</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted leading-relaxed">
            Assistive brain-computer interface translating sensorimotor EEG rhythms into binary communication and motor actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs font-mono mt-4">
          {/* Dataset Citation */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">
              Dataset Citation
            </span>
            <p className="text-muted text-[11px] font-sans leading-relaxed">
              <strong>BCI Competition IV (Dataset 2a)</strong>, originally recorded by the Institute for Knowledge Discovery, Graz University of Technology (Brunner et al., 2008). Loaded and standardized via the <strong>Mother of all BCI Benchmarks (MOABB)</strong>. 22 scalp Ag/AgCl channels, 250 Hz sampling rate, 9 human subjects.
            </p>
          </div>

          {/* Open-Source Credits */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
              Open-Source Foundations
            </span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "MOABB",
                "Braindecode",
                "MNE-Python",
                "scikit-learn",
                "PyTorch (MPS)",
                "FastAPI",
                "Next.js 14",
                "uPlot",
                "Framer Motion",
                "shadcn/ui",
                "Tailwind CSS",
              ].map((lib) => (
                <span
                  key={lib}
                  className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] text-muted"
                >
                  {lib}
                </span>
              ))}
            </div>
          </div>

          {/* Hackathon Line */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-amber-500/10 border border-white/10 space-y-1">
            <div className="flex items-center gap-1.5 text-text font-semibold font-sans text-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Authored During AI MANTHAN 2.0</span>
            </div>
            <p className="text-muted text-[11px] font-sans">
              All machine learning pipelines, DSP filtering routines, WebSocket engines, and user interfaces were written from scratch during the hackathon.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5 text-[11px] text-muted font-mono">
          <span>Team: Halo BCI Core</span>
          <span>Open-Source MIT</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
