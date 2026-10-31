"use client";

import React from "react";
import { motion } from "framer-motion";
import { useHaloStore } from "@/lib/store";

export function AmbientBackground() {
  const latestFrame = useHaloStore((state) => state.latestFrame);
  const status = useHaloStore((state) => state.status);

  const isRunning = status?.state === "running";

  // Intent probabilities
  const pLeft = isRunning && latestFrame?.pred ? latestFrame.pred.left : 0;
  const pRight = isRunning && latestFrame?.pred ? latestFrame.pred.right : 0;

  // Baseline opacity: 0.035 (3.5%); Max opacity at 1.0 confidence: 0.10 (10%)
  const leftOpacity = 0.035 + pLeft * 0.065;
  const rightOpacity = 0.035 + pRight * 0.065;

  return (
    <div
      className="fixed inset-0 pointer-events-none -z-50 overflow-hidden select-none bg-[#07080A]"
      aria-hidden="true"
    >
      {/* Noise texture overlay */}
      <div className="absolute inset-0 bg-noise opacity-30 mix-blend-overlay" />

      {/* Cyan radial glow (Left motor cortex / Left intent) */}
      <motion.div
        className="absolute -left-[20vw] top-[15vh] w-[60vw] h-[70vh] rounded-full blur-[140px]"
        style={{
          background: "radial-gradient(circle, #4CC9F0 0%, rgba(76, 201, 240, 0) 70%)",
        }}
        animate={{
          opacity: leftOpacity,
          scale: 1 + pLeft * 0.15,
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 24,
        }}
      />

      {/* Amber radial glow (Right motor cortex / Right intent) */}
      <motion.div
        className="absolute -right-[20vw] top-[15vh] w-[60vw] h-[70vh] rounded-full blur-[140px]"
        style={{
          background: "radial-gradient(circle, #FFB547 0%, rgba(255, 181, 71, 0) 70%)",
        }}
        animate={{
          opacity: rightOpacity,
          scale: 1 + pRight * 0.15,
        }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 24,
        }}
      />

      {/* Subtle top ambient specular arc */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
