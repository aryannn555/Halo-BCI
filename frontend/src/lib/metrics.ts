/**
 * Types and utilities for benchmark evaluation metrics.
 * Loaded from GET /api/metrics (backend/results/metrics.json).
 */

export interface ClassPerformance {
  precision: number;
  recall: number;
  f1: number;
}

export interface LatencyStats {
  mean_ms: number;
  median_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface SubjectModelMetrics {
  subject: number;
  model: string;
  window_accuracy: number;
  window_kappa: number;
  trial_accuracy: number;
  trial_kappa: number;
  macro_f1: number;
  per_class: {
    left_hand: ClassPerformance;
    right_hand: ClassPerformance;
  };
  confusion_matrix: [[number, number], [number, number]];
  itr_bits_per_min: number;
  latency: LatencyStats;
  n_trials: number;
  n_windows: number;
}

export interface ModelSummary {
  mean_window_accuracy: number;
  std_window_accuracy: number;
  mean_trial_accuracy: number;
  std_trial_accuracy: number;
  mean_kappa: number;
  std_kappa: number;
  mean_macro_f1: number;
  mean_itr_bits_per_min: number;
  median_latency_ms: number;
  p95_latency_ms: number;
}

export interface RobustnessPoint {
  snr_db: string;
  snr_value: number | null;
  mean_accuracy: number;
  std_accuracy: number;
}

export interface BenchmarkMetrics {
  default_model: string;
  models_evaluated: string[];
  subjects_evaluated: number[];
  summary: Record<string, ModelSummary>;
  robustness_sweep: RobustnessPoint[];
  subjects: Record<string, Record<string, SubjectModelMetrics>>;
}

/**
 * Fetch evaluation metrics from the FastAPI backend.
 * Tries relative endpoint first (proxied by Next.js), then direct backend URL.
 */
export async function fetchMetrics(): Promise<BenchmarkMetrics | null> {
  const endpoints = ["/api/metrics", "http://localhost:8000/api/metrics"];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.summary && data.subjects) {
          return data as BenchmarkMetrics;
        }
      }
    } catch {
      // Continue to next endpoint attempt
    }
  }

  return null;
}

/**
 * Aggregates confusion matrix across all subjects or returns a single subject's matrix.
 * Matrix shape: [[Actual Left Pred Left, Actual Left Pred Right], [Actual Right Pred Left, Actual Right Pred Right]]
 */
export function getConfusionMatrix(
  data: BenchmarkMetrics,
  model: string,
  subjectId?: number | null
): [[number, number], [number, number]] {
  if (subjectId !== null && subjectId !== undefined) {
    const subStr = String(subjectId);
    const subMetrics = data.subjects[subStr]?.[model];
    if (subMetrics?.confusion_matrix) {
      return subMetrics.confusion_matrix;
    }
  }

  // Aggregate across all evaluated subjects
  let tn = 0; // True Left
  let fp = 0; // False Right (Actual Left, Pred Right)
  let fn = 0; // False Left (Actual Right, Pred Left)
  let tp = 0; // True Right

  for (const sub of data.subjects_evaluated) {
    const subMetrics = data.subjects[String(sub)]?.[model];
    if (subMetrics?.confusion_matrix) {
      const [[subTN, subFP], [subFN, subTP]] = subMetrics.confusion_matrix;
      tn += subTN;
      fp += subFP;
      fn += subFN;
      tp += subTP;
    }
  }

  return [
    [tn, fp],
    [fn, tp],
  ];
}

export interface AggregatedClassMetrics {
  left_hand: ClassPerformance;
  right_hand: ClassPerformance;
  macro_f1: number;
}

/**
 * Aggregates or retrieves precision, recall, and F1 for a given model and optional subject filter.
 */
export function getClassMetrics(
  data: BenchmarkMetrics,
  model: string,
  subjectId?: number | null
): AggregatedClassMetrics {
  if (subjectId !== null && subjectId !== undefined) {
    const subMetrics = data.subjects[String(subjectId)]?.[model];
    if (subMetrics) {
      return {
        left_hand: subMetrics.per_class.left_hand,
        right_hand: subMetrics.per_class.right_hand,
        macro_f1: subMetrics.macro_f1,
      };
    }
  }

  // Aggregate across all subjects
  let totalLeftP = 0;
  let totalLeftR = 0;
  let totalLeftF1 = 0;
  let totalRightP = 0;
  let totalRightR = 0;
  let totalRightF1 = 0;
  let count = 0;

  for (const sub of data.subjects_evaluated) {
    const subMetrics = data.subjects[String(sub)]?.[model];
    if (subMetrics?.per_class) {
      totalLeftP += subMetrics.per_class.left_hand.precision;
      totalLeftR += subMetrics.per_class.left_hand.recall;
      totalLeftF1 += subMetrics.per_class.left_hand.f1;
      totalRightP += subMetrics.per_class.right_hand.precision;
      totalRightR += subMetrics.per_class.right_hand.recall;
      totalRightF1 += subMetrics.per_class.right_hand.f1;
      count += 1;
    }
  }

  if (count === 0) {
    return {
      left_hand: { precision: 0, recall: 0, f1: 0 },
      right_hand: { precision: 0, recall: 0, f1: 0 },
      macro_f1: 0,
    };
  }

  const left_hand = {
    precision: totalLeftP / count,
    recall: totalLeftR / count,
    f1: totalLeftF1 / count,
  };

  const right_hand = {
    precision: totalRightP / count,
    recall: totalRightR / count,
    f1: totalRightF1 / count,
  };

  return {
    left_hand,
    right_hand,
    macro_f1: (left_hand.f1 + right_hand.f1) / 2,
  };
}
