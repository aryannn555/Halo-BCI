from typing import List, Optional
import numpy as np

# Channel names ordered as in BNCI2014_001
_CHANNEL_WEIGHTS = {
    "Fz": 1.00,
    "FCz": 0.85,
    "FC1": 0.75,
    "FC2": 0.75,
    "FC3": 0.65,
    "FC4": 0.65,
    "Cz": 0.35,
    "C1": 0.30,
    "C2": 0.30,
    "C3": 0.25,
    "C4": 0.25,
    "C5": 0.20,
    "C6": 0.20,
    "CPz": 0.15,
    "CP1": 0.12,
    "CP2": 0.12,
    "CP3": 0.10,
    "CP4": 0.10,
    "Pz": 0.05,
    "P1": 0.04,
    "P2": 0.04,
    "Oz": 0.02,
}


def add_white_noise(
    x: np.ndarray,
    snr_db: float,
    rng: Optional[np.random.Generator] = None,
) -> np.ndarray:
    """Adds zero-mean Gaussian white noise calibrated to the target SNR (dB).

    Parameters
    ----------
    x : np.ndarray
        Array of shape (channels, samples).
    snr_db : float
        Target signal-to-noise ratio in decibels.
    rng : np.random.Generator, optional
        Random number generator for reproducibility.

    Returns
    -------
    np.ndarray
        Noisy EEG array.
    """
    if np.isinf(snr_db):
        return x.copy()

    if rng is None:
        rng = np.random.default_rng()

    sig_power = float(np.mean(x ** 2))
    if sig_power <= 1e-12:
        sig_power = 1.0

    target_noise_power = sig_power / (10.0 ** (snr_db / 10.0))
    noise = rng.standard_normal(size=x.shape)
    actual_power = float(np.mean(noise ** 2))
    if actual_power > 1e-12:
        noise = noise * np.sqrt(target_noise_power / actual_power)

    return x + noise


def add_mains(
    x: np.ndarray,
    sfreq: float = 250.0,
    amplitude_uv: float = 5.0,
    freq: float = 50.0,
    rng: Optional[np.random.Generator] = None,
) -> np.ndarray:
    """Adds 50 Hz powerline mains interference sine waves with independent phase per channel.

    Parameters
    ----------
    x : np.ndarray
        Array of shape (channels, samples).
    sfreq : float
        Sampling frequency in Hz.
    amplitude_uv : float
        Peak amplitude of the mains hum in microvolts.
    freq : float
        Mains hum frequency in Hz (default 50.0 Hz).
    rng : np.random.Generator, optional
        Random number generator.

    Returns
    -------
    np.ndarray
        Array with mains interference added.
    """
    if rng is None:
        rng = np.random.default_rng()

    n_channels, n_samples = x.shape
    t = np.arange(n_samples) / float(sfreq)
    phases = rng.uniform(0, 2 * np.pi, size=(n_channels, 1))
    mains = amplitude_uv * np.sin(2 * np.pi * freq * t + phases)
    return x + mains


def add_blink_artifacts(
    x: np.ndarray,
    sfreq: float = 250.0,
    rate_per_min: float = 12.0,
    amplitude_uv: float = 50.0,
    channel_names: Optional[List[str]] = None,
    rng: Optional[np.random.Generator] = None,
) -> np.ndarray:
    """Adds slow, large frontal-dominant ocular blink bumps (monophasic Gaussian deflections).

    Parameters
    ----------
    x : np.ndarray
        Array of shape (channels, samples).
    sfreq : float
        Sampling frequency in Hz.
    rate_per_min : float
        Expected average blink rate per minute (default: 12 blinks/min).
    amplitude_uv : float
        Peak frontal amplitude of each blink in microvolts (default: 50 uV).
    channel_names : List[str], optional
        Channel names to apply realistic spatial decay. If None, default frontal decay is used.
    rng : np.random.Generator, optional
        Random number generator.

    Returns
    -------
    np.ndarray
        Array with ocular blink artifacts.
    """
    if rng is None:
        rng = np.random.default_rng()

    n_channels, n_samples = x.shape
    duration_s = n_samples / float(sfreq)

    # Compute spatial attenuation vector across channels
    if channel_names is not None and len(channel_names) == n_channels:
        spatial_weights = np.array(
            [_CHANNEL_WEIGHTS.get(ch, 0.2) for ch in channel_names], dtype=np.float64
        ).reshape(-1, 1)
    else:
        # Default exponential decay from channel 0 (frontal) to last channel (occipital)
        spatial_weights = np.exp(-np.linspace(0, 3.5, n_channels)).reshape(-1, 1)

    # Expected number of blinks in this segment
    expected_blinks = (rate_per_min / 60.0) * duration_s
    n_blinks = rng.poisson(lam=max(0.05, expected_blinks))

    if n_blinks == 0:
        return x.copy()

    blink_signal = np.zeros((1, n_samples), dtype=np.float64)
    t = np.arange(n_samples) / float(sfreq)

    for _ in range(n_blinks):
        # Center of blink in seconds
        t_center = rng.uniform(0.1, max(0.15, duration_s - 0.1))
        # Blink width ~200-350 ms (sigma ~0.06 s)
        sigma = rng.uniform(0.045, 0.08)
        blink_bump = amplitude_uv * np.exp(-0.5 * ((t - t_center) / sigma) ** 2)
        blink_signal += blink_bump

    artifacts = spatial_weights * blink_signal
    return x + artifacts


def corrupt(
    x: np.ndarray,
    sfreq: float = 250.0,
    snr_db: Optional[float] = None,
    rng: Optional[np.random.Generator] = None,
) -> np.ndarray:
    """Combines white noise, 50 Hz mains hum, and frontal blink artifacts into a composite
    realistic corrupted signal achieving the exact target SNR (dB).

    Documented composite formulation:
    - 60% Gaussian broadband thermal/sensor noise
    - 25% 50 Hz powerline interference sine wave with random channel phases
    - 15% Frontal-dominant ocular blink artifacts (~50 uV peak)
    The composite artifact is scaled to match target SNR (dB) relative to input power.

    Noise is injected BEFORE prepare_window, exactly as it occurs in physical recordings.

    Parameters
    ----------
    x : np.ndarray
        Array of shape (channels, samples).
    sfreq : float
        Sampling frequency in Hz.
    snr_db : float, optional
        Target SNR in decibels. If None or inf, returns clean x.
    rng : np.random.Generator, optional
        Random number generator.

    Returns
    -------
    np.ndarray
        Corrupted EEG array.
    """
    if snr_db is None or np.isinf(snr_db):
        return x.copy()

    if rng is None:
        rng = np.random.default_rng()

    n_channels, n_samples = x.shape
    if n_samples == 0:
        return x.copy()

    sig_power = float(np.mean(x ** 2))
    if sig_power <= 1e-12:
        sig_power = 1.0

    target_noise_power = sig_power / (10.0 ** (snr_db / 10.0))

    # 1. Broad-band Gaussian background noise
    white = rng.standard_normal(size=(n_channels, n_samples))
    w_power = float(np.mean(white ** 2))
    if w_power > 1e-12:
        white /= np.sqrt(w_power)

    # 2. 50 Hz mains hum
    t = np.arange(n_samples) / float(sfreq)
    phases = rng.uniform(0, 2 * np.pi, size=(n_channels, 1))
    mains = np.sin(2 * np.pi * 50.0 * t + phases)
    m_power = float(np.mean(mains ** 2))
    if m_power > 1e-12:
        mains /= np.sqrt(m_power)

    # 3. Frontal blink artifacts
    spatial_weights = np.exp(-np.linspace(0, 3.0, n_channels)).reshape(-1, 1)
    duration_s = n_samples / float(sfreq)
    blink = np.zeros((1, n_samples), dtype=np.float64)
    # Add at least one smooth bump for blink component
    t_center = rng.uniform(0.1, max(0.15, duration_s - 0.1))
    sigma = 0.06
    blink += np.exp(-0.5 * ((t - t_center) / sigma) ** 2)
    ocular = spatial_weights * blink
    o_power = float(np.mean(ocular ** 2))
    if o_power > 1e-12:
        ocular /= np.sqrt(o_power)

    # 4. Composite noise blend
    composite = 0.60 * white + 0.25 * mains + 0.15 * ocular
    c_power = float(np.mean(composite ** 2))
    if c_power > 1e-12:
        composite *= np.sqrt(target_noise_power / c_power)

    return (x + composite).astype(np.float32)


# Backwards compatibility alias
inject_noise = corrupt
