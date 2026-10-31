export type MotorImageryClass = "left" | "right";

export type ReplayState = "idle" | "running" | "paused" | "finished";

export interface PredictionPayload {
  left: number;
  right: number;
  label: MotorImageryClass;
  confidence: number;
  latency_ms: number;
}

export interface BandpowerPayload {
  mu: number[];
  beta: number[];
}

export interface HelloMessage {
  type: "hello";
  channels: string[];
  sfreq: number;
  classes: MotorImageryClass[];
  window_s: number;
  hop_ms: number;
  subjects: number[];
  models: string[];
}

export interface FrameMessage {
  type: "frame";
  t: number;
  trial: number;
  truth: MotorImageryClass | null;
  eeg: number[][]; // channels x samples-in-hop (microvolts)
  bandpower: BandpowerPayload;
  pred: PredictionPayload;
  noise_snr_db: number | null;
}

export interface StatusMessage {
  type: "status";
  state: ReplayState;
  subject: number;
  model: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerMessage = HelloMessage | FrameMessage | StatusMessage | ErrorMessage;

export interface ClientControlMessage {
  type: "control";
  action: "start" | "pause" | "reset";
  subject?: number;
  speed?: number;
}

export interface ClientConfigMessage {
  type: "config";
  model?: string;
  noise_snr_db?: number | null;
  threshold?: number;
  dwell_ms?: number;
}

export type ClientMessage = ClientControlMessage | ClientConfigMessage;

export interface LatencyStats {
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

export interface SNRSweepPoint {
  snr_db: number | null;
  snr_label: string;
  accuracy: number;
}

export interface ModelMetrics {
  model: string;
  subject: number;
  accuracy: number;
  balanced_accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusion_matrix: number[][]; // [[TN, FP], [FN, TP]]
  latency_ms: LatencyStats;
  snr_curve: SNRSweepPoint[];
}

export type AllModelsMetrics = Record<string, ModelMetrics>;
