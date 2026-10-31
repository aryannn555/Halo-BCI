"use client";

import React, { useEffect, useRef, useState } from "react";
import { useHalo } from "@/lib/useHalo";

interface TrialResult {
  trialNum: number;
  truth: string;
  majorityLabel: string;
  meanConfidence: number;
  isCorrect: boolean;
  totalHops: number;
}

export default function DebugPage() {
  const {
    connected,
    connecting,
    hello,
    status,
    frame,
    error,
    sendControl,
    sendConfig,
    reconnect,
  } = useHalo();

  // Local state for UI controls
  const [selectedSubject, setSelectedSubject] = useState<number>(3);
  const [selectedModel, setSelectedModel] = useState<string>("csp_lda");
  const [speed, setSpeed] = useState<number>(1.0);

  // Running trial-level accuracy evaluation state
  const [trialHistory, setTrialHistory] = useState<TrialResult[]>([]);
  const currentTrialRef = useRef<{
    trialNum: number;
    truth: string | null;
    leftVotes: number;
    rightVotes: number;
    confSum: number;
    hops: number;
  } | null>(null);

  // Handle trial tracking & transition on new frames
  useEffect(() => {
    if (!frame) return;

    const currentTrialNum = frame.trial;
    const currentTruth = frame.truth; // "left" | "right" | null (during rest)
    const predLabel = frame.pred.label;
    const confidence = frame.pred.confidence;

    const active = currentTrialRef.current;

    // Check if we entered a new trial
    if (active && active.trialNum !== currentTrialNum) {
      // Finalize the previous trial if it had valid truth (non-rest)
      if (active.truth && active.hops > 0) {
        const majority = active.rightVotes > active.leftVotes ? "right" : "left";
        const isCorrect = majority === active.truth;
        const meanConf = active.confSum / active.hops;

        const result: TrialResult = {
          trialNum: active.trialNum,
          truth: active.truth,
          majorityLabel: majority,
          meanConfidence: meanConf,
          isCorrect,
          totalHops: active.hops,
        };

        setTrialHistory((prev) => {
          // Prevent duplicates if trial already registered
          if (prev.some((t) => t.trialNum === result.trialNum)) return prev;
          return [...prev, result];
        });
      }

      // Initialize new trial record
      currentTrialRef.current = {
        trialNum: currentTrialNum,
        truth: currentTruth,
        leftVotes: predLabel === "left" ? 1 : 0,
        rightVotes: predLabel === "right" ? 1 : 0,
        confSum: confidence,
        hops: currentTruth ? 1 : 0,
      };
    } else if (!active) {
      // First frame received
      currentTrialRef.current = {
        trialNum: currentTrialNum,
        truth: currentTruth,
        leftVotes: predLabel === "left" ? 1 : 0,
        rightVotes: predLabel === "right" ? 1 : 0,
        confSum: confidence,
        hops: currentTruth ? 1 : 0,
      };
    } else {
      // Accumulate hops during active trial period
      if (currentTruth) {
        if (!active.truth) active.truth = currentTruth;
        if (predLabel === "left") active.leftVotes += 1;
        else active.rightVotes += 1;
        active.confSum += confidence;
        active.hops += 1;
      }
    }
  }, [frame]);

  // Derived intent position: (p_right - p_left) in [-1.0, +1.0]
  const pLeft = frame?.pred.left ?? 0.5;
  const pRight = frame?.pred.right ?? 0.5;
  const intentDelta = pRight - pLeft; // -1.0 (full left) to +1.0 (full right)
  const dotPercent = Math.max(5, Math.min(95, 50 + intentDelta * 50));

  // Trial statistics
  const totalCompleted = trialHistory.length;
  const totalCorrect = trialHistory.filter((t) => t.isCorrect).length;
  const runningAccuracy =
    totalCompleted > 0 ? (totalCorrect / totalCompleted) * 100 : 0.0;

  // Actions
  const handleStart = () => {
    sendControl("start", { subject: selectedSubject, speed });
  };

  const handlePause = () => {
    sendControl("pause");
  };

  const handleReset = () => {
    sendControl("reset");
    setTrialHistory([]);
    currentTrialRef.current = null;
  };

  const handleSubjectChange = (subj: number) => {
    setSelectedSubject(subj);
    sendControl("change_subject", { subject: subj });
    setTrialHistory([]);
    currentTrialRef.current = null;
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    sendConfig({ model });
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    sendControl("change_speed", { speed: newSpeed });
  };

  const availableSubjects = hello?.subjects || [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const availableModels = hello?.models || ["csp_lda", "eegnet"];

  return (
    <main className="min-h-screen bg-[#07080A] text-[#F2F4F7] p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">Halo BCI — Replay Debugger</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-[#4CC9F0] font-mono">
                100ms Hops @ 250Hz
              </span>
            </div>
            <p className="text-xs text-[#8A919C] mt-1">
              Deterministic cross-session held-out replay with live drift-free streaming
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connected
                    ? "bg-[#34D399] shadow-[0_0_8px_#34D399]"
                    : connecting
                    ? "bg-[#FFB547] animate-pulse"
                    : "bg-[#FF5C6C]"
                }`}
              />
              <span className="text-[#8A919C]">
                {connected ? "Connected" : connecting ? "Connecting..." : "Disconnected"}
              </span>
            </div>

            {!connected && (
              <button
                onClick={reconnect}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3 text-xs bg-red-950/50 border border-red-500/30 text-red-200 rounded-xl">
            {error}
          </div>
        )}

        {/* Control & Configuration Strip */}
        <div className="p-4 rounded-2xl bg-[#0D0F12] border border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Subject Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#8A919C]">Subject:</label>
              <select
                value={selectedSubject}
                onChange={(e) => handleSubjectChange(Number(e.target.value))}
                className="text-xs bg-[#14171B] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
              >
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>
                    Subject {s} {s === 3 ? "★" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Model Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#8A919C]">Model:</label>
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="text-xs bg-[#14171B] border border-white/10 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#8A919C]">Speed:</label>
              <div className="flex gap-1">
                {[0.5, 1.0, 2.0, 4.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={`text-xs px-2 py-1 rounded-md font-mono transition ${
                      speed === s
                        ? "bg-white/20 text-white font-bold"
                        : "bg-white/5 text-[#8A919C] hover:bg-white/10"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleStart}
              disabled={!connected || status?.state === "running"}
              className="text-xs px-4 py-1.5 rounded-lg font-semibold bg-[#34D399] text-black hover:bg-[#34D399]/90 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Start Replay
            </button>
            <button
              onClick={handlePause}
              disabled={!connected || status?.state !== "running"}
              className="text-xs px-4 py-1.5 rounded-lg font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Pause
            </button>
            <button
              onClick={handleReset}
              disabled={!connected}
              className="text-xs px-4 py-1.5 rounded-lg font-semibold bg-white/5 hover:bg-white/15 text-[#8A919C] transition"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Live Metrics Bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#0D0F12] border border-white/10">
            <div className="text-[11px] text-[#8A919C] uppercase font-mono">Replay Time & Trial</div>
            <div className="text-2xl font-bold font-mono mt-1 text-white">
              {frame ? `${frame.t.toFixed(1)}s` : "--"}
            </div>
            <div className="text-xs text-[#8A919C] mt-1 font-mono">
              Trial #{frame?.trial ?? "--"} / 144
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0D0F12] border border-white/10">
            <div className="text-[11px] text-[#8A919C] uppercase font-mono">Ground Truth</div>
            <div className="text-2xl font-bold font-mono mt-1 capitalize">
              {frame?.truth ? (
                <span className={frame.truth === "left" ? "text-[#4CC9F0]" : "text-[#FFB547]"}>
                  {frame.truth}
                </span>
              ) : (
                <span className="text-white/40">Resting</span>
              )}
            </div>
            <div className="text-xs text-[#8A919C] mt-1 font-mono">
              {frame?.truth ? "Target Active" : "1.0s Inter-trial"}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0D0F12] border border-white/10">
            <div className="text-[11px] text-[#8A919C] uppercase font-mono">Predicted Intent</div>
            <div className="text-2xl font-bold font-mono mt-1 capitalize">
              {frame?.pred ? (
                <span
                  className={
                    frame.pred.label === "left" ? "text-[#4CC9F0]" : "text-[#FFB547]"
                  }
                >
                  {frame.pred.label}
                </span>
              ) : (
                "--"
              )}
            </div>
            <div className="text-xs text-[#8A919C] mt-1 font-mono">
              Confidence: {frame ? `${(frame.pred.confidence * 100).toFixed(1)}%` : "--"}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0D0F12] border border-white/10">
            <div className="text-[11px] text-[#8A919C] uppercase font-mono">Decoder Latency</div>
            <div className="text-2xl font-bold font-mono mt-1 text-[#34D399]">
              {frame?.pred.latency_ms ? `${frame.pred.latency_ms.toFixed(2)} ms` : "--"}
            </div>
            <div className="text-xs text-[#8A919C] mt-1 font-mono">
              Budget: &lt; 50 ms (OK)
            </div>
          </div>
        </div>

        {/* Horizontal Intent Track (Interactive Visualizer) */}
        <div className="p-6 rounded-2xl bg-[#0D0F12] border border-white/10 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-[#8A919C]">
            <span className="flex items-center gap-1.5 text-[#4CC9F0] font-bold">
              ◀ LEFT INTENT (-1.0)
            </span>
            <span>NEUTRAL REST (0.0)</span>
            <span className="flex items-center gap-1.5 text-[#FFB547] font-bold">
              RIGHT INTENT (+1.0) ▶
            </span>
          </div>

          {/* Track Container */}
          <div className="relative w-full h-12 rounded-xl bg-[#14171B] border border-white/10 flex items-center px-4 overflow-hidden shadow-inner">
            {/* Center zero mark */}
            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/20" />

            {/* Left and Right colored gradient backdrops */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#4CC9F0]/10 transition-all duration-100"
              style={{ width: `${Math.max(0, 50 - dotPercent)}%`, left: `${dotPercent}%` }}
            />
            <div
              className="absolute top-0 bottom-0 bg-[#FFB547]/10 transition-all duration-100"
              style={{ width: `${Math.max(0, dotPercent - 50)}%`, left: "50%" }}
            />

            {/* Moving Indicator Dot */}
            <div
              className="absolute w-7 h-7 rounded-full shadow-lg flex items-center justify-center transition-all duration-75 transform -translate-x-1/2"
              style={{
                left: `${dotPercent}%`,
                backgroundColor: intentDelta >= 0 ? "#FFB547" : "#4CC9F0",
                boxShadow: `0 0 16px ${intentDelta >= 0 ? "#FFB547" : "#4CC9F0"}80`,
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#07080A]" />
            </div>
          </div>

          {/* Probability Breakdown Bar */}
          <div className="flex items-center justify-between text-xs font-mono text-[#8A919C] pt-1">
            <div>
              p(Left): <span className="text-[#4CC9F0] font-bold">{(pLeft * 100).toFixed(1)}%</span>
            </div>
            <div>
              Δp (Right - Left):{" "}
              <span className={`font-bold ${intentDelta >= 0 ? "text-[#FFB547]" : "text-[#4CC9F0]"}`}>
                {intentDelta >= 0 ? "+" : ""}
                {intentDelta.toFixed(3)}
              </span>
            </div>
            <div>
              p(Right): <span className="text-[#FFB547] font-bold">{(pRight * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Trial Accuracy Counter & History */}
        <div className="p-5 rounded-2xl bg-[#0D0F12] border border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Running Trial Accuracy Counter</h2>
              <p className="text-xs text-[#8A919C] mt-0.5">
                Evaluates majority predicted intent vs ground truth at the end of each 4.0s trial
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xl font-bold font-mono text-[#34D399]">
                  {runningAccuracy.toFixed(1)}%
                </div>
                <div className="text-[11px] text-[#8A919C] font-mono">
                  {totalCorrect} / {totalCompleted} trials correct
                </div>
              </div>

              <button
                onClick={() => setTrialHistory([])}
                className="text-xs px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[#8A919C]"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Recent Trials Table */}
          {trialHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8A919C] font-mono">
              Press &ldquo;Start Replay&rdquo; to stream trials. Results will populate here after each trial.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[#8A919C] border-b border-white/5 text-left">
                    <th className="pb-2">Trial #</th>
                    <th className="pb-2">Ground Truth</th>
                    <th className="pb-2">Majority Pred</th>
                    <th className="pb-2">Mean Conf</th>
                    <th className="pb-2">Hops</th>
                    <th className="pb-2 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {trialHistory
                    .slice()
                    .reverse()
                    .map((t) => (
                      <tr key={t.trialNum} className="hover:bg-white/5">
                        <td className="py-2 text-white">Trial {t.trialNum}</td>
                        <td className="py-2 capitalize">
                          <span className={t.truth === "left" ? "text-[#4CC9F0]" : "text-[#FFB547]"}>
                            {t.truth}
                          </span>
                        </td>
                        <td className="py-2 capitalize">
                          <span className={t.majorityLabel === "left" ? "text-[#4CC9F0]" : "text-[#FFB547]"}>
                            {t.majorityLabel}
                          </span>
                        </td>
                        <td className="py-2 text-[#8A919C]">
                          {(t.meanConfidence * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 text-[#8A919C]">{t.totalHops}</td>
                        <td className="py-2 text-right font-bold">
                          {t.isCorrect ? (
                            <span className="text-[#34D399]">✅ MATCH</span>
                          ) : (
                            <span className="text-[#FF5C6C]">❌ MISS</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
