import { describe, it, expect } from "vitest";
import { updateDwellState, InternalDwellTracking } from "./useIntent";

describe("updateDwellState", () => {
  const initialTracking: InternalDwellTracking = {
    currentLabel: null,
    armedSince: null,
    cooldownUntil: 0,
    lastFired: null,
  };

  it("remains disarmed when confidence is below threshold", () => {
    const { tracking, state } = updateDwellState(initialTracking, {
      pred: { left: 0.55, right: 0.45, label: "left", confidence: 0.55 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1000,
    });

    expect(state.armed).toBe(false);
    expect(state.dwellProgress).toBe(0);
    expect(state.fired).toBeNull();
    expect(tracking.armedSince).toBeNull();
  });

  it("arms and accumulates dwell progress when confidence meets threshold", () => {
    // Tick 1: starts at t=1000
    const res1 = updateDwellState(initialTracking, {
      pred: { left: 0.85, right: 0.15, label: "left", confidence: 0.85 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1000,
    });

    expect(res1.state.armed).toBe(true);
    expect(res1.state.dwellProgress).toBe(0);

    // Tick 2: at t=1300 (halfway through 600ms dwell)
    const res2 = updateDwellState(res1.tracking, {
      pred: { left: 0.88, right: 0.12, label: "left", confidence: 0.88 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1300,
    });

    expect(res2.state.armed).toBe(true);
    expect(res2.state.dwellProgress).toBeCloseTo(0.5, 2);
    expect(res2.state.fired).toBeNull();
  });

  it("resets dwell progress if confidence drops mid-dwell", () => {
    const res1 = updateDwellState(initialTracking, {
      pred: { left: 0.85, right: 0.15, label: "left", confidence: 0.85 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1000,
    });

    // Advance 300ms
    const res2 = updateDwellState(res1.tracking, {
      pred: { left: 0.85, right: 0.15, label: "left", confidence: 0.85 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1300,
    });
    expect(res2.state.dwellProgress).toBeCloseTo(0.5, 2);

    // Confidence drops below threshold
    const res3 = updateDwellState(res2.tracking, {
      pred: { left: 0.60, right: 0.40, label: "left", confidence: 0.60 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1400,
    });
    expect(res3.state.armed).toBe(false);
    expect(res3.state.dwellProgress).toBe(0);
  });

  it("resets dwell progress if intent switches from left to right", () => {
    const res1 = updateDwellState(initialTracking, {
      pred: { left: 0.85, right: 0.15, label: "left", confidence: 0.85 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1000,
    });

    // Advance 400ms on left
    const res2 = updateDwellState(res1.tracking, {
      pred: { left: 0.85, right: 0.15, label: "left", confidence: 0.85 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1400,
    });
    expect(res2.state.dwellProgress).toBeCloseTo(400 / 600, 2);

    // Suddenly right hand becomes armed
    const res3 = updateDwellState(res2.tracking, {
      pred: { left: 0.20, right: 0.80, label: "right", confidence: 0.80 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1450,
    });
    expect(res3.state.armed).toBe(true);
    // Should reset progress for the new label
    expect(res3.state.dwellProgress).toBe(0);
    expect(res3.tracking.currentLabel).toBe("right");
  });

  it("fires intent when dwellProgress reaches 1.0 and enters 700ms cooldown", () => {
    const res1 = updateDwellState(initialTracking, {
      pred: { left: 0.85, right: 0.15, label: "left", confidence: 0.85 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1000,
    });

    // Exactly 600ms later at t=1600
    const res2 = updateDwellState(res1.tracking, {
      pred: { left: 0.90, right: 0.10, label: "left", confidence: 0.90 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1600,
    });

    expect(res2.state.fired).not.toBeNull();
    expect(res2.state.fired?.label).toBe("left");
    expect(res2.state.fired?.timestamp).toBe(1600);
    expect(res2.state.cooldownUntil).toBe(1600 + 700);

    // During cooldown at t=1900 (300ms into cooldown)
    const res3 = updateDwellState(res2.tracking, {
      pred: { left: 0.95, right: 0.05, label: "left", confidence: 0.95 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 1900,
    });

    expect(res3.state.armed).toBe(false);
    expect(res3.state.dwellProgress).toBe(0);
    expect(res3.state.fired).toBeNull();

    // After cooldown at t=2301
    const res4 = updateDwellState(res3.tracking, {
      pred: { left: 0.95, right: 0.05, label: "left", confidence: 0.95 },
      threshold: 0.65,
      dwellMs: 600,
      currentTime: 2301,
    });

    expect(res4.state.armed).toBe(true);
    expect(res4.state.dwellProgress).toBe(0);
  });
});
