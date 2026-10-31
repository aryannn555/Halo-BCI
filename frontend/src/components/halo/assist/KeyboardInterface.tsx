"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "../GlassPanel";
import { SectionLabel, Pill } from "../Primitives";
import {
  Keyboard,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCharacterWeights,
  getWordSuggestions,
} from "@/lib/language_model";
import {
  buildKeyboardTree,
  findLeaf,
  HuffmanLeaf,
} from "@/lib/huffman";

export interface KeyboardInterfaceProps {
  registerIntendedProvider?: (provider: () => "left" | "right" | null) => void;
  className?: string;
}

export function KeyboardInterface({
  registerIntendedProvider,
  className,
}: KeyboardInterfaceProps) {
  const [text, setText] = useState<string>("");
  const [demoPhrase, setDemoPhrase] = useState<string>("HELLO");
  const [actuatedLeaf, setActuatedLeaf] = useState<string | null>(null);
  const [navPath, setNavPath] = useState<("left" | "right")[]>([]);
  const [totalDecisions, setTotalDecisions] = useState<number>(0);
  const [totalCharsTyped, setTotalCharsTyped] = useState<number>(0);

  // Derive suggestions & character weights
  const suggestions = useMemo(() => getWordSuggestions(text), [text]);
  const charWeights = useMemo(() => getCharacterWeights(text), [text]);

  // Root tree
  const rootTree = useMemo(() => {
    return buildKeyboardTree(text, suggestions, charWeights);
  }, [text, suggestions, charWeights]);

  // Navigate down tree based on navPath
  const currentNode = useMemo(() => {
    let curr = rootTree;
    for (const step of navPath) {
      if (!curr.isLeaf) {
        curr = step === "left" ? curr.left : curr.right;
      }
    }
    return curr;
  }, [rootTree, navPath]);

  const leftIds = useMemo(() => (!currentNode.isLeaf ? currentNode.leftIds : []), [currentNode]);
  const rightIds = useMemo(() => (!currentNode.isLeaf ? currentNode.rightIds : []), [currentNode]);

  // Handle key actuation
  const actuateLeaf = useCallback((leaf: HuffmanLeaf) => {
    setActuatedLeaf(leaf.id);
    setTimeout(() => setActuatedLeaf(null), 450);

    if (leaf.type === "suggestion") {
      const word = leaf.label;
      setText((prev) => {
        const parts = prev.trimEnd().split(/\s+/);
        if (parts.length > 0 && prev.length > 0 && !prev.endsWith(" ")) {
          parts[parts.length - 1] = word;
          return parts.join(" ") + " ";
        }
        return prev + (prev.length > 0 && !prev.endsWith(" ") ? " " : "") + word + " ";
      });
      setTotalCharsTyped((c) => c + word.length + 1);
    } else if (leaf.id === "BACKSPACE") {
      setText((prev) => prev.slice(0, -1));
    } else if (leaf.id === "SPACE") {
      setText((prev) => prev + " ");
      setTotalCharsTyped((c) => c + 1);
    } else if (leaf.id === ".") {
      setText((prev) => prev + ". ");
      setTotalCharsTyped((c) => c + 2);
    } else {
      setText((prev) => prev + leaf.label);
      setTotalCharsTyped((c) => c + 1);
    }

    // Reset tree zoom to root
    setNavPath([]);
  }, []);

  // Intended step provider for simulated Auto user
  const getIntendedStep = useCallback((): "left" | "right" | null => {
    if (currentNode.isLeaf) return null;

    const targetPhrase = demoPhrase.toUpperCase().trim();
    const currentUpper = text.toUpperCase();

    // If phrase already typed, finish with period
    if (currentUpper.startsWith(targetPhrase)) {
      if (!currentUpper.endsWith(".")) {
        const path = findLeaf(currentNode, ".")?.path;
        return path && path.length > 0 ? path[0] : "left";
      }
      return null;
    }

    const nextCharIndex = currentUpper.length;
    const nextChar = targetPhrase[nextCharIndex];

    const targetWords = targetPhrase.split(/\s+/);
    const typedWords = currentUpper.split(/\s+/);
    const currentWordIndex = typedWords.length - 1;
    const targetWord = targetWords[currentWordIndex] || "";

    const matchingSugg = suggestions.find(
      (s) => s === targetWord && targetWord.length >= 3
    );

    let targetId: string = nextChar;
    if (matchingSugg && findLeaf(currentNode, `SUGG_${matchingSugg}`)) {
      targetId = `SUGG_${matchingSugg}`;
    } else if (!nextChar) {
      targetId = "SPACE";
    }

    const foundLeaf = findLeaf(currentNode, targetId);
    if (foundLeaf && foundLeaf.path.length > 0) {
      return foundLeaf.path[0];
    }

    if (leftIds.includes("BACKSPACE")) return "left";
    if (rightIds.includes("BACKSPACE")) return "right";

    return "left";
  }, [currentNode, demoPhrase, text, suggestions, leftIds, rightIds]);

  useEffect(() => {
    registerIntendedProvider?.(getIntendedStep);
  }, [registerIntendedProvider, getIntendedStep]);

  // Handle incoming binary decision
  const handleDecision = useCallback(
    (decision: "left" | "right") => {
      setTotalDecisions((d) => d + 1);

      if (currentNode.isLeaf) {
        actuateLeaf(currentNode);
        return;
      }

      const nextSubtree = decision === "left" ? currentNode.left : currentNode.right;
      if (nextSubtree.isLeaf) {
        actuateLeaf(nextSubtree);
      } else {
        setNavPath((prev) => [...prev, decision]);
      }
    },
    [currentNode, actuateLeaf]
  );

  useEffect(() => {
    (window as unknown as { __keyboardHandleDecision?: (d: "left" | "right") => void }).__keyboardHandleDecision = handleDecision;
    return () => {
      delete (window as unknown as { __keyboardHandleDecision?: unknown }).__keyboardHandleDecision;
    };
  }, [handleDecision]);

  const avgDecisionsPerChar =
    totalCharsTyped > 0 ? (totalDecisions / totalCharsTyped).toFixed(1) : "4.1";

  const handleClearText = () => {
    setText("");
    setNavPath([]);
  };

  const handlePresetPhrase = (phrase: string) => {
    setDemoPhrase(phrase);
    setText("");
    setNavPath([]);
  };

  return (
    <GlassPanel
      variant="hero"
      className={cn(
        "relative flex flex-col justify-between p-6 bg-[#0D0F12]/85 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden min-h-[520px]",
        className
      )}
    >
      {/* Top Header & Demo Shortcuts */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <SectionLabel icon={<Keyboard className="w-3.5 h-3.5 text-[#4CC9F0]" />}>
            Binary Huffman Keyboard
          </SectionLabel>
          <Pill variant="amber" size="sm">
            Language Model Driven
          </Pill>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-muted text-[11px]">Demo Phrase:</span>
          {["HELLO", "HELP", "WATER", "YES"].map((phrase) => (
            <button
              key={phrase}
              onClick={() => handlePresetPhrase(phrase)}
              aria-label={`Load demo phrase ${phrase}`}
              className={cn(
                "px-3 min-h-[40px] rounded-full text-[11px] font-semibold transition-all border shadow-sm flex items-center justify-center",
                demoPhrase === phrase
                  ? "bg-white/15 text-white border-white/30 shadow-sm"
                  : "bg-white/[0.03] text-muted hover:text-text border-white/5"
              )}
            >
              {phrase}
            </button>
          ))}
          <button
            onClick={handleClearText}
            aria-label="Clear speller text field"
            className="min-w-[40px] min-h-[40px] text-muted/60 hover:text-text rounded-full hover:bg-white/5 ml-1 transition-colors flex items-center justify-center border border-white/5"
            title="Clear text field"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Text Display Field with Inner Shadow & Blinking Caret */}
      <div className="relative my-2 p-4 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-between min-h-[68px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] select-none">
        <div className="flex items-center flex-wrap gap-1 text-lg sm:text-xl font-mono text-text">
          {text.length === 0 ? (
            <span className="text-muted/40 italic text-sm">
              Awaiting neural decodes to compose words...
            </span>
          ) : (
            <span className="font-semibold tracking-wide">{text}</span>
          )}
          <span className="w-2 h-5 bg-[#4CC9F0] animate-pulse rounded-sm inline-block ml-0.5 shadow-[0_0_8px_#4CC9F0]" />
        </div>

        {text.length > 0 && (
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-muted/70">
            {text.length} chars
          </span>
        )}
      </div>

      {/* Row of 3 Contextual Word Suggestions */}
      <div className="flex items-center justify-between gap-3 mb-2.5 select-none">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Suggestions:</span>
        </div>

        <div className="flex-1 flex items-center gap-2">
          {suggestions.map((word) => {
            const suggId = `SUGG_${word}`;
            const inLeft = leftIds.includes(suggId);
            const inRight = rightIds.includes(suggId);
            const isActuated = actuatedLeaf === suggId;

            return (
              <motion.div
                key={word}
                animate={{
                  scale: isActuated ? 1.15 : inLeft || inRight ? 1.03 : 0.98,
                }}
                className={cn(
                  "flex-1 px-3 py-2 rounded-xl text-xs font-mono font-bold tracking-wide border flex items-center justify-between transition-all shadow-sm",
                  isActuated
                    ? "bg-white text-[#07080A] shadow-[0_0_20px_white]"
                    : inLeft
                    ? "bg-[#4CC9F0]/20 border-[#4CC9F0]/60 text-[#4CC9F0] shadow-[0_0_12px_rgba(76,201,240,0.25)] ring-1 ring-[#4CC9F0]/40"
                    : inRight
                    ? "bg-[#FFB547]/20 border-[#FFB547]/60 text-[#FFB547] shadow-[0_0_12px_rgba(255,181,71,0.25)] ring-1 ring-[#FFB547]/40"
                    : "bg-white/[0.03] border-white/5 text-muted/50 opacity-60"
                )}
              >
                <span>{word}</span>
                {(inLeft || inRight) && (
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-md font-bold bg-black/40">
                    {inLeft ? "LEFT" : "RIGHT"}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Binary Keypad Layout */}
      <div className="relative py-1 flex flex-col gap-2 select-none">
        {/* Top Function Keys: Delete, Space, Period */}
        <div className="flex items-center gap-2">
          {["BACKSPACE", "SPACE", "."].map((funcKey) => {
            const inLeft = leftIds.includes(funcKey);
            const inRight = rightIds.includes(funcKey);
            const isActuated = actuatedLeaf === funcKey;
            const label = funcKey === "BACKSPACE" ? "⌫ Delete" : funcKey === "SPACE" ? "␣ Space" : "• Period";

            return (
              <motion.div
                key={funcKey}
                animate={{ scale: isActuated ? 1.08 : 1 }}
                className={cn(
                  "flex-1 py-2 px-3 rounded-xl border text-xs font-mono font-semibold flex items-center justify-between transition-all",
                  isActuated
                    ? "bg-white text-[#07080A] shadow-[0_0_16px_white]"
                    : inLeft
                    ? "bg-[#4CC9F0]/20 border-[#4CC9F0]/60 text-[#4CC9F0] shadow-[0_0_10px_rgba(76,201,240,0.2)]"
                    : inRight
                    ? "bg-[#FFB547]/20 border-[#FFB547]/60 text-[#FFB547] shadow-[0_0_10px_rgba(255,181,71,0.2)]"
                    : "bg-white/[0.02] border-white/5 text-muted/50 opacity-55"
                )}
              >
                <span>{label}</span>
                {(inLeft || inRight) && (
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-md bg-black/40 font-bold">
                    {inLeft ? "LEFT" : "RIGHT"}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* 26 Letters Grid (A-Z) */}
        <div className="grid grid-cols-7 sm:grid-cols-9 md:grid-cols-13 gap-1.5 p-3 rounded-2xl bg-black/40 border border-white/5">
          {Array.from({ length: 26 }).map((_, i) => {
            const letter = String.fromCharCode(65 + i);
            const inLeft = leftIds.includes(letter);
            const inRight = rightIds.includes(letter);
            const isActuated = actuatedLeaf === letter;

            return (
              <motion.div
                key={letter}
                layout
                animate={{
                  scale: isActuated ? 1.25 : inLeft || inRight ? 1.05 : 0.98,
                }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className={cn(
                  "h-11 rounded-xl border flex flex-col items-center justify-center font-mono font-bold transition-all relative overflow-hidden",
                  isActuated
                    ? "bg-white text-[#07080A] shadow-[0_0_18px_white] z-20"
                    : inLeft
                    ? "bg-[#4CC9F0]/20 border-[#4CC9F0]/70 text-[#4CC9F0] shadow-[0_0_12px_rgba(76,201,240,0.3)] ring-1 ring-[#4CC9F0]/40 z-10"
                    : inRight
                    ? "bg-[#FFB547]/20 border-[#FFB547]/70 text-[#FFB547] shadow-[0_0_12px_rgba(255,181,71,0.3)] ring-1 ring-[#FFB547]/40 z-10"
                    : "bg-white/[0.02] border-white/5 text-muted/50 opacity-55"
                )}
              >
                <span className="text-sm">{letter}</span>
                {(inLeft || inRight) && (
                  <span className="text-[8px] font-sans font-bold opacity-80">
                    {inLeft ? "L" : "R"}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Honest Efficiency & Diagnostic Panel */}
      <div className="mt-2 pt-3 border-t border-white/5 select-none space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Decisions / Char:</span>
            <span className="font-bold text-text">{avgDecisionsPerChar}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted">Decisions Made:</span>
            <span className="font-bold text-text">{totalDecisions}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted">Subtree Depth:</span>
            <span className="font-bold text-[#4CC9F0]">
              Step {navPath.length} of 5
            </span>
          </div>
        </div>

        {/* Honest BCI usability notice */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] font-mono text-muted/70 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-[#4CC9F0] shrink-0 mt-0.5" />
          <span>
            Letter-level BCI decoders operate at ~75–85% raw accuracy. Word suggestions,
            weighted prefix trees, and single-step backspace recovery are what make binary
            motor-imagery assistive communication fast and usable.
          </span>
        </div>
      </div>
    </GlassPanel>
  );
}
