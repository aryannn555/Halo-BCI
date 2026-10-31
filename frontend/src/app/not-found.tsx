"use client";

import React from "react";
import Link from "next/link";
import { GlassPanel } from "@/components/halo/GlassPanel";
import { SectionLabel, Pill } from "@/components/halo/Primitives";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Radio } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-[65vh] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <GlassPanel variant="hero" className="max-w-md w-full p-8 text-center space-y-6 border-white/10 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <SectionLabel icon={<Radio className="w-3.5 h-3.5 text-cyan-400" />}>
              Signal Lost
            </SectionLabel>
            <Pill variant="muted" size="sm" className="font-mono text-[10px]">
              404
            </Pill>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white">
            Cortical Channel Not Found
          </h2>

          <p className="text-xs text-muted leading-relaxed font-sans">
            The neural scene or recording you requested could not be resolved in the BCI montage. Return to the primary interface.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <Link href="/">
            <Button className="rounded-full px-5 h-10 bg-gradient-to-r from-[#4CC9F0] to-[#FFB547] text-[#07080A] font-semibold text-xs flex items-center gap-2 shadow-lg">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Overview</span>
            </Button>
          </Link>
        </div>

        <div className="border-t border-white/5 pt-3 text-[10px] font-mono text-muted/60">
          Halo BCI • 22 Ag/AgCl Channels • BNCI2014_001
        </div>
      </GlassPanel>
    </div>
  );
}
