"use client";

import React, { useState } from "react";
import { AlertCircle, Check, Copy, RefreshCw, Terminal } from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <GlassPanel
      variant="default"
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6 border-dashed border-white/10",
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-muted mb-4 shadow-sm">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-text mb-1.5">{title}</h3>
      <p className="text-sm text-muted max-w-md leading-relaxed mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          variant="outline"
          className="rounded-full bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-xs px-5 h-9"
        >
          {actionLabel}
        </Button>
      )}
    </GlassPanel>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Backend Replay Server Offline",
  message = "Could not establish a connection to ws://localhost:8000/ws. Make sure the FastAPI backend is running.",
  onRetry,
  className,
}: ErrorStateProps) {
  const [copied, setCopied] = useState(false);
  const command = "cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload";

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <GlassPanel
      variant="raised"
      className={cn("max-w-xl mx-auto p-8 border-rose-500/20 bg-rose-950/10 text-center", className)}
    >
      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto mb-4 shadow-[0_0_20px_rgba(244,63,94,0.15)]">
        <AlertCircle className="w-6 h-6" />
      </div>

      <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed mb-6 max-w-md mx-auto">{message}</p>

      {/* Terminal copy block */}
      <div className="bg-[#07080A]/80 border border-white/10 rounded-2xl p-4 text-left mb-6 font-mono text-xs text-muted flex items-center justify-between gap-3 group">
        <div className="flex items-center gap-2 overflow-x-auto select-all text-white/90">
          <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{command}</span>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-text transition-colors"
          title="Copy command"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex items-center justify-center gap-3">
        {onRetry && (
          <Button
            onClick={onRetry}
            className="rounded-full bg-white/10 hover:bg-white/20 text-white text-xs px-5 h-9 flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </Button>
        )}
      </div>
    </GlassPanel>
  );
}
