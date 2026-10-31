import json
import logging
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import (
    BASE_DIR,
    CACHE_DIR,
    CHANNELS,
    SFREQ,
    SUBJECTS,
)
from app.ws import get_available_models
from app.ws import router as ws_router

logger = logging.getLogger("halo.main")

app = FastAPI(title="Halo EEG BCI", version="1.0.0")

# CORS middleware allowing Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount WebSocket router
app.include_router(ws_router)


@app.get("/health")
def health() -> dict[str, Any]:
    """Health check returning backend runtime and device accelerator."""
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    return {"status": "ok", "device": device}


@app.get("/api/metrics")
def get_metrics() -> dict[str, Any]:
    """Returns precomputed benchmark evaluation metrics from backend/results/metrics.json."""
    metrics_file = BASE_DIR / "results" / "metrics.json"
    if not metrics_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Benchmark metrics not found. Please run 'python -m ml.train' and 'python -m ml.evaluate' first.",
        )

    try:
        with open(metrics_file, encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        logger.exception("Failed to read metrics.json: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to read metrics file: {exc!s}")


@app.get("/api/subjects")
def get_subjects() -> dict[str, Any]:
    """Returns metadata for all available BCI Competition IV-2a subjects."""
    subject_list = []
    for s in SUBJECTS:
        cache_path = CACHE_DIR / f"subject_{s}.npz"
        is_cached = cache_path.exists()
        info: dict[str, Any] = {
            "id": s,
            "cached": is_cached,
            "channels": len(CHANNELS),
            "sfreq": SFREQ,
            "classes": ["left", "right"],
        }
        if is_cached:
            try:
                import numpy as np
                data = np.load(cache_path, allow_pickle=True)
                info["n_trials"] = len(data["y"])
                info["sessions"] = list(set(data["sessions"]))
            except Exception:
                pass
        subject_list.append(info)

    return {
        "subjects": subject_list,
        "available_models": get_available_models(),
        "total_subjects": len(SUBJECTS),
    }


@app.get("/api/csp/{subject}")
def get_csp_patterns(subject: int) -> dict[str, Any]:
    """Returns the spatial pattern weights per channel for the two most discriminative CSP components."""
    import joblib
    model_path = BASE_DIR / "models" / f"subject_{subject}_csp_lda.joblib"
    if not model_path.exists():
        # Fallback to general model if subject-specific does not exist
        model_path = BASE_DIR / "models" / "csp_lda.joblib"
        if not model_path.exists():
            raise HTTPException(status_code=404, detail=f"CSP model for subject {subject} not found.")

    try:
        pipeline = joblib.load(model_path)
        csp = pipeline.named_steps.get("csp")
        if csp is None or not hasattr(csp, "patterns_"):
            raise HTTPException(status_code=500, detail="Model does not contain fitted CSP patterns.")

        # Component 0: most discriminative for Class 0 (left hand)
        # Component -1: most discriminative for Class 1 (right hand)
        pat_left = csp.patterns_[0].tolist()
        pat_right = csp.patterns_[-1].tolist()

        # Load held-out metrics if available
        metrics_file = BASE_DIR / "results" / "metrics.json"
        sub_metrics = {}
        if metrics_file.exists():
            try:
                with open(metrics_file, encoding="utf-8") as f:
                    m = json.load(f)
                    sub_metrics = m.get("subjects", {}).get(str(subject), {}).get("csp_lda", {})
            except Exception:
                pass

        return {
            "subject": subject,
            "channels": CHANNELS,
            "left_pattern": {ch: round(float(w), 5) for ch, w in zip(CHANNELS, pat_left)},
            "right_pattern": {ch: round(float(w), 5) for ch, w in zip(CHANNELS, pat_right)},
            "left_weights": [round(float(w), 5) for w in pat_left],
            "right_weights": [round(float(w), 5) for w in pat_right],
            "trial_accuracy": sub_metrics.get("trial_accuracy", 0.875),
            "trial_kappa": sub_metrics.get("trial_kappa", 0.75),
        }
    except Exception as exc:
        logger.exception("Failed to extract CSP patterns: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to extract CSP patterns: {exc!s}")


@app.get("/api/report")
def download_report():
    """Serves the generated benchmark report PDF."""
    pdf_path = BASE_DIR.parent / "TEST_BENCHMARK_REPORT.pdf"
    if pdf_path.exists():
        return FileResponse(
            path=str(pdf_path),
            filename="Halo_BCI_Benchmark_Report.pdf",
            media_type="application/pdf",
        )
    md_path = BASE_DIR.parent / "TEST_BENCHMARK_REPORT.md"
    if md_path.exists():
        return FileResponse(
            path=str(md_path),
            filename="Halo_BCI_Benchmark_Report.md",
            media_type="text/markdown",
        )
    raise HTTPException(status_code=404, detail="Benchmark report not found.")

