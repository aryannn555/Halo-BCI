"use client";

import React from "react";
import { cn } from "@/lib/utils";

// --- STATUS DOT ---
export interface StatusDotProps {
  status?: "online" | "offline" | "connecting" | "left" | "right" | "neutral";
  size?: "xs" | "sm" | "md";
  pulse?: boolean;
  className?: string;
}

export function StatusDot({
  status = "neutral",
  size = "sm",
  pulse = true,
  className,
}: StatusDotProps) {
  const sizeMap = {
    xs: "w-1.5 h-1.5",
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
  };

  const colorMap = {
    online: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
    connecting: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
    offline: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]",
    left: "bg-[#4CC9F0] shadow-[0_0_10px_rgba(76,201,240,0.7)]",
    right: "bg-[#FFB547] shadow-[0_0_10px_rgba(255,181,71,0.7)]",
    neutral: "bg-white/40",
  };

  return (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      {pulse && (status === "online" || status === "left" || status === "right") && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
            status === "online" && "bg-emerald-400",
            status === "left" && "bg-[#4CC9F0]",
            status === "right" && "bg-[#FFB547]"
          )}
        />
      )}
      <span className={cn("relative inline-block rounded-full", sizeMap[size], colorMap[status])} />
    </span>
  );
}

// --- PILL ---
export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "cyan" | "amber" | "muted" | "success" | "error" | "glass";
  size?: "sm" | "md";
  children: React.ReactNode;
}

export function Pill({
  variant = "default",
  size = "md",
  className,
  children,
  ...props
}: PillProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  }[size];

  const variantClasses = {
    default: "bg-white/[0.06] text-text border border-white/[0.08]",
    glass: "bg-[#0D0F12]/60 backdrop-blur-md text-text border border-white/[0.08] shadow-sm",
    cyan: "bg-[#4CC9F0]/12 text-[#4CC9F0] border border-[#4CC9F0]/30 shadow-[0_0_12px_rgba(76,201,240,0.15)]",
    amber: "bg-[#FFB547]/12 text-[#FFB547] border border-[#FFB547]/30 shadow-[0_0_12px_rgba(255,181,71,0.15)]",
    muted: "bg-white/[0.03] text-muted border border-white/[0.05]",
    success: "bg-emerald-500/12 text-emerald-300 border border-emerald-500/30",
    error: "bg-rose-500/12 text-rose-300 border border-rose-500/30",
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors select-none",
        sizeClasses,
        variantClasses,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// --- KEY HINT (<kbd>) ---
export interface KeyHintProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function KeyHint({ className, children, ...props }: KeyHintProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted bg-white/[0.05] border border-white/[0.1] rounded-[6px] shadow-inner select-none",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

// --- SECTION LABEL ---
export interface SectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function SectionLabel({ className, children, icon, ...props }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted select-none",
        className
      )}
      {...props}
    >
      {icon && <span className="text-muted shrink-0">{icon}</span>}
      <span className="leading-none">{children}</span>
    </div>
  );
}

// --- SKELETON ---
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "rounded" | "circular" | "rectangular";
}

export function Skeleton({ className, variant = "rounded", ...props }: SkeletonProps) {
  const variantMap = {
    rounded: "rounded-2xl",
    circular: "rounded-full",
    rectangular: "rounded-none",
  };

  return (
    <div
      className={cn(
        "animate-pulse bg-white/[0.04] border border-white/[0.04]",
        variantMap[variant],
        className
      )}
      {...props}
    />
  );
}
