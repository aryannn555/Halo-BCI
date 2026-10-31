import { describe, it, expect } from "vitest";
import { calculateDecisionStats, DecisionRecord } from "./useDecisions";

describe("Decision Log & Telemetry Stats", () => {
  it("returns default stats when decision log is empty", () => {
    const stats = calculateDecisionStats([]);
    expect(stats.total).toBe(0);
    expect(stats.correctCount).toBe(0);
    expect(stats.accuracy).toBe(100);
    expect(stats.estCharsPerMin).toBe(0);
  });

  it("calculates accuracy and average decision time correctly", () => {
    const mockRecords: DecisionRecord[] = [
      {
        id: "1",
        time: 1000,
        decided: "left",
        intended: "left",
        correct: true,
        trial_id: "sub01_trial_1",
        decision_ms: 1000,
      },
      {
        id: "2",
        time: 2500,
        decided: "right",
        intended: "left",
        correct: false,
        trial_id: "sub01_trial_2",
        decision_ms: 1200,
      },
      {
        id: "3",
        time: 4000,
        decided: "right",
        intended: "right",
        correct: true,
        trial_id: "sub01_trial_3",
        decision_ms: 800,
      },
      {
        id: "4",
        time: 5500,
        decided: "left",
        intended: "left",
        correct: true,
        trial_id: "sub01_trial_4",
        decision_ms: 1000,
      },
    ];

    const stats = calculateDecisionStats(mockRecords, 4.0);

    expect(stats.total).toBe(4);
    expect(stats.correctCount).toBe(3);
    expect(stats.accuracy).toBe(75.0); // 3 out of 4 = 75%
    expect(stats.avgDecisionMs).toBe(1000); // (1000+1200+800+1000)/4 = 1000 ms

    // Decisions/min = 60000 / 1000 = 60 decisions/min
    // Net forward factor for 75% accuracy = 2*(0.75) - 1 = 0.50
    // Net chars/min = (60 / 4.0) * 0.5 = 7.5 CPM
    expect(stats.estCharsPerMin).toBe(7.5);
  });

  it("handles high accuracy with fast decision times", () => {
    const perfectRecords: DecisionRecord[] = Array.from({ length: 10 }, (_, i) => ({
      id: `rec-${i}`,
      time: 1000 + i * 800,
      decided: "left",
      intended: "left",
      correct: true,
      trial_id: `trial_${i}`,
      decision_ms: 750,
    }));

    const stats = calculateDecisionStats(perfectRecords, 3.5);
    expect(stats.accuracy).toBe(100);
    expect(stats.avgDecisionMs).toBe(750);
    // 60000 / 750 = 80 decisions/min. Net forward = 1.0. Chars/min = 80 / 3.5 = 22.9
    expect(stats.estCharsPerMin).toBeGreaterThan(20);
  });
});
