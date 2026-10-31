import argparse
import json
import logging
import random
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import joblib
import numpy as np
import torch
import torch.nn as nn
from braindecode.models import EEGNet
from mne.decoding import CSP
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.metrics import accuracy_score
from sklearn.pipeline import Pipeline
from torch.utils.data import DataLoader, TensorDataset

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import CACHE_DIR, CHANNELS, MODELS_DIR, SFREQ, WINDOW_S
from ml.data import crop_windows, load_subject
from ml.preprocess import prepare_batch

logger = logging.getLogger("halo.train")


def seed_everything(seed: int = 42) -> None:
    """Sets random seeds across numpy, random, and torch for strict reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        torch.mps.manual_seed(seed)


def train_csp_lda(
    X_train: np.ndarray,
    y_train: np.ndarray,
    n_components: int = 6,
) -> Pipeline:
    """Fits a CSP (Common Spatial Patterns) + Linear Discriminant Analysis pipeline.

    Parameters
    ----------
    X_train : np.ndarray
        Preprocessed training windows of shape (n_windows, n_channels, n_samples).
    y_train : np.ndarray
        Labels of shape (n_windows,).
    n_components : int
        Number of spatial filter components to retain (default 6).

    Returns
    -------
    Pipeline
        Fitted scikit-learn Pipeline.
    """
    pipe = Pipeline([
        (
            "csp",
            CSP(
                n_components=n_components,
                reg="ledoit_wolf",
                log=True,
                norm_trace=False,
            ),
        ),
        ("lda", LinearDiscriminantAnalysis()),
    ])
    pipe.fit(X_train, y_train)
    return pipe


def train_eegnet(
    X_train: np.ndarray,
    y_train: np.ndarray,
    tr_train: np.ndarray,
    max_epochs: int = 80,
    batch_size: int = 32,
    lr: float = 1e-3,
    patience: int = 12,
    device: Optional[str] = None,
) -> Tuple[nn.Module, Dict[str, Any]]:
    """Trains a braindecode EEGNet with trial-grouped validation split and early stopping.

    Parameters
    ----------
    X_train : np.ndarray
        Preprocessed training windows of shape (n_windows, n_channels, n_samples).
    y_train : np.ndarray
        Window labels of shape (n_windows,).
    tr_train : np.ndarray
        Trial ID per window to ensure zero cross-trial validation leakage.
    max_epochs : int, default 80
        Maximum training epochs.
    batch_size : int, default 32
        Mini-batch size.
    lr : float, default 1e-3
        Adam optimizer learning rate.
    patience : int, default 12
        Early stopping epoch patience.
    device : str, optional
        Computation device (defaults to mps if available, else cpu).

    Returns
    -------
    Tuple[nn.Module, Dict[str, Any]]
        (trained_model, training_info_dict)
    """
    if device is None:
        device = "mps" if torch.backends.mps.is_available() else "cpu"

    seed_everything(42)
    n_chans = X_train.shape[1]
    n_times = X_train.shape[2]

    # Split 80% train / 20% val by trial to prevent leakage between sliding windows
    unique_trials = np.unique(tr_train)
    n_trials = len(unique_trials)
    n_val_trials = max(1, int(0.20 * n_trials))
    val_trial_set = set(unique_trials[-n_val_trials:])

    val_mask = np.isin(tr_train, list(val_trial_set))
    X_tr, y_tr = X_train[~val_mask], y_train[~val_mask]
    X_va, y_va = X_train[val_mask], y_train[val_mask]

    model = EEGNet(
        n_chans=n_chans,
        n_outputs=2,
        n_times=n_times,
        sfreq=float(SFREQ),
        drop_prob=0.25,
    ).to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss()

    train_loader = DataLoader(
        TensorDataset(
            torch.from_numpy(X_tr).to(dtype=torch.float32),
            torch.from_numpy(y_tr).to(dtype=torch.long),
        ),
        batch_size=batch_size,
        shuffle=True,
    )
    val_loader = DataLoader(
        TensorDataset(
            torch.from_numpy(X_va).to(dtype=torch.float32),
            torch.from_numpy(y_va).to(dtype=torch.long),
        ),
        batch_size=batch_size,
        shuffle=False,
    )

    best_val_loss = float("inf")
    best_weights: Optional[Dict[str, torch.Tensor]] = None
    patience_counter = 0
    stopped_epoch = max_epochs

    for epoch in range(1, max_epochs + 1):
        model.train()
        for bx, by in train_loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            out = model(bx)
            loss = criterion(out, by)
            loss.backward()
            optimizer.step()

        # Validation evaluation
        model.eval()
        val_loss = 0.0
        val_correct = 0
        with torch.no_grad():
            for bx, by in val_loader:
                bx, by = bx.to(device), by.to(device)
                logits = model(bx)
                val_loss += criterion(logits, by).item() * len(by)
                val_correct += (logits.argmax(dim=-1) == by).sum().item()

        val_loss /= len(X_va)
        val_acc = val_correct / len(X_va)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= patience:
                stopped_epoch = epoch
                break

    if best_weights is not None:
        model.load_state_dict({k: v.to(device) for k, v in best_weights.items()})

    model.eval()
    info = {
        "best_val_loss": round(float(best_val_loss), 4),
        "stopped_epoch": stopped_epoch,
        "device": device,
    }
    return model, info


def compute_trial_accuracy(
    window_probs: np.ndarray,
    trial_indices: np.ndarray,
    y_epochs: np.ndarray,
) -> float:
    """Computes trial-level accuracy by averaging window probabilities per trial and taking argmax."""
    n_trials = len(y_epochs)
    y_pred_trial = []

    for i in range(n_trials):
        mask = trial_indices == i
        if np.any(mask):
            mean_probs = np.mean(window_probs[mask], axis=0)
            pred = int(np.argmax(mean_probs))
        else:
            pred = 0
        y_pred_trial.append(pred)

    return float(accuracy_score(y_epochs, y_pred_trial))


def train_and_save_all_for_subject(
    subject: int,
    models: Optional[List[str]] = None,
) -> Dict[str, Dict[str, Any]]:
    """Trains requested models for a single subject on 0train, evaluates on 1test, and saves artifacts."""
    seed_everything(42)
    if models is None:
        models = ["csp_lda", "eegnet"]

    logger.info("Loading Subject %d...", subject)
    X_all, y_all, channels, meta = load_subject(subject)

    train_mask = meta["session"] == "0train"
    test_mask = meta["session"] == "1test"

    X_train_raw, y_train_epochs = X_all[train_mask], y_all[train_mask]
    X_test_raw, y_test_epochs = X_all[test_mask], y_all[test_mask]

    # Crop into sliding 2.0s windows with 0.25s stride
    X_train_win, y_train_win, tr_train, _ = crop_windows(X_train_raw, y_train_epochs)
    X_test_win, y_test_win, tr_test, _ = crop_windows(X_test_raw, y_test_epochs)

    # Preprocess with single canonical prepare_batch path
    X_train_prep = prepare_batch(X_train_win, sfreq=SFREQ)
    X_test_prep = prepare_batch(X_test_win, sfreq=SFREQ)

    results: Dict[str, Dict[str, Any]] = {}

    # 1. CSP + LDA
    if "csp_lda" in models:
        logger.info("[Subject %d] Training CSP + LDA...", subject)
        csp_pipe = train_csp_lda(X_train_prep, y_train_win)

        # Test evaluation
        csp_pred_win = csp_pipe.predict(X_test_prep)
        csp_win_acc = float(accuracy_score(y_test_win, csp_pred_win))
        csp_test_probs = csp_pipe.predict_proba(X_test_prep)
        csp_trial_acc = compute_trial_accuracy(csp_test_probs, tr_test, y_test_epochs)

        # Quality Gate Check
        if csp_win_acc < 0.60:
            logger.warning(
                "QUALITY GATE WARNING: Subject %d CSP+LDA window accuracy (%.2f%%) is below 60%%.",
                subject,
                csp_win_acc * 100,
            )

        # Shuffled label sanity check
        rng = np.random.default_rng(42)
        y_shuff = rng.permutation(y_train_win)
        csp_shuff_pipe = train_csp_lda(X_train_prep, y_shuff)
        shuff_acc = float(accuracy_score(y_test_win, csp_shuff_pipe.predict(X_test_prep)))

        # Save model and metadata
        joblib_path = MODELS_DIR / f"subject_{subject}_csp_lda.joblib"
        joblib.dump(csp_pipe, joblib_path)

        meta_info = {
            "subject": subject,
            "model": "csp_lda",
            "window_acc": round(csp_win_acc, 4),
            "trial_acc": round(csp_trial_acc, 4),
            "shuffled_sanity_acc": round(shuff_acc, 4),
            "n_train_windows": len(X_train_prep),
            "n_test_windows": len(X_test_prep),
            "sfreq": SFREQ,
            "window_s": WINDOW_S,
        }
        with open(MODELS_DIR / f"subject_{subject}_csp_lda.json", "w", encoding="utf-8") as f:
            json.dump(meta_info, f, indent=2)

        # Primary default alias
        if subject == 1:
            joblib.dump(csp_pipe, MODELS_DIR / "csp_lda.joblib")
            with open(MODELS_DIR / "csp_lda.json", "w", encoding="utf-8") as f:
                json.dump(meta_info, f, indent=2)

        results["csp_lda"] = meta_info

    # 2. EEGNet
    if "eegnet" in models:
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        logger.info("[Subject %d] Training EEGNet on %s...", subject, device)
        eegnet_model, train_info = train_eegnet(
            X_train_prep,
            y_train_win,
            tr_train,
            device=device,
        )

        with torch.no_grad():
            test_tensor = torch.from_numpy(X_test_prep).to(device, dtype=torch.float32)
            test_logits = eegnet_model(test_tensor)
            eegnet_probs = torch.softmax(test_logits, dim=-1).cpu().numpy()

        eegnet_pred_win = eegnet_probs.argmax(axis=-1)
        eegnet_win_acc = float(accuracy_score(y_test_win, eegnet_pred_win))
        eegnet_trial_acc = compute_trial_accuracy(eegnet_probs, tr_test, y_test_epochs)

        pt_path = MODELS_DIR / f"subject_{subject}_eegnet.pt"
        torch.save(eegnet_model.state_dict(), pt_path)

        meta_info = {
            "subject": subject,
            "model": "eegnet",
            "window_acc": round(eegnet_win_acc, 4),
            "trial_acc": round(eegnet_trial_acc, 4),
            "stopped_epoch": train_info["stopped_epoch"],
            "best_val_loss": train_info["best_val_loss"],
            "device": device,
            "n_train_windows": len(X_train_prep),
            "n_test_windows": len(X_test_prep),
            "sfreq": SFREQ,
            "window_s": WINDOW_S,
        }
        with open(MODELS_DIR / f"subject_{subject}_eegnet.json", "w", encoding="utf-8") as f:
            json.dump(meta_info, f, indent=2)

        if subject == 1:
            torch.save(eegnet_model.state_dict(), MODELS_DIR / "eegnet.pt")
            with open(MODELS_DIR / "eegnet.json", "w", encoding="utf-8") as f:
                json.dump(meta_info, f, indent=2)

        results["eegnet"] = meta_info

    return results


def main():
    parser = argparse.ArgumentParser(description="Train EEG decoders across subjects.")
    parser.add_argument(
        "--models",
        nargs="+",
        default=["csp_lda", "eegnet"],
        choices=["csp_lda", "eegnet"],
        help="Models to train.",
    )
    parser.add_argument(
        "--subjects",
        nargs="+",
        type=int,
        default=[1, 2, 3, 4, 5, 6, 7, 8, 9],
        help="Subject IDs to train (1..9).",
    )

    args = parser.parse_args()

    print("\n" + "=" * 78)
    print(f"🚀 HALO BCI TRAINING PIPELINE")
    print(f"   Models: {args.models} | Subjects: {args.subjects}")
    print(f"   Device: {'mps' if torch.backends.mps.is_available() else 'cpu'}")
    print("=" * 78 + "\n")

    all_results = []

    for subj in args.subjects:
        t0 = time.time()
        res = train_and_save_all_for_subject(subj, models=args.models)
        elapsed = time.time() - t0

        for m_name, metrics in res.items():
            all_results.append({
                "subject": subj,
                "model": m_name,
                "win_acc": metrics["window_acc"] * 100,
                "trial_acc": metrics["trial_acc"] * 100,
                "shuff_acc": metrics.get("shuffled_sanity_acc", None),
                "elapsed_s": round(elapsed, 1),
            })

    # Print summary table
    print("\n" + "=" * 78)
    print("📊 TRAINING SUMMARY TABLE")
    print("=" * 78)
    print(f"{'Subject':<10}{'Model':<12}{'Window Acc':<15}{'Trial Acc':<15}{'Sanity (Shuff)':<16}{'Time (s)':<10}")
    print("-" * 78)
    for r in all_results:
        shuff_str = f"{r['shuff_acc'] * 100:.2f}%" if r['shuff_acc'] is not None else "-"
        print(f"{r['subject']:<10}{r['model']:<12}{r['win_acc']:>10.2f}%    {r['trial_acc']:>10.2f}%    {shuff_str:>12}    {r['elapsed_s']:>7.1f}s")
    print("=" * 78 + "\n")


if __name__ == "__main__":
    main()
