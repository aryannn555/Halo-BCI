from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import json
import logging
import time
import joblib
import numpy as np
import torch
import torch.nn as nn
from braindecode.models import EEGNet

from app.config import CACHE_DIR, CHANNELS, MODELS_DIR, SFREQ, WINDOW_S
from ml.preprocess import prepare_window

logger = logging.getLogger("halo.decoder")


class Decoder:
    """Production real-time EEG decoder for Halo BCI.

    Loads a trained model for (subject, model_name), applies the canonical prepare_window
    preprocessing, runs inference (torch under torch.inference_mode), tracks per-window
    latency in milliseconds, and applies an Exponential Moving Average (EMA) probability
    filter that resets cleanly between trials.
    """

    def __init__(
        self,
        subject: int = 1,
        model_name: str = "csp_lda",
        alpha: float = 0.35,
        device: Optional[str] = None,
    ):
        self.subject = subject
        self.model_name = model_name
        self.alpha = float(alpha)
        self.device = device or ("mps" if torch.backends.mps.is_available() else "cpu")

        self.pipeline: Any = None
        self.torch_model: Optional[nn.Module] = None
        self.metadata: Dict[str, Any] = {}

        self.smoothed_proba: Optional[np.ndarray] = None
        self.last_latency_ms: float = 0.0

        self._load()

    def _load(self) -> None:
        """Loads fitted model weights and configuration metadata."""
        subject_prefix = f"subject_{self.subject}_{self.model_name}"

        # 1. Try subject-specific model, fall back to global model
        joblib_path = MODELS_DIR / f"{subject_prefix}.joblib"
        if not joblib_path.exists():
            joblib_path = MODELS_DIR / f"{self.model_name}.joblib"

        pt_path = MODELS_DIR / f"{subject_prefix}.pt"
        if not pt_path.exists():
            pt_path = MODELS_DIR / f"{self.model_name}.pt"

        json_path = MODELS_DIR / f"{subject_prefix}.json"
        if not json_path.exists():
            json_path = MODELS_DIR / f"{self.model_name}.json"

        if json_path.exists():
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
            except Exception as e:
                logger.warning("Could not load metadata from %s: %s", json_path, e)

        if self.model_name in ("csp_lda", "shallow_fbcsp") or joblib_path.exists():
            if not joblib_path.exists():
                from ml.train import train_and_save_all_for_subject
                train_and_save_all_for_subject(self.subject, models=[self.model_name])
            self.pipeline = joblib.load(joblib_path)
            self.torch_model = None

        elif self.model_name == "eegnet" or pt_path.exists():
            if not pt_path.exists():
                from ml.train import train_and_save_all_for_subject
                train_and_save_all_for_subject(self.subject, models=["eegnet"])

            window_samples = int(WINDOW_S * SFREQ)
            net = EEGNet(
                n_chans=len(CHANNELS),
                n_outputs=2,
                n_times=window_samples,
                sfreq=float(SFREQ),
                drop_prob=0.0,
            ).to(self.device)

            state_dict = torch.load(pt_path, map_location=self.device, weights_only=True)
            net.load_state_dict(state_dict)
            net.eval()
            self.torch_model = net
            self.pipeline = None
        else:
            raise FileNotFoundError(
                f"No model found for subject {self.subject}, model {self.model_name} at {MODELS_DIR}"
            )

    def reset(self) -> None:
        """Resets the EMA smoothed probability filter between trials."""
        self.smoothed_proba = None

    def predict_proba(self, window: np.ndarray, sfreq: int = SFREQ) -> np.ndarray:
        """Runs inference on a single EEG window of shape (n_channels, n_samples).

        Preprocesses the window with prepare_window, measures wall-clock latency,
        and applies EMA smoothing.

        Returns
        -------
        np.ndarray
            Smoothed probabilities [p_left, p_right] of shape (2,).
        """
        probs, _ = self.predict(window, sfreq=sfreq)
        return probs

    def predict(
        self, window: np.ndarray, sfreq: int = SFREQ
    ) -> Tuple[np.ndarray, float]:
        """Runs inference and returns both smoothed probabilities and latency in ms.

        Parameters
        ----------
        window : np.ndarray
            Raw EEG window of shape (n_channels, n_samples).
        sfreq : int, default 250
            Sampling rate in Hz.

        Returns
        -------
        Tuple[np.ndarray, float]
            (smoothed_probs, latency_ms)
        """
        t0 = time.perf_counter()

        # Canonical single-path preprocessing
        prepared = prepare_window(window, sfreq=sfreq)

        if self.torch_model is not None:
            tensor_x = (
                torch.from_numpy(prepared)
                .unsqueeze(0)
                .to(self.device, dtype=torch.float32)
            )
            with torch.inference_mode():
                logits = self.torch_model(tensor_x)
                probs = torch.softmax(logits, dim=-1).squeeze(0).cpu().numpy().astype(np.float64)
        elif self.pipeline is not None:
            batch = np.expand_dims(prepared, axis=0)
            probs = self.pipeline.predict_proba(batch)[0].astype(np.float64)
        else:
            raise RuntimeError("Decoder has no loaded model pipeline or torch module.")

        t1 = time.perf_counter()
        self.last_latency_ms = (t1 - t0) * 1000.0

        # Exponential Moving Average (EMA) smoother over probabilities
        if self.smoothed_proba is None:
            self.smoothed_proba = probs.copy()
        else:
            self.smoothed_proba = (
                self.alpha * probs + (1.0 - self.alpha) * self.smoothed_proba
            )
            # Re-normalize to ensure sum is strictly 1.0
            total_p = np.sum(self.smoothed_proba)
            if total_p > 1e-8:
                self.smoothed_proba /= total_p

        return self.smoothed_proba.copy(), self.last_latency_ms

    def predict_window(
        self, window: np.ndarray, sfreq: float = float(SFREQ)
    ) -> Tuple[float, float, str, float, float]:
        """Convenience method matching live replay engine contract.

        Returns
        -------
        Tuple[float, float, str, float, float]
            (p_left, p_right, label, confidence, latency_ms)
        """
        probs, lat = self.predict(window, sfreq=int(sfreq))
        p_left = float(probs[0])
        p_right = float(probs[1])
        label = "left" if p_left >= p_right else "right"
        confidence = float(max(p_left, p_right))
        return (p_left, p_right, label, confidence, lat)


_MODEL_REGISTRY: Dict[Tuple[int, str], Decoder] = {}


def get_model(model_name: str, subject_id: int = 1) -> Decoder:
    """Returns a cached singleton Decoder instance for (subject, model_name)."""
    key = (subject_id, model_name)
    if key not in _MODEL_REGISTRY:
        _MODEL_REGISTRY[key] = Decoder(subject=subject_id, model_name=model_name)
    return _MODEL_REGISTRY[key]

