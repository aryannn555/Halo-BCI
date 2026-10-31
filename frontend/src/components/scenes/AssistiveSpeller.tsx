"use client";

import React, { useEffect, useRef, useState } from "react";
import { FrameMessage } from "@/types/halo";
import { sounds } from "@/lib/audio";
import {
  Keyboard as KeyboardIcon,
  Volume2,
  Delete,
  Trash2,
  Copy,
  Check,
  Split,
  ListOrdered,
  HeartHandshake,
  MessageSquare,
} from "lucide-react";

interface AssistiveSpellerProps {
  latestFrame: FrameMessage | null;
  dwellMs?: number;
}

const QUICK_PHRASES = [
  "I need water",
  "Please reposition me",
  "I am in pain",
  "Call the nurse",
  "Yes",
  "No",
  "Thank you",
  "I am cold",
];

const FULL_KEYBOARD = [
  "A", "B", "C", "D", "E", "F",
  "G", "H", "I", "J", "K", "L",
  "M", "N", "O", "P", "Q", "R",
  "S", "T", "U", "V", "W", "X",
  "Y", "Z", "SPACE", "BACKSPACE"
];

export function AssistiveSpeller({
  latestFrame,
  dwellMs = 700,
}: AssistiveSpellerProps) {
  const [typedText, setTypedText] = useState<string>("NEED WATER");
  const [copied, setCopied] = useState<boolean>(false);
  const [spellerMode, setSpellerMode] = useState<"tree" | "linear">("tree");

  // Linear mode selection index
  const [selectedKeyIdx, setSelectedKeyIdx] = useState<number>(0);

  // Binary tree state
  const [currentBranch, setCurrentBranch] = useState<string[]>(FULL_KEYBOARD);
  const [activeSide, setActiveSide] = useState<"left" | "right" | null>(null);
  const [dwellProgress, setDwellProgress] = useState<number>(0);

  const dwellStartRef = useRef<number | null>(null);
  const lastStepTimeRef = useRef<number>(Date.now());

  // Split current branch into Left and Right
  const halfIdx = Math.ceil(currentBranch.length / 2);
  const leftBranch = currentBranch.slice(0, halfIdx);
  const rightBranch = currentBranch.slice(halfIdx);

  const pred = latestFrame?.pred;
  const pLeft = pred?.left ?? 0.5;
  const pRight = pred?.right ?? 0.5;

  // Dwell-to-select logic driven by decoded motor imagery intent
  useEffect(() => {
    let animId: number;

    const checkDwell = () => {
      // Determine dominant intent (must exceed 0.60 confidence threshold)
      const threshold = 0.58;
      let side: "left" | "right" | null = null;
      if (pLeft > threshold && pLeft > pRight + 0.1) {
        side = "left";
      } else if (pRight > threshold && pRight > pLeft + 0.1) {
        side = "right";
      }

      if (spellerMode === "tree") {
        if (side !== null) {
          if (activeSide !== side) {
            setActiveSide(side);
            dwellStartRef.current = Date.now();
            sounds.playTick();
          } else if (dwellStartRef.current !== null) {
            const elapsed = Date.now() - dwellStartRef.current;
            const progress = Math.min(1.0, elapsed / dwellMs);
            setDwellProgress(progress);

            if (progress >= 1.0) {
              // Selection executed!
              sounds.playAcquire();
              const chosen = side === "left" ? leftBranch : rightBranch;

              if (chosen.length === 1) {
                // Leaf reached: append letter
                const key = chosen[0];
                if (key === "SPACE") {
                  setTypedText((t) => t + " ");
                } else if (key === "BACKSPACE") {
                  setTypedText((t) => t.slice(0, -1));
                } else {
                  setTypedText((t) => t + key);
                }
                // Reset tree to root
                setCurrentBranch(FULL_KEYBOARD);
              } else {
                // Narrow down tree
                setCurrentBranch(chosen);
              }

              dwellStartRef.current = null;
              setActiveSide(null);
              setDwellProgress(0);
            }
          }
        } else {
          setActiveSide(null);
          dwellStartRef.current = null;
          setDwellProgress(0);
        }
      } else {
        // Linear mode navigation
        const now = Date.now();
        if (now - lastStepTimeRef.current > 450) {
          if (pLeft > 0.65) {
            setSelectedKeyIdx((idx) => (idx > 0 ? idx - 1 : FULL_KEYBOARD.length - 1));
            sounds.playTick();
            lastStepTimeRef.current = now;
          } else if (pRight > 0.65) {
            setSelectedKeyIdx((idx) => (idx < FULL_KEYBOARD.length - 1 ? idx + 1 : 0));
            sounds.playTick();
            lastStepTimeRef.current = now;
          }
        }
      }

      animId = requestAnimationFrame(checkDwell);
    };

    animId = requestAnimationFrame(checkDwell);
    return () => cancelAnimationFrame(animId);
  }, [pLeft, pRight, activeSide, dwellMs, spellerMode, currentBranch, leftBranch, rightBranch]);

  // Text-To-Speech engine
  const handleSpeak = () => {
    if (!typedText.trim()) return;
    sounds.playSpeak();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(typedText);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCopy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(typedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectPhrase = (phrase: string) => {
    sounds.playAcquire();
    setTypedText(phrase);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
      {/* Dominant Panel: Assistive Speller Workspace (8 cols) */}
      <div className="lg:col-span-8 flex flex-col rounded-panel p-5 halo-glass border-halo-border shadow-glass">
        {/* Panel Header & Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-halo-surface2 border border-halo-border">
              <KeyboardIcon className="h-4 w-4 text-halo-success" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Assistive Speller & AAC</h2>
              <p className="text-[11px] text-halo-muted">
                Augmentative & Alternative Communication for Locked-In Syndrome
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex rounded-lg bg-halo-surface2 p-0.5 border border-halo-border text-xs">
            <button
              onClick={() => {
                setSpellerMode("tree");
                setCurrentBranch(FULL_KEYBOARD);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                spellerMode === "tree"
                  ? "bg-halo-surface3 text-white shadow-sm"
                  : "text-halo-muted hover:text-white"
              }`}
            >
              <Split className="h-3 w-3" />
              <span>Binary Tree (Fast)</span>
            </button>
            <button
              onClick={() => setSpellerMode("linear")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                spellerMode === "linear"
                  ? "bg-halo-surface3 text-white shadow-sm"
                  : "text-halo-muted hover:text-white"
              }`}
            >
              <ListOrdered className="h-3 w-3" />
              <span>Direct Scanner</span>
            </button>
          </div>
        </div>

        {/* Typed Sentence Output Bar */}
        <div className="p-4 rounded-2xl bg-halo-surface border border-halo-border mb-5 flex items-center justify-between gap-3 shadow-inner">
          <div className="flex-1 overflow-x-auto whitespace-nowrap">
            <span className="text-xs text-halo-muted block mb-0.5 font-mono">CONSTRUCTED MESSAGE:</span>
            <div className="text-xl font-bold text-white tracking-wide font-mono flex items-center">
              <span>{typedText || "..."}</span>
              <span className="inline-block w-2 h-5 bg-halo-left ml-1 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Speak TTS Button */}
            <button
              onClick={handleSpeak}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 bg-halo-success hover:bg-halo-success/90 text-black font-semibold text-xs shadow-md transition-all active:scale-95"
              title="Vocalize sentence via Text-To-Speech (Enter)"
            >
              <Volume2 className="h-4 w-4" />
              <span>Vocalize</span>
            </button>

            {/* Backspace Button */}
            <button
              onClick={() => setTypedText((t) => t.slice(0, -1))}
              className="p-2 rounded-xl bg-halo-surface2 hover:bg-halo-surface3 text-halo-muted hover:text-white border border-halo-border transition-colors"
              title="Backspace"
            >
              <Delete className="h-4 w-4" />
            </button>

            {/* Clear Button */}
            <button
              onClick={() => setTypedText("")}
              className="p-2 rounded-xl bg-halo-surface2 hover:bg-halo-surface3 text-halo-muted hover:text-halo-error border border-halo-border transition-colors"
              title="Clear text"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-halo-surface2 hover:bg-halo-surface3 text-halo-muted hover:text-white border border-halo-border transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="h-4 w-4 text-halo-success" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mode A: Binary Tree Scanning Interface */}
        {spellerMode === "tree" ? (
          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Left Branch Selection Target */}
            <button
              onClick={() => {
                if (leftBranch.length === 1) {
                  const key = leftBranch[0];
                  if (key === "SPACE") setTypedText((t) => t + " ");
                  else if (key === "BACKSPACE") setTypedText((t) => t.slice(0, -1));
                  else setTypedText((t) => t + key);
                  setCurrentBranch(FULL_KEYBOARD);
                } else {
                  setCurrentBranch(leftBranch);
                }
              }}
              className={`relative rounded-2xl p-5 border text-left transition-all flex flex-col justify-between overflow-hidden group ${
                activeSide === "left"
                  ? "border-halo-left bg-halo-left/15 shadow-glowLeft scale-[1.02]"
                  : "border-halo-border bg-halo-surface2/70 hover:border-halo-left/40"
              }`}
            >
              {/* Dwell Progress Bar */}
              {activeSide === "left" && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-1.5 bg-halo-left transition-all duration-75"
                  style={{ width: `${dwellProgress * 100}%` }}
                />
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-halo-left uppercase tracking-wider font-mono">
                    LEFT INTENT (PUSH LEFT)
                  </span>
                  <span className="text-[11px] font-mono text-halo-muted">
                    {leftBranch.length} Letters
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {leftBranch.map((char) => (
                    <span
                      key={char}
                      className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-lg bg-black/40 text-white font-mono text-xs font-semibold border border-white/10"
                    >
                      {char}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-halo-muted">Left Hand Imagery ({(pLeft * 100).toFixed(0)}%)</span>
                <span className="text-halo-left font-mono font-medium">
                  {activeSide === "left" ? `${Math.round(dwellProgress * 100)}% Dwell` : "Dwell to select"}
                </span>
              </div>
            </button>

            {/* Right Branch Selection Target */}
            <button
              onClick={() => {
                if (rightBranch.length === 1) {
                  const key = rightBranch[0];
                  if (key === "SPACE") setTypedText((t) => t + " ");
                  else if (key === "BACKSPACE") setTypedText((t) => t.slice(0, -1));
                  else setTypedText((t) => t + key);
                  setCurrentBranch(FULL_KEYBOARD);
                } else {
                  setCurrentBranch(rightBranch);
                }
              }}
              className={`relative rounded-2xl p-5 border text-left transition-all flex flex-col justify-between overflow-hidden group ${
                activeSide === "right"
                  ? "border-halo-right bg-halo-right/15 shadow-glowRight scale-[1.02]"
                  : "border-halo-border bg-halo-surface2/70 hover:border-halo-right/40"
              }`}
            >
              {/* Dwell Progress Bar */}
              {activeSide === "right" && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-1.5 bg-halo-right transition-all duration-75"
                  style={{ width: `${dwellProgress * 100}%` }}
                />
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-halo-right uppercase tracking-wider font-mono">
                    RIGHT INTENT (PUSH RIGHT)
                  </span>
                  <span className="text-[11px] font-mono text-halo-muted">
                    {rightBranch.length} Letters
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {rightBranch.map((char) => (
                    <span
                      key={char}
                      className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-lg bg-black/40 text-white font-mono text-xs font-semibold border border-white/10"
                    >
                      {char}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-halo-muted">Right Hand Imagery ({(pRight * 100).toFixed(0)}%)</span>
                <span className="text-halo-right font-mono font-medium">
                  {activeSide === "right" ? `${Math.round(dwellProgress * 100)}% Dwell` : "Dwell to select"}
                </span>
              </div>
            </button>
          </div>
        ) : (
          /* Mode B: Linear On-Screen Keyboard */
          <div className="p-4 rounded-2xl bg-halo-surface2 border border-halo-border">
            <div className="grid grid-cols-7 gap-2">
              {FULL_KEYBOARD.map((key, idx) => {
                const isSelected = selectedKeyIdx === idx;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      sounds.playAcquire();
                      if (key === "SPACE") setTypedText((t) => t + " ");
                      else if (key === "BACKSPACE") setTypedText((t) => t.slice(0, -1));
                      else setTypedText((t) => t + key);
                    }}
                    className={`h-11 rounded-xl font-mono text-xs font-bold transition-all border ${
                      isSelected
                        ? "bg-halo-left text-black border-white shadow-glowLeft scale-105"
                        : "bg-halo-surface3 hover:bg-halo-surface text-white border-halo-border"
                    } ${key === "SPACE" ? "col-span-2" : key === "BACKSPACE" ? "col-span-2" : ""}`}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[11px] text-halo-muted font-mono">
              Left Motor Imagery steps Backward • Right Motor Imagery steps Forward
            </p>
          </div>
        )}

        {/* Tree Reset Helper */}
        {spellerMode === "tree" && currentBranch.length < FULL_KEYBOARD.length && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-halo-muted font-mono">
              Level depth: {Math.round(Math.log2(FULL_KEYBOARD.length / currentBranch.length))}
            </span>
            <button
              onClick={() => setCurrentBranch(FULL_KEYBOARD)}
              className="text-[11px] text-halo-left hover:underline font-mono"
            >
              Reset to Root Alphabet (A-Z)
            </button>
          </div>
        )}
      </div>

      {/* Side Bento Panels: Urgent Medical Needs & Assistive Presets (4 cols) */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        <div className="rounded-panel p-5 halo-glass border-halo-border shadow-glass flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-halo-surface2 border border-halo-border">
              <HeartHandshake className="h-4 w-4 text-halo-error" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Urgent Clinical Phrases</h3>
              <p className="text-[10px] text-halo-muted">Direct dwell access for locked-in care</p>
            </div>
          </div>

          <div className="space-y-2">
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                onClick={() => handleSelectPhrase(phrase)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-halo-surface2 hover:bg-halo-surface3 border border-halo-border hover:border-halo-left/40 text-left text-xs text-white transition-all group"
              >
                <span>{phrase}</span>
                <Volume2 className="h-3.5 w-3.5 text-halo-muted group-hover:text-halo-success transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* AAC Social Impact Note */}
        <div className="rounded-panel p-5 halo-glass border-halo-border shadow-glass flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-halo-success" />
            <h4 className="text-xs font-semibold text-white">Social Impact & Accessibility</h4>
          </div>
          <p className="text-[11px] text-halo-muted leading-relaxed">
            Locked-in syndrome patients retain intact sensorimotor cortex activation despite complete peripheral paralysis. Halo restores voice, dignity, and autonomy through non-invasive neural intent translation.
          </p>
          <div className="mt-3 pt-2.5 border-t border-halo-border/80 flex items-center justify-between text-[10px] font-mono text-halo-muted">
            <span>Dwell Latency: {dwellMs} ms</span>
            <span>Web Speech API v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
