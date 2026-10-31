import json
from pathlib import Path
import numpy as np
import pytest

from app.config import CHANNELS, SFREQ, WINDOW_S
from ml.decoder import Decoder
from ml.noise import add_white_noise, corrupt
from ml.preprocess import prepare_window


def test_prepare_window_shape_dtype_and_validity():
    """Verify prepare_window maintains shape, outputs float32, and contains no NaN or Inf."""
    n_channels = 22
    n_samples = int(WINDOW_S * SFREQ)  # 500
    raw = np.random.randn(n_channels, n_samples) * 25.0  # ~25 uV typical EEG

    out = prepare_window(raw, sfreq=SFREQ)

    assert out.shape == (n_channels, n_samples), f"Expected shape {(n_channels, n_samples)}, got {out.shape}"
    assert out.dtype == np.float32, f"Expected dtype float32, got {out.dtype}"
    assert not np.isnan(out).any(), "prepare_window output contains NaN"
    assert not np.isinf(out).any(), "prepare_window output contains Inf"


def test_prepare_window_deterministic():
    """Verify prepare_window produces identical output across repeated invocations."""
    rng = np.random.default_rng(12345)
    raw = rng.standard_normal(size=(22, 500)) * 18.5

    out1 = prepare_window(raw, sfreq=SFREQ)
    out2 = prepare_window(raw, sfreq=SFREQ)

    np.testing.assert_allclose(out1, out2, rtol=1e-6, atol=1e-6, err_msg="prepare_window is not deterministic")


def test_decoder_probabilities_and_latency():
    """Verify Decoder inference produces valid probabilities summing to 1.0 and reports latency."""
    decoder = Decoder(subject=1, model_name="csp_lda")
    decoder.reset_trial()

    raw_window = np.random.randn(22, 500) * 15.0
    probs, latency_ms = decoder.predict(raw_window, sfreq=SFREQ)

    assert probs.shape == (2,), f"Expected shape (2,), got {probs.shape}"
    assert np.all(probs >= 0.0) and np.all(probs <= 1.0), f"Probabilities out of range: {probs}"
    assert pytest.approx(float(np.sum(probs)), rel=1e-4) == 1.0, f"Probabilities do not sum to 1.0: {probs}"
    assert latency_ms > 0.0, f"Expected positive latency, got {latency_ms}"
    assert latency_ms < 50.0, f"Decoder latency {latency_ms:.2f} ms exceeded 50 ms budget"


def test_noise_snr_within_1db():
    """Verify corrupt and add_white_noise achieve target SNR within 1.0 dB."""
    rng = np.random.default_rng(42)
    # Generate clean synthetic carrier signal
    t = np.linspace(0, 2.0, 500)
    sig = np.sin(2 * np.pi * 10.0 * t).reshape(1, -1) + np.sin(2 * np.pi * 20.0 * t).reshape(1, -1)
    sig = np.repeat(sig, 22, axis=0) * 20.0  # 22 channels, 20 uV
    sig_power = float(np.mean(sig ** 2))

    for target_snr in [20.0, 10.0, 5.0, 0.0, -5.0]:
        # 1. Test add_white_noise
        noisy_white = add_white_noise(sig, snr_db=target_snr, rng=rng)
        noise_part_w = noisy_white - sig
        measured_snr_w = 10.0 * np.log10(sig_power / float(np.mean(noise_part_w ** 2)))
        assert abs(measured_snr_w - target_snr) <= 1.0, (
            f"add_white_noise SNR mismatch: target {target_snr} dB, got {measured_snr_w:.2f} dB"
        )

        # 2. Test composite corrupt
        noisy_comp = corrupt(sig, sfreq=250.0, snr_db=target_snr, rng=rng)
        noise_part_c = noisy_comp - sig
        measured_snr_c = 10.0 * np.log10(sig_power / float(np.mean(noise_part_c ** 2)))
        assert abs(measured_snr_c - target_snr) <= 1.0, (
            f"corrupt SNR mismatch: target {target_snr} dB, got {measured_snr_c:.2f} dB"
        )


def test_server_message_contract_schema():
    """Verify server messages strictly conform to the schemas specified in CONTRACTS.md."""
    # 1. Hello message schema
    hello_msg = {
        "type": "hello",
        "channels": list(CHANNELS),
        "sfreq": 250,
        "classes": ["left", "right"],
        "window_s": 2.0,
        "hop_ms": 100,
        "subjects": [1, 2, 3, 4, 5, 6, 7, 8, 9],
        "models": ["csp_lda", "shallow_fbcsp", "eegnet"],
    }
    assert hello_msg["type"] == "hello"
    assert len(hello_msg["channels"]) == 22
    assert hello_msg["sfreq"] == 250
    assert hello_msg["classes"] == ["left", "right"]
    assert isinstance(hello_msg["subjects"], list)
    assert isinstance(hello_msg["models"], list)

    # 2. Frame message schema
    frame_msg = {
        "type": "frame",
        "t": 12.4,
        "trial": 4,
        "trial_id": "sub01_sess1_trial004_left",
        "truth": "left",
        "eeg": [[0.0] * 22],
        "bandpower": {
            "mu": [1.42] * 22,
            "beta": [0.65] * 22,
        },
        "pred": {
            "left": 0.84,
            "right": 0.16,
            "label": "left",
            "confidence": 0.84,
            "latency_ms": 14.2,
        },
        "noise_snr_db": None,
    }
    assert frame_msg["type"] == "frame"
    assert isinstance(frame_msg["t"], (int, float))
    assert isinstance(frame_msg["trial"], int)
    assert isinstance(frame_msg["trial_id"], str)
    assert frame_msg["truth"] in ["left", "right"]
    assert "mu" in frame_msg["bandpower"] and "beta" in frame_msg["bandpower"]
    pred = frame_msg["pred"]
    assert set(pred.keys()) == {"left", "right", "label", "confidence", "latency_ms"}
    assert pred["label"] in ["left", "right"]
    assert 0.0 <= pred["confidence"] <= 1.0

    # 3. Status message schema
    status_msg = {
        "type": "status",
        "state": "idle",
        "subject": 1,
        "model": "csp_lda",
        "mode": "open",
    }
    assert status_msg["type"] == "status"
    assert status_msg["state"] in ["idle", "streaming", "paused"]
    assert status_msg["subject"] in range(1, 10)
    assert status_msg["model"] in ["csp_lda", "shallow_fbcsp", "eegnet"]
    assert status_msg["mode"] in ["open", "scripted"]

    # 4. Error message schema
    error_msg = {
        "type": "error",
        "message": "Invalid subject specified",
    }
    assert error_msg["type"] == "error"
    assert isinstance(error_msg["message"], str)
