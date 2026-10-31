"use client";

import React, { useEffect } from "react";
import { useSpring, useTransform, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StatNumberProps {
  value: number;
  decimals?: number;
  unit?: string;
  label?: string;
  prefix?: string;
  className?: string;
  valueClassName?: string;
  trend?: "up" | "down" | "neutral";
  size?: "sm" | "md" | "lg" | "xl";
}

export function StatNumber({
  value,
  decimals = 0,
  unit,
  label,
  prefix = "",
  className,
  valueClassName,
  size = "md",
}: StatNumberProps) {
  // Spring configuration for silky smooth tweening without jitter
  const spring = useSpring(value, {
    stiffness: 280,
    damping: 30,
    mass: 0.8,
  });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const displayValue = useTransform(spring, (latest) => {
    return `${prefix}${latest.toFixed(decimals)}`;
  });

  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl sm:text-3xl",
    lg: "text-3xl sm:text-4xl",
    xl: "text-4xl sm:text-5xl",
  }[size];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted select-none">
          {label}
        </span>
      )}
      <div className="flex items-baseline gap-1.5 font-mono tabular-nums leading-none">
        <motion.span
          className={cn(
            "font-medium tracking-tight text-text",
            sizeClasses,
            valueClassName
          )}
        >
          {displayValue}
        </motion.span>
        {unit && (
          <span className="text-xs sm:text-sm font-sans font-normal text-muted select-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
