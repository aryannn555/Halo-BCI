"use client";

import React from "react";
import { useHaloStore } from "@/lib/store";
import { sendHaloControl, sendHaloConfig } from "@/lib/useHalo";
import { SectionLabel, Pill, KeyHint } from "@/components/halo/Primitives";
import { ErrorState } from "@/components/halo/States";
import { Waveforms } from "@/components/halo/Waveforms";
import { IntentRing } from "@/components/halo/IntentRing";
import { BrainMap } from "@/components/halo/BrainMap";
import { TrialStrip } from "@/components/halo/TrialStrip";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Activity } from "lucide-react";
import { toast } from "sonner";

export default function LivePage() {
  const connected = useHaloStore((state) => state.connected);
  const status = useHaloStore((state) => state.status);
  const config = useHaloStore((state) => state.config);

  const isRunning = status?.state === "running";
  const noiseSnr = config.noise_snr_db;

  const handleToggleReplay = () => {
    sendHaloControl(isRunning ? "pause" : "start");
  };

  const handleResetReplay = () => {
    sendHaloControl("reset");
    toast.info("Replay session reset to trial 1");
  };

  const handleToggleNoise = () => {
    const next = noiseSnr === null ? 10.0 : null;
    sendHaloConfig({ noise_snr_db: next });
    toast.info(next ? "Noise injection active (10 dB SNR)" : "Prinstine signal (Clean)");
  };

  const handleIntentFired = (event: { label: string; confidence: number }) => {
    toast.success(`Intent Actuated: ${event.label.toUpperCase()} (${(event.confidence * 100).toFixed(0)}%)`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <SectionLabel icon={<Activity className="w-3.5 h-3.5 text-[#4CC9F0]" />}>
              Live Stream Architecture
            </SectionLabel>
            <Pill variant="cyan" size="sm">
              22-ch • 250 Hz
            </Pill>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text">
            Neuro-Telemetry & Intent Decoder
          </h1>
          <p className="text-xs text-muted max-w-xl leading-relaxed">
            Streaming real-time microvolts from BCI Competition IV 2a. Watch C3 and C4 motor channels
            and inverse-distance topomap respond live to motor-imagery intent.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleToggleNoise}
            variant="outline"
            aria-label="Toggle pink noise"
            className="rounded-full min-h-[40px] px-3.5 bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-xs text-text flex items-center gap-1.5"
            title="Toggle 10 dB SNR pink noise (N)"
          >
            {noiseSnr !== null ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-medium">Noise: 10 dB</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-muted" />
                <span className="text-muted">Clean</span>
              </>
            )}
            <KeyHint className="ml-0.5 text-[9px]">N</KeyHint>
          </Button>

          <Button
            onClick={handleResetReplay}
            variant="outline"
            aria-label="Reset stream to trial 1"
            className="rounded-full min-w-[40px] min-h-[40px] px-2.5 bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-xs text-muted hover:text-text flex items-center justify-center"
            title="Reset stream to trial 1"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            onClick={handleToggleReplay}
            aria-label={isRunning ? "Pause Stream" : "Start Stream"}
            className={`rounded-full min-h-[40px] px-4 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all ${
              isRunning
                ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                <span>Stream</span>
              </>
            )}
            <KeyHint className="ml-1 text-[9px] bg-black/20 text-current border-current/20">Space</KeyHint>
          </Button>
        </div>
      </div>

      {!connected && (
        <ErrorState
          title="FastAPI Replay Service Disconnected"
          message="Could not reach ws://localhost:8000/ws. Start backend replay server to stream live trials."
        />
      )}

      {/* Bento Grid (1440x900 Reference Proportion) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: Dominant Hero Waveforms Panel (8 of 12 cols = ~2/3) */}
        <div className="lg:col-span-8 flex flex-col min-h-[580px]">
          <Waveforms className="flex-1 h-full" />
        </div>

        {/* Right Column: Intent Ring (top) & Brain Map (bottom) (4 of 12 cols = ~1/3) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <IntentRing onFired={handleIntentFired} className="h-[360px]" />
          <BrainMap className="flex-1 min-h-[290px]" />
        </div>

        {/* Bottom Full-Width Slim Trial Strip (12 of 12 cols) */}
        <div className="lg:col-span-12">
          <TrialStrip />
        </div>
      </div>
    </div>
  );
}
