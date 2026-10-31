import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Coroutine, Dict, List, Optional, Tuple
import numpy as np

from app.config import (
    CHANNELS,
    CLASSES,
    HOP_MS,
    MODELS,
    SFREQ,
    SUBJECTS,
    WINDOW_S,
)
from ml.data import load_subject
from ml.decoder import Decoder
from ml.noise import corrupt

logger = logging.getLogger("halo.replay")


class ReplaySession:
    """Manages an individual WebSocket client's real-time continuous replay stream.

    Streams recorded BCI Competition IV-2a held-out test data (1test) trial by trial in
    100 ms hops (25 samples at 250 Hz) with sub-millisecond drift-free monotonic scheduling.
    Maintains a 2.0 s ring buffer, computes Mu/Beta bandpower ratio relative to a rolling
    baseline, delegates decoder inference to a thread pool executor, and injects realistic noise.
    """

    def __init__(
        self,
        broadcast_fn: Callable[[Dict[str, Any]], Coroutine[Any, Any, None]],
        subject: int = 1,
        model_name: str = "csp_lda",
        speed: float = 1.0,
    ):
        self.broadcast_fn = broadcast_fn
        self.subject: int = subject
        self.model_name: str = model_name
        self.speed: float = max(0.1, float(speed))

        # Runtime configuration
        self.noise_snr_db: Optional[float] = None
        self.threshold: float = 0.50
        self.dwell_ms: float = 600.0
        self.mode: str = "open"  # "open" | "scripted"

        # State: "idle" | "running" | "paused" | "finished"
        self.state: str = "idle"
        self._task: Optional[asyncio.Task] = None
        self._trial_event: Optional[asyncio.Event] = None
        self.thread_pool = ThreadPoolExecutor(max_workers=2)
        self.rng = np.random.default_rng(42)

        # Signal constants
        self.sfreq: int = SFREQ
        self.channels: List[str] = list(CHANNELS)
        self.n_channels: int = len(self.channels)
        self.window_samples: int = int(round(WINDOW_S * self.sfreq))  # 500
        self.hop_samples: int = int(round((HOP_MS / 1000.0) * self.sfreq))  # 25

        # Ring buffer & baseline power state
        self.ring_buffer = np.zeros((self.n_channels, self.window_samples), dtype=np.float32)
        self.mu_baseline: Optional[np.ndarray] = None
        self.beta_baseline: Optional[np.ndarray] = None

        # Data arrays (held-out test session)
        self.X_test: np.ndarray = np.empty((0, self.n_channels, 0), dtype=np.float32)
        self.y_test: np.ndarray = np.empty((0,), dtype=np.int64)
        self.trial_powers: List[float] = []
        self.current_trial_idx: int = 0
        self.trial_ids: List[str] = []
        self.left_pool: List[int] = []
        self.right_pool: List[int] = []
        self.left_ptr: int = 0
        self.right_ptr: int = 0
        self.last_trial_idx: Optional[int] = None

        # Decoder instance
        self.decoder: Optional[Decoder] = None

        # Monotonic clock state for drift-free scheduling
        self._anchor_mono_time: float = 0.0
        self._anchor_hop_count: int = 0
        self._total_hops_streamed: int = 0

        # Load initial subject & decoder
        self._load_subject_data(self.subject)
        self._load_decoder(self.model_name)

    def _load_subject_data(self, subject: int) -> None:
        """Loads held-out session 1test trials from cached subject data."""
        self.subject = subject
        X_all, y_all, channels, meta = load_subject(subject)

        # Select held-out session 1test
        test_mask = meta["session"] == "1test"
        if np.any(test_mask):
            X_sess = X_all[test_mask]
            y_sess = y_all[test_mask]
        else:
            X_sess = X_all
            y_sess = y_all

        # Convert to microvolts if data is stored in Volts (e.g. peak < 0.05)
        max_abs = float(np.max(np.abs(X_sess))) if X_sess.size > 0 else 0.0
        if max_abs < 0.05:
            X_sess = X_sess * 1e6

        self.X_test = X_sess.astype(np.float32)
        self.y_test = y_sess.astype(np.int64)

        # Precompute signal power per trial for immediate mid-stream noise scaling
        self.trial_powers = [
            float(np.mean(self.X_test[i] ** 2)) if self.X_test[i].size > 0 else 100.0
            for i in range(len(self.X_test))
        ]
        self.current_trial_idx = 0

        # Stable trial IDs and class pools
        self.trial_ids = [
            f"sub{self.subject:02d}_sess1_trial{i+1:03d}_{'left' if y == 0 else 'right'}"
            for i, y in enumerate(self.y_test)
        ]
        self.left_pool = [i for i, y in enumerate(self.y_test) if y == 0]
        self.right_pool = [i for i, y in enumerate(self.y_test) if y == 1]
        self.left_ptr = 0
        self.right_ptr = 0
        self.last_trial_idx = None

        # Prime ring buffer with the initial resting baseline of the first trial
        if len(self.X_test) > 0 and self.X_test.shape[-1] >= self.window_samples:
            self.ring_buffer = self.X_test[0, :, :self.window_samples].copy()
        else:
            self.ring_buffer = np.zeros((self.n_channels, self.window_samples), dtype=np.float32)

        # Reset rolling baselines
        self.mu_baseline = None
        self.beta_baseline = None

    def _load_decoder(self, model_name: str) -> None:
        """Initializes decoder instance for current subject and model architecture."""
        self.model_name = model_name
        try:
            self.decoder = Decoder(subject=self.subject, model_name=model_name)
        except Exception as e:
            logger.warning("Could not initialize decoder for subject %d, model %s: %s", self.subject, model_name, e)
            self.decoder = None

    def get_hello_payload(self) -> Dict[str, Any]:
        """Handshake payload conforming strictly to CONTRACTS.md."""
        return {
            "type": "hello",
            "channels": self.channels,
            "sfreq": self.sfreq,
            "classes": ["left", "right"],
            "window_s": float(WINDOW_S),
            "hop_ms": HOP_MS,
            "subjects": SUBJECTS,
            "models": MODELS,
        }

    def get_status_payload(self) -> Dict[str, Any]:
        """Status payload reflecting current engine state."""
        return {
            "type": "status",
            "state": self.state,
            "subject": self.subject,
            "model": self.model_name,
            "mode": self.mode,
        }

    async def queue_trial(self, want: str) -> None:
        """Immediately ends the current trial and starts the next held-out trial of that class.

        Cycles through the pool, never repeating the same trial twice in a row (if pool > 1).
        Resets the decoder smoother and ring buffer at trial start.
        """
        want_clean = want.strip().lower() if want else "left"
        if want_clean not in ("left", "right"):
            want_clean = "left"

        pool = self.left_pool if want_clean == "left" else self.right_pool
        if not pool:
            logger.warning("No test trials available for class: %s", want_clean)
            return

        # Pick next from pool, avoiding consecutive repeat
        ptr = self.left_ptr if want_clean == "left" else self.right_ptr
        next_idx = pool[ptr % len(pool)]
        if len(pool) > 1 and next_idx == self.last_trial_idx:
            ptr += 1
            next_idx = pool[ptr % len(pool)]

        if want_clean == "left":
            self.left_ptr = (ptr + 1) % len(pool)
        else:
            self.right_ptr = (ptr + 1) % len(pool)

        self.last_trial_idx = next_idx
        self.current_trial_idx = next_idx

        # Signal running replay loop to break immediately
        if self._trial_event:
            self._trial_event.set()

        # If engine was not running, launch it
        if self.state != "running":
            await self.start()

    async def start(self) -> None:
        """Starts or resumes replay streaming."""
        if self.state == "running":
            return

        if self.state == "finished":
            self.current_trial_idx = 0
            self._total_hops_streamed = 0

        self.state = "running"
        self._anchor_mono_time = time.monotonic()
        self._anchor_hop_count = self._total_hops_streamed

        await self.broadcast_fn(self.get_status_payload())

        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._replay_loop())

    async def pause(self) -> None:
        """Pauses streaming while keeping current trial position."""
        if self.state == "paused":
            return
        self.state = "paused"
        await self.broadcast_fn(self.get_status_payload())

    async def reset(self) -> None:
        """Resets stream back to trial 1 and idle state."""
        self.state = "idle"
        self.current_trial_idx = 0
        self._total_hops_streamed = 0
        self._anchor_hop_count = 0
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        if len(self.X_test) > 0:
            self.ring_buffer = self.X_test[0, :, :self.window_samples].copy()
        if self.decoder:
            self.decoder.reset()

        await self.broadcast_fn(self.get_status_payload())

    async def set_subject(self, subject: int) -> None:
        """Switches subject, loads held-out test data, and updates decoder."""
        was_running = (self.state == "running")
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        self._load_subject_data(subject)
        self._load_decoder(self.model_name)
        self._total_hops_streamed = 0
        self._anchor_hop_count = 0

        if was_running:
            self.state = "running"
            self._anchor_mono_time = time.monotonic()
            self._task = asyncio.create_task(self._replay_loop())
        else:
            self.state = "idle"

        await self.broadcast_fn(self.get_status_payload())

    async def set_speed(self, speed: float) -> None:
        """Updates replay playback speed with immediate clock re-anchoring."""
        self.speed = max(0.1, float(speed))
        # Re-anchor clock to prevent drift jump when speed changes mid-stream
        self._anchor_mono_time = time.monotonic()
        self._anchor_hop_count = self._total_hops_streamed

    async def set_config(
        self,
        model: Optional[str] = None,
        noise_snr_db: Optional[float] = None,
        threshold: Optional[float] = None,
        dwell_ms: Optional[float] = None,
        mode: Optional[str] = None,
    ) -> None:
        """Updates runtime configuration settings."""
        if model is not None and model != self.model_name:
            self.model_name = model
            self._load_decoder(model)

        if noise_snr_db is not None or "noise_snr_db" in locals():
            self.noise_snr_db = noise_snr_db

        if threshold is not None:
            self.threshold = float(threshold)

        if dwell_ms is not None:
            self.dwell_ms = float(dwell_ms)

        if mode is not None and mode in ("open", "scripted"):
            self.mode = mode

        await self.broadcast_fn(self.get_status_payload())

    def _compute_bandpower_ratio(self, window: np.ndarray) -> Dict[str, List[float]]:
        """Computes Mu (8-12 Hz) and Beta (13-30 Hz) power per channel and normalizes

        against that channel's rolling baseline (~20s EMA). Values < 1.0 indicate ERD.
        """
        # Demean window
        win_dm = window - np.mean(window, axis=-1, keepdims=True)

        # FFT power spectral density estimate
        fft_vals = np.abs(np.fft.rfft(win_dm, axis=-1)) ** 2 / float(win_dm.shape[-1])
        freqs = np.fft.rfftfreq(win_dm.shape[-1], d=1.0 / float(self.sfreq))

        mu_mask = (freqs >= 8.0) & (freqs <= 12.0)
        beta_mask = (freqs >= 13.0) & (freqs <= 30.0)

        mu_pow = np.mean(fft_vals[:, mu_mask], axis=-1) if np.any(mu_mask) else np.zeros(self.n_channels)
        beta_pow = np.mean(fft_vals[:, beta_mask], axis=-1) if np.any(beta_mask) else np.zeros(self.n_channels)

        # Exponential moving average baseline (~20 s time constant at 10 Hz hop rate -> alpha = 0.005)
        alpha = 0.005
        if self.mu_baseline is None:
            self.mu_baseline = np.maximum(1e-4, mu_pow.copy())
            self.beta_baseline = np.maximum(1e-4, beta_pow.copy())
        else:
            self.mu_baseline = (1.0 - alpha) * self.mu_baseline + alpha * np.maximum(1e-4, mu_pow)
            self.beta_baseline = (1.0 - alpha) * self.beta_baseline + alpha * np.maximum(1e-4, beta_pow)

        # Calculate ratio to baseline: 1.0 = resting baseline, < 1.0 = desynchronization (ERD)
        mu_ratio = [round(float(m / max(1e-4, b)), 4) for m, b in zip(mu_pow, self.mu_baseline)]
        beta_ratio = [round(float(be / max(1e-4, b)), 4) for be, b in zip(beta_pow, self.beta_baseline)]

        return {"mu": mu_ratio, "beta": beta_ratio}

    async def _replay_loop(self) -> None:
        """Main asynchronous streaming loop.

        Streams 4.0 s trial epochs in 100 ms hops followed by a 1.0 s resting gap (in open mode)
        or looped final second (in scripted mode). Supports immediate interruption via queue_trial.
        Maintains sub-millisecond drift-free monotonic scheduling.
        """
        loop = asyncio.get_running_loop()
        hop_s = HOP_MS / 1000.0  # 0.1 s
        if self._trial_event is None:
            self._trial_event = asyncio.Event()

        try:
            n_trials = len(self.X_test)
            if n_trials == 0:
                self.state = "finished"
                await self.broadcast_fn(self.get_status_payload())
                return

            while self.state == "running" and self.current_trial_idx < n_trials:
                trial_idx = self.current_trial_idx
                trial_eeg = self.X_test[trial_idx]
                trial_label_int = int(self.y_test[trial_idx])
                truth_label: str = "left" if trial_label_int == 0 else "right"
                trial_num = trial_idx + 1
                trial_id = self.trial_ids[trial_idx] if trial_idx < len(self.trial_ids) else f"trial_{trial_num}"

                self._trial_event.clear()
                self.last_trial_idx = trial_idx

                # Reset ring buffer and decoder smoother at trial start
                self.ring_buffer = np.zeros((self.n_channels, self.window_samples), dtype=np.float32)
                if self.decoder:
                    self.decoder.reset()

                n_samples_trial = trial_eeg.shape[-1]
                n_trial_hops = n_samples_trial // self.hop_samples

                # 1. Active Trial Hops (4.0 s)
                interrupted = False
                for h in range(n_trial_hops):
                    if self.state != "running":
                        return
                    if self._trial_event.is_set():
                        interrupted = True
                        break

                    st = h * self.hop_samples
                    en = st + self.hop_samples
                    incoming_chunk = trial_eeg[:, st:en].copy()

                    # Apply noise to incoming chunk if configured
                    if self.noise_snr_db is not None:
                        incoming_chunk = corrupt(
                            incoming_chunk,
                            sfreq=float(self.sfreq),
                            snr_db=self.noise_snr_db,
                            rng=self.rng,
                        )

                    # Update ring buffer
                    self.ring_buffer[:, :-self.hop_samples] = self.ring_buffer[:, self.hop_samples:]
                    self.ring_buffer[:, -self.hop_samples:] = incoming_chunk

                    # Decoder inference in thread pool to prevent event loop blocking
                    ring_snapshot = self.ring_buffer.copy()
                    if self.decoder:
                        probs, lat_ms = await loop.run_in_executor(
                            self.thread_pool,
                            self.decoder.predict,
                            ring_snapshot,
                            self.sfreq,
                        )
                        p_left = float(probs[0])
                        p_right = float(probs[1])
                    else:
                        p_left, p_right, lat_ms = 0.5, 0.5, 0.5

                    pred_label = "left" if p_left >= p_right else "right"
                    confidence = max(p_left, p_right)

                    # Compute spectral bandpower ratio
                    bandpower = self._compute_bandpower_ratio(ring_snapshot)

                    # Format EEG hop payload (channels x samples)
                    eeg_payload = [
                        [round(float(v), 2) for v in ch_samples]
                        for ch_samples in incoming_chunk
                    ]

                    # Current replay time (seconds from start of streaming)
                    current_t = round(self._total_hops_streamed * hop_s, 2)

                    frame = {
                        "type": "frame",
                        "t": current_t,
                        "trial": trial_num,
                        "trial_id": trial_id,
                        "truth": truth_label,
                        "eeg": eeg_payload,
                        "bandpower": bandpower,
                        "pred": {
                            "left": round(p_left, 4),
                            "right": round(p_right, 4),
                            "label": pred_label,
                            "confidence": round(confidence, 4),
                            "latency_ms": round(lat_ms, 2),
                        },
                        "noise_snr_db": self.noise_snr_db,
                    }

                    await self.broadcast_fn(frame)

                    # Advance hop counters
                    self._total_hops_streamed += 1

                    # Monotonic clock scheduling with zero cumulative drift
                    effective_hop_duration = hop_s / self.speed
                    elapsed_hops = self._total_hops_streamed - self._anchor_hop_count
                    target_time = self._anchor_mono_time + (elapsed_hops * effective_hop_duration)
                    sleep_time = target_time - time.monotonic()
                    if sleep_time > 0.001:
                        try:
                            await asyncio.wait_for(self._trial_event.wait(), timeout=sleep_time)
                            interrupted = True
                            break
                        except asyncio.TimeoutError:
                            pass
                    else:
                        await asyncio.sleep(0.0005)

                if interrupted or self._trial_event.is_set():
                    continue

                if self.state != "running":
                    return

                # 2. Mode-dependent post-trial behavior
                if self.mode == "scripted":
                    # Scripted mode: loop the final second (last 10 hops) until queue_trial arrives
                    final_sec_start = max(0, n_trial_hops - 10)
                    while self.state == "running" and not self._trial_event.is_set():
                        for h in range(final_sec_start, n_trial_hops):
                            if self.state != "running" or self._trial_event.is_set():
                                break

                            st = h * self.hop_samples
                            en = st + self.hop_samples
                            incoming_chunk = trial_eeg[:, st:en].copy()

                            if self.noise_snr_db is not None:
                                incoming_chunk = corrupt(
                                    incoming_chunk,
                                    sfreq=float(self.sfreq),
                                    snr_db=self.noise_snr_db,
                                    rng=self.rng,
                                )

                            self.ring_buffer[:, :-self.hop_samples] = self.ring_buffer[:, self.hop_samples:]
                            self.ring_buffer[:, -self.hop_samples:] = incoming_chunk

                            ring_snapshot = self.ring_buffer.copy()
                            if self.decoder:
                                probs, lat_ms = await loop.run_in_executor(
                                    self.thread_pool,
                                    self.decoder.predict,
                                    ring_snapshot,
                                    self.sfreq,
                                )
                                p_left = float(probs[0])
                                p_right = float(probs[1])
                            else:
                                p_left, p_right, lat_ms = 0.5, 0.5, 0.5

                            pred_label = "left" if p_left >= p_right else "right"
                            confidence = max(p_left, p_right)
                            bandpower = self._compute_bandpower_ratio(ring_snapshot)

                            eeg_payload = [
                                [round(float(v), 2) for v in ch_samples]
                                for ch_samples in incoming_chunk
                            ]

                            current_t = round(self._total_hops_streamed * hop_s, 2)
                            frame = {
                                "type": "frame",
                                "t": current_t,
                                "trial": trial_num,
                                "trial_id": trial_id,
                                "truth": truth_label,
                                "eeg": eeg_payload,
                                "bandpower": bandpower,
                                "pred": {
                                    "left": round(p_left, 4),
                                    "right": round(p_right, 4),
                                    "label": pred_label,
                                    "confidence": round(confidence, 4),
                                    "latency_ms": round(lat_ms, 2),
                                },
                                "noise_snr_db": self.noise_snr_db,
                            }
                            await self.broadcast_fn(frame)

                            self._total_hops_streamed += 1
                            effective_hop_duration = hop_s / self.speed
                            elapsed_hops = self._total_hops_streamed - self._anchor_hop_count
                            target_time = self._anchor_mono_time + (elapsed_hops * effective_hop_duration)
                            sleep_time = target_time - time.monotonic()
                            if sleep_time > 0.001:
                                try:
                                    await asyncio.wait_for(self._trial_event.wait(), timeout=sleep_time)
                                    break
                                except asyncio.TimeoutError:
                                    pass
                            else:
                                await asyncio.sleep(0.0005)

                    if self._trial_event.is_set():
                        continue
                    if self.state != "running":
                        return
                else:
                    # Open mode: Short 1.0 s Rest Gap Between Trials (10 hops with truth=null)
                    n_rest_hops = 10
                    for _ in range(n_rest_hops):
                        if self.state != "running" or self._trial_event.is_set():
                            break

                        # Resting chunk: slight background sensor noise
                        rest_chunk = (self.rng.standard_normal((self.n_channels, self.hop_samples)) * 1.5).astype(np.float32)
                        if self.noise_snr_db is not None:
                            rest_chunk = corrupt(
                                rest_chunk,
                                sfreq=float(self.sfreq),
                                snr_db=self.noise_snr_db,
                                rng=self.rng,
                            )

                        self.ring_buffer[:, :-self.hop_samples] = self.ring_buffer[:, self.hop_samples:]
                        self.ring_buffer[:, -self.hop_samples:] = rest_chunk

                        ring_snapshot = self.ring_buffer.copy()
                        if self.decoder:
                            probs, lat_ms = await loop.run_in_executor(
                                self.thread_pool,
                                self.decoder.predict,
                                ring_snapshot,
                                self.sfreq,
                            )
                            p_left = float(probs[0])
                            p_right = float(probs[1])
                        else:
                            p_left, p_right, lat_ms = 0.5, 0.5, 0.5

                        pred_label = "left" if p_left >= p_right else "right"
                        confidence = max(p_left, p_right)
                        bandpower = self._compute_bandpower_ratio(ring_snapshot)

                        eeg_payload = [
                            [round(float(v), 2) for v in ch_samples]
                            for ch_samples in rest_chunk
                        ]

                        current_t = round(self._total_hops_streamed * hop_s, 2)
                        frame = {
                            "type": "frame",
                            "t": current_t,
                            "trial": trial_num,
                            "trial_id": trial_id,
                            "truth": None,  # Rest interval
                            "eeg": eeg_payload,
                            "bandpower": bandpower,
                            "pred": {
                                "left": round(p_left, 4),
                                "right": round(p_right, 4),
                                "label": pred_label,
                                "confidence": round(confidence, 4),
                                "latency_ms": round(lat_ms, 2),
                            },
                            "noise_snr_db": self.noise_snr_db,
                        }

                        await self.broadcast_fn(frame)

                        self._total_hops_streamed += 1
                        effective_hop_duration = hop_s / self.speed
                        elapsed_hops = self._total_hops_streamed - self._anchor_hop_count
                        target_time = self._anchor_mono_time + (elapsed_hops * effective_hop_duration)
                        sleep_time = target_time - time.monotonic()
                        if sleep_time > 0.001:
                            try:
                                await asyncio.wait_for(self._trial_event.wait(), timeout=sleep_time)
                                break
                            except asyncio.TimeoutError:
                                pass
                        else:
                            await asyncio.sleep(0.0005)

                    if self._trial_event.is_set():
                        continue

                    self.current_trial_idx = (self.current_trial_idx + 1) % n_trials

            # End of test session
            if self.current_trial_idx >= n_trials:
                self.state = "finished"
                await self.broadcast_fn(self.get_status_payload())
                await self.broadcast_fn(self.get_status_payload())

        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.exception("Error in replay stream loop: %s", exc)
            self.state = "idle"
            await self.broadcast_fn({
                "type": "error",
                "message": f"Replay stream error: {str(exc)}",
            })

    def close(self) -> None:
        """Cleanly tears down session resources and background task."""
        if self._task and not self._task.done():
            self._task.cancel()
        self.thread_pool.shutdown(wait=False)
