/**
 * TypeScript contract matching CONTRACTS.md exactly.
 */

export type MotorImageryClass = "left" | "right";

export type ReplayState = "idle" | "running" | "paused" | "finished";
export type ReplayMode = "open" | "scripted";

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

export interface HelloMsg {
  type: "hello";
  channels: string[];
  sfreq: number;
  classes: string[];
  window_s: number;
  hop_ms: number;
  subjects: number[];
  models: string[];
}

export interface FrameMsg {
  type: "frame";
  t: number;
  trial: number;
  trial_id: string;
  truth: MotorImageryClass | null;
  eeg: number[][]; // channels x samples-in-this-hop, microvolts
  bandpower: BandpowerPayload;
  pred: PredictionPayload;
  noise_snr_db: number | null;
}

export interface StatusMsg {
  type: "status";
  state: ReplayState;
  subject: number;
  model: string;
  mode?: ReplayMode;
}

export interface ErrorMsg {
  type: "error";
  message: string;
}

export interface ControlMsg {
  type: "control";
  action: "start" | "pause" | "reset" | "queue_trial" | "change_subject" | "change_speed";
  subject?: number;
  speed?: number;
  want?: MotorImageryClass;
}

export interface ConfigMsg {
  type: "config";
  model?: string;
  noise_snr_db?: number | null;
  threshold?: number;
  dwell_ms?: number;
  mode?: ReplayMode;
}

// Union types
export type ServerMsg = HelloMsg | FrameMsg | StatusMsg | ErrorMsg;
export type ClientMsg = ControlMsg | ConfigMsg;
export type WsMsg = ServerMsg | ClientMsg;
