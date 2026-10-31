import numpy as np
from scipy import signal

# Precompute 4th-order Butterworth bandpass (8-30 Hz at 250 Hz) in Second-Order Sections (SOS)
# SOS representation is numerically robust against high-order filter instability
DEFAULT_SFREQ = 250.0
_BP_LOW = 8.0
_BP_HIGH = 30.0
_SOS_250 = signal.butter(4, [_BP_LOW, _BP_HIGH], btype="bandpass", fs=DEFAULT_SFREQ, output="sos")

# Dedicated filters for fast spectral bandpower estimation (Mu 8-12 Hz, Beta 16-24 Hz)
_MU_SOS_250 = signal.butter(4, [8.0, 12.0], btype="bandpass", fs=DEFAULT_SFREQ, output="sos")
_BETA_SOS_250 = signal.butter(4, [16.0, 24.0], btype="bandpass", fs=DEFAULT_SFREQ, output="sos")


def prepare_window(x: np.ndarray, sfreq: int = 250) -> np.ndarray:
    """Canonical preprocessing function for a single EEG window (channels x samples).

    GUARANTEE: This is the exact single code path called during offline model training,
    held-out evaluation, and online real-time stream decoding to eliminate training/serving skew.

    Steps:
    1. 4th-order Butterworth bandpass 8-30 Hz applied with scipy.signal.sosfiltfilt
       (zero-phase forward-backward filtering along time axis).
    2. Per-channel demean: subtract each channel's temporal mean.
    3. Window standardization: divide by the scalar standard deviation of the window.

    Parameters
    ----------
    x : np.ndarray
        Raw EEG array of shape (n_channels, n_samples) in microvolts.
    sfreq : int, default 250
        Sampling frequency in Hz.

    Returns
    -------
    np.ndarray
        Preprocessed float32 array of shape (n_channels, n_samples).
    """
    out = np.asarray(x, dtype=np.float64)

    # 1. 4th-order Butterworth bandpass 8-30 Hz
    if sfreq == 250:
        sos = _SOS_250
    else:
        sos = signal.butter(4, [_BP_LOW, _BP_HIGH], btype="bandpass", fs=float(sfreq), output="sos")

    # sosfiltfilt requires padlen < n_samples. If window is short, use sosfilt
    if out.shape[-1] > 24:
        filtered = signal.sosfiltfilt(sos, out, axis=-1)
    else:
        filtered = signal.sosfilt(sos, out, axis=-1)

    # 2. Per-channel demean
    channel_mean = np.mean(filtered, axis=-1, keepdims=True)
    demeaned = filtered - channel_mean

    # 3. Divide by the window's standard deviation
    win_std = float(np.std(demeaned))
    if win_std > 1e-8:
        demeaned = demeaned / win_std

    return demeaned.astype(np.float32)


def prepare_batch(X: np.ndarray, sfreq: int = 250) -> np.ndarray:
    """Batch version of prepare_window for (n_trials, channels, samples).

    Parameters
    ----------
    X : np.ndarray
        Raw epochs of shape (n_trials, n_channels, n_samples).
    sfreq : int, default 250
        Sampling frequency in Hz.

    Returns
    -------
    np.ndarray
        Preprocessed float32 array of shape (n_trials, n_channels, n_samples).
    """
    n_trials = X.shape[0]
    out = np.zeros_like(X, dtype=np.float32)
    for i in range(n_trials):
        out[i] = prepare_window(X[i], sfreq=sfreq)
    return out


# Aliases for backward compatibility
preprocess_window = prepare_window
preprocess_batch = prepare_batch


def compute_bandpower(
    eeg_window: np.ndarray,
    sfreq: float = DEFAULT_SFREQ,
) -> dict[str, list[float]]:
    """Calculates Mu (8-12 Hz) and Beta (16-24 Hz) power per channel for the HUD visualizer.

    Parameters
    ----------
    eeg_window : np.ndarray
        Raw or preprocessed EEG window of shape (n_channels, n_samples).
    sfreq : float
        Sampling frequency in Hz.

    Returns
    -------
    dict
        {"mu": [power_ch0, ...], "beta": [power_ch0, ...]}
    """
    n_channels, n_samples = eeg_window.shape
    if n_samples < 16:
        return {"mu": [0.0] * n_channels, "beta": [0.0] * n_channels}

    # Demean channels
    window = eeg_window - np.mean(eeg_window, axis=-1, keepdims=True)

    if sfreq == DEFAULT_SFREQ:
        mu_sos = _MU_SOS_250
        beta_sos = _BETA_SOS_250
    else:
        mu_sos = signal.butter(4, [8.0, 12.0], btype="bandpass", fs=sfreq, output="sos")
        beta_sos = signal.butter(4, [16.0, 24.0], btype="bandpass", fs=sfreq, output="sos")

    mu_filtered = signal.sosfilt(mu_sos, window, axis=-1)
    beta_filtered = signal.sosfilt(beta_sos, window, axis=-1)

    # Average squared magnitude (power) across samples per channel
    mu_power = np.mean(mu_filtered ** 2, axis=-1).tolist()
    beta_power = np.mean(beta_filtered ** 2, axis=-1).tolist()

    return {
        "mu": [round(float(p), 4) for p in mu_power],
        "beta": [round(float(p), 4) for p in beta_power],
    }
