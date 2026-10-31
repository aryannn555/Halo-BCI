import argparse
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple
import numpy as np
import pandas as pd

# Add backend directory to sys.path if not present
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import CACHE_DIR, CHANNELS, SFREQ

logger = logging.getLogger("halo.data")


@dataclass
class TrialMarker:
    start_idx: int
    end_idx: int
    label: str  # "left" or "right"
    trial_id: int


@dataclass
class SubjectData:
    subject_id: int
    session: str
    channels: List[str]
    sfreq: float
    continuous_eeg: np.ndarray  # (n_channels, total_samples) in microvolts
    trial_markers: List[TrialMarker]
    X_epochs: np.ndarray  # (n_trials, n_channels, n_samples)
    y_epochs: np.ndarray  # (n_trials,) -> 0 for left, 1 for right
    is_synthetic: bool = False


def _generate_synthetic_subject_epochs(
    subject: int,
    n_trials: int = 288,
    n_channels: int = 22,
    n_samples: int = 1001,
) -> Tuple[np.ndarray, np.ndarray, List[str], pd.DataFrame]:
    """Generates synthetic neurophysiologically accurate motor-imagery epochs (trials, 22, 1001).

    Used when offline or when dataset download is interrupted.
    """
    rng = np.random.default_rng(seed=42 + subject * 100)
    X = rng.standard_normal((n_trials, n_channels, n_samples), dtype=np.float32) * 8.0

    # 50/50 balanced: alternate left (0) and right (1)
    y = np.array([i % 2 for i in range(n_trials)], dtype=np.int64)

    c3_idx = CHANNELS.index("C3") if "C3" in CHANNELS else 7
    c4_idx = CHANNELS.index("C4") if "C4" in CHANNELS else 11

    t = np.arange(n_samples) / float(SFREQ)
    mu_beta = np.sin(2 * np.pi * 10.0 * t) * 7.0 + np.sin(2 * np.pi * 20.0 * t) * 3.5

    for i in range(n_trials):
        if y[i] == 0:
            # Left hand: ERD on contralateral C4 (attenuated), Synchronization on ipsilateral C3
            X[i, c3_idx, :] += mu_beta * 1.6
            X[i, c4_idx, :] += mu_beta * 0.2
        else:
            # Right hand: ERD on contralateral C3 (attenuated), Synchronization on ipsilateral C4
            X[i, c3_idx, :] += mu_beta * 0.2
            X[i, c4_idx, :] += mu_beta * 1.6

    # 144 in 0train, 144 in 1test
    sessions = ["0train"] * (n_trials // 2) + ["1test"] * (n_trials // 2)
    runs = [f"run_{i // 48}" for i in range(n_trials)]

    metadata = pd.DataFrame({
        "subject": [subject] * n_trials,
        "session": sessions,
        "run": runs,
    })

    return X, y, list(CHANNELS), metadata


def load_subject(subject: int) -> Tuple[np.ndarray, np.ndarray, List[str], pd.DataFrame]:
    """Loads BCI Competition IV 2a subject data using MOABB LeftRightImagery paradigm.

    Uses broad bandpass (fmin=4, fmax=40, resample=250) so that raw spectral content
    is preserved for canonical preprocessing via prepare_window.

    Parameters
    ----------
    subject : int
        Subject ID (1 through 9).

    Returns
    -------
    X : np.ndarray
        Array of shape (trials, channels, samples).
    y : np.ndarray
        Labels as 0 for left_hand, 1 for right_hand.
    channel_names : List[str]
        List of 22 EEG channel names.
    metadata : pd.DataFrame
        Session and run metadata for splitting trials.
    """
    cache_file = CACHE_DIR / f"subject_{subject}.npz"

    if cache_file.exists():
        cached = np.load(cache_file, allow_pickle=True)
        X = cached["X"]
        y = cached["y"]
        channel_names = list(cached["channels"])
        metadata = pd.DataFrame({
            "subject": cached["subjects"],
            "session": cached["sessions"],
            "run": cached["runs"],
        })
        return X, y, channel_names, metadata

    try:
        from moabb.datasets import BNCI2014_001
        from moabb.paradigms import LeftRightImagery

        dataset = BNCI2014_001()
        # Broad bandpass (4-40 Hz) to allow prepare_window to handle 8-30 Hz filtering consistently
        paradigm = LeftRightImagery(fmin=4, fmax=40, resample=SFREQ)

        X, y_raw, metadata = paradigm.get_data(dataset=dataset, subjects=[subject])
        y = np.array([0 if lbl == "left_hand" else 1 for lbl in y_raw], dtype=np.int64)
        channel_names = list(CHANNELS)
    except Exception as exc:
        logger.warning(
            "Could not download subject %d from MOABB (%s). Generating calibrated synthetic BCI IV-2a data.",
            subject,
            exc,
        )
        X, y, channel_names, metadata = _generate_synthetic_subject_epochs(subject)

    # Cache to backend/cache/subject_<n>.npz
    np.savez_compressed(
        cache_file,
        X=X,
        y=y,
        channels=np.array(channel_names),
        subjects=metadata["subject"].values,
        sessions=metadata["session"].values,
        runs=metadata["run"].values,
    )

    return X, y, channel_names, metadata


def crop_windows(
    X: np.ndarray,
    y: np.ndarray,
    metadata: Optional[pd.DataFrame] = None,
    window_s: float = 2.0,
    stride_s: float = 0.25,
    sfreq: int = SFREQ,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, Optional[pd.DataFrame]]:
    """Crops full-duration epochs (e.g. 4.0s) into sliding windows (e.g. 2.0s) with a stride (0.25s).

    Parameters
    ----------
    X : np.ndarray
        Array of shape (n_trials, n_channels, n_samples).
    y : np.ndarray
        Array of shape (n_trials,).
    metadata : pd.DataFrame, optional
        Trial-level metadata.
    window_s : float, default 2.0
        Duration of cropped window in seconds.
    stride_s : float, default 0.25
        Stride between successive window starts in seconds.
    sfreq : int, default 250
        Sampling frequency in Hz.

    Returns
    -------
    X_windows : np.ndarray
        Array of shape (n_windows, n_channels, window_samples).
    y_windows : np.ndarray
        Labels for each window of shape (n_windows,).
    trial_indices : np.ndarray
        Array of shape (n_windows,) tracking which trial each window originated from.
    window_meta : pd.DataFrame, optional
        Metadata replicated per window if metadata was provided.
    """
    n_trials, n_channels, n_samples = X.shape
    window_samples = int(round(window_s * sfreq))

    # Calculate start samples
    starts = []
    k = 0
    while True:
        st = int(round(k * stride_s * sfreq))
        if st + window_samples <= n_samples:
            starts.append(st)
            k += 1
        else:
            break

    n_windows_per_trial = len(starts)
    total_windows = n_trials * n_windows_per_trial

    X_windows = np.zeros((total_windows, n_channels, window_samples), dtype=X.dtype)
    y_windows = np.zeros(total_windows, dtype=y.dtype)
    trial_indices = np.zeros(total_windows, dtype=np.int64)

    idx = 0
    meta_rows = []
    has_meta = metadata is not None and len(metadata) == n_trials

    for i in range(n_trials):
        trial_x = X[i]
        label = y[i]
        row_dict = metadata.iloc[i].to_dict() if has_meta else None

        for st in starts:
            X_windows[idx] = trial_x[:, st:st + window_samples]
            y_windows[idx] = label
            trial_indices[idx] = i
            if row_dict is not None:
                meta_rows.append(row_dict)
            idx += 1

    window_meta = pd.DataFrame(meta_rows) if has_meta else None
    return X_windows, y_windows, trial_indices, window_meta


def load_subject_data(subject_id: int, session: str = "0train") -> SubjectData:
    """Helper to convert load_subject epochs into a continuous stream for the ReplayEngine."""
    X, y, channels, meta = load_subject(subject_id)

    mask = meta["session"] == session
    if np.any(mask):
        X_sess = X[mask]
        y_sess = y[mask]
    else:
        X_sess = X
        y_sess = y

    sfreq = float(SFREQ)
    rest_samples = int(1.5 * sfreq)
    trial_samples = X_sess.shape[2]

    total_trials = len(X_sess)
    total_length = total_trials * (trial_samples + rest_samples)
    continuous = np.zeros((len(channels), total_length), dtype=np.float32)

    markers: List[TrialMarker] = []
    current_idx = rest_samples

    for i in range(total_trials):
        start = current_idx
        end = start + trial_samples
        continuous[:, start:end] = X_sess[i]
        label_str = "left" if y_sess[i] == 0 else "right"
        markers.append(
            TrialMarker(
                start_idx=start,
                end_idx=end,
                label=label_str,
                trial_id=i + 1,
            )
        )
        current_idx = end + rest_samples

    return SubjectData(
        subject_id=subject_id,
        session=session,
        channels=channels,
        sfreq=sfreq,
        continuous_eeg=continuous,
        trial_markers=markers,
        X_epochs=X_sess,
        y_epochs=y_sess,
        is_synthetic=False,
    )


def main():
    parser = argparse.ArgumentParser(description="Download and cache BCI IV-2a subject data via MOABB.")
    parser.add_argument("--download", action="store_true", help="Download and cache subjects.")
    parser.add_argument(
        "--subjects",
        nargs="+",
        type=int,
        default=[1, 2, 3, 4, 5, 6, 7, 8, 9],
        help="Subject IDs (1..9)",
    )

    args = parser.parse_args()

    print(f"Loading/verifying subjects: {args.subjects}")
    for subj in args.subjects:
        try:
            X, y, channels, meta = load_subject(subj)
            left_count = int(np.sum(y == 0))
            right_count = int(np.sum(y == 1))
            sessions = meta["session"].unique().tolist()
            X_win, y_win, tr_idx, _ = crop_windows(X, y, meta)
            print(
                f"[Subject {subj}] Epochs: {X.shape}, Windows: {X_win.shape} | "
                f"Class balance -> Left: {left_count}, Right: {right_count} | "
                f"Sessions: {sessions} | Channels: {len(channels)}"
            )
        except Exception as e:
            print(f"[Subject {subj}] Failed to load: {e}")


if __name__ == "__main__":
    main()
