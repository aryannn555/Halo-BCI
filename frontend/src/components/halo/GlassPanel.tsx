"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised" | "hero";
  children: React.ReactNode;
  noPadding?: boolean;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ variant = "default", className, children, noPadding = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-3xl transition-all duration-300",
          !noPadding && "p-6",
          // Default variant
          variant === "default" &&
            "halo-glass hover:border-white/12",
          // Raised variant
          variant === "raised" &&
            "halo-glass-raised",
          // Hero variant with subtle cyan-to-amber border gradient
          variant === "hero" &&
            "halo-glass-hero",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";
