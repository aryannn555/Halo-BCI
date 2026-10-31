#!/usr/bin/env python3
"""
Exports 120 seconds of real replay frames for Subject 3 (default model csp_lda)
with a scripted mix of left and right trials to frontend/public/demo-session.json.

Includes exact decoder outputs, bandpowers, and EEG hop microvolts for offline fallback replay.
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import BASE_DIR, CHANNELS, SFREQ
from app.replay import ReplaySession

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("export_session")


async def main():
    collected_frames: List[Dict[str, Any]] = []
    target_frames = 1200  # 120 seconds at 100 ms hops (10 fps)

    async def broadcast(frame: Dict[str, Any]):
        nonlocal collected_frames
        if len(collected_frames) < target_frames:
            # Deep clone / sanitize frame
            sanitized = {
                "type": frame.get("type", "frame"),
                "t": round(float(frame.get("t", 0.0)), 2),
                "trial": int(frame.get("trial", 0)),
                "trial_id": str(frame.get("trial_id", "")),
                "truth": frame.get("truth"),
                "eeg": [[round(float(v), 2) for v in ch] for ch in frame.get("eeg", [])],
                "bandpower": {
                    "mu": [round(float(v), 4) for v in frame.get("bandpower", {}).get("mu", [])],
                    "beta": [round(float(v), 4) for v in frame.get("bandpower", {}).get("beta", [])],
                },
                "pred": {
                    "left": round(float(frame.get("pred", {}).get("left", 0.5)), 4),
                    "right": round(float(frame.get("pred", {}).get("right", 0.5)), 4),
                    "label": frame.get("pred", {}).get("label", "left"),
                    "confidence": round(float(frame.get("pred", {}).get("confidence", 0.5)), 4),
                    "latency_ms": round(float(frame.get("pred", {}).get("latency_ms", 0.4)), 2),
                },
                "noise_snr_db": frame.get("noise_snr_db"),
            }
            collected_frames.append(sanitized)
            if len(collected_frames) % 100 == 0:
                logger.info("Captured %d / %d frames...", len(collected_frames), target_frames)

    session = ReplaySession(
        broadcast_fn=broadcast,
        subject=3,
        model_name="csp_lda",
        speed=50.0,  # 50x speed for fast offline capture
    )

    logger.info("Subject 3 data initialized with %d trials.", len(session.X_test))
    logger.info("Starting session replay to capture 120s (1200 frames)...")
    await session.start()

    # Wait until 1200 frames collected or finished
    while len(collected_frames) < target_frames and session.state == "running":
        await asyncio.sleep(0.02)

    await session.pause()
    logger.info("Session finished. Total captured: %d frames.", len(collected_frames))

    # Construct complete session payload
    payload = {
        "metadata": {
            "subject": 3,
            "model": "csp_lda",
            "duration_s": round(len(collected_frames) * 0.1, 1),
            "fps": 10,
            "sfreq": SFREQ,
            "channels": list(CHANNELS),
            "total_frames": len(collected_frames),
        },
        "hello": {
            "type": "hello",
            "channels": list(CHANNELS),
            "sfreq": SFREQ,
            "classes": ["left_hand", "right_hand"],
            "window_s": 2.0,
            "hop_ms": 100,
            "subjects": [1, 2, 3, 4, 5, 6, 7, 8, 9],
            "models": ["csp_lda", "eegnet"],
        },
        "frames": collected_frames,
    }

    # Write to frontend/public/demo-session.json
    output_path = BASE_DIR.parent / "frontend" / "public" / "demo-session.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f)

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info("Successfully exported demo session to %s (%.2f MB).", output_path, file_size_mb)


if __name__ == "__main__":
    asyncio.run(main())
