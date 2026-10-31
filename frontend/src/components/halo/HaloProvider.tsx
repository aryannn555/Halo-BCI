"use client";

import React from "react";
import { useHalo } from "@/lib/useHalo";
import { AmbientBackground } from "./AmbientBackground";
import { TopNav } from "./TopNav";
import { TourOverlay } from "./TourOverlay";
import { Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export function HaloProvider({ children }: { children: React.ReactNode }) {
  // Initialize and maintain WebSocket connection across entire application
  useHalo({ autoConnect: true });
  const pathname = usePathname();

  return (
    <>
      {/* Dynamic ambient intent glows & noise texture */}
      <AmbientBackground />

      {/* Floating visionOS top navigation pill */}
      <TopNav />

      {/* Guided demo tour caption bar */}
      <TourOverlay />

      {/* Main page content area with smooth spring scene transitions */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16 min-h-[calc(100vh-80px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.25,
            }}
            className="w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Toast notifications */}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgba(13, 15, 18, 0.92)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#F2F4F7",
            borderRadius: "18px",
            fontSize: "12px",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.5)",
          },
        }}
      />
    </>
  );
}
