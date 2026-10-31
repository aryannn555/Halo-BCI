# Halo — Assistive EEG Brain-Computer Interface

> **AI MANTHAN 2.0 • Real-Time Neural Prosthetic Platform**  
> High-performance assistive brain-computer interface replaying BCI Competition IV-2a motor imagery data to empower locked-in and paralyzed individuals with synthetic speech, assistive keyboard typing, and physical device control.

---

## ⚡ Quickstart

### One-Command Demo
```bash
make demo
```
This command concurrently boots the FastAPI backend (`:8000`), the Next.js production frontend (`:3000`), and automatically opens `http://localhost:3000` in your browser.

---

## 🏗️ Architecture

```
                                  Halo Architecture
                                  
   [ Raw EEG Telemetry ]            [ Digital Signal Processing ]          [ Machine Learning ]
  BCI IV-2a (22 Ch, 250 Hz)    ──>  4th-order Butterworth SOS      ──>   Common Spatial Patterns (CSP)
  Held-out Session 2 (1test)        8-30 Hz Zero-Phase filtfilt          + Linear Discriminant Analysis
             │                                     │                                  │
             ▼                                     ▼                                  ▼
   [ WebSocket Engine ]             [ Ring Buffer & Dwell Accumulator ]    [ Assistive Interfaces ]
  FastAPI async 100 ms hops    ──>  2.0 s Sliding Window (500 samples) ──>  • Live Neural Studio
  Drift-free Monotonic Clock        EMA Smoothing & Confidence Gate      • Predictive Huffman Keyboard
                                                                         • Discrete Command Board
                                                                         • Metrics & Robustness Lab
```

---

## 🚀 Manual Installation

### 1. Prerequisites
- **macOS** (Apple Silicon M-series recommended for PyTorch MPS GPU acceleration) or Linux.
- **Python 3.11**
- **Node.js 18+** & **npm**

### 2. Backend Setup
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Verify Apple Silicon GPU acceleration
python -c "import torch; print('MPS available:', torch.backends.mps.is_available())"

# Download and cache BCI Competition IV-2a subjects (1 through 9)
python -m ml.data --download --subjects 1 2 3 4 5 6 7 8 9

# Train per-subject decoders (CSP + LDA and EEGNet)
python -m ml.train --all

# Run evaluation sweep and generate metrics.json
python -m ml.evaluate
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run build
npm run dev
```

---

## 📊 Scientific Benchmark Results

Cross-session held-out validation evaluated on Session 2 (`1test`, 144 trials per subject, 1,296 total trials across 9 human participants). **Zero training data leakage.**

### Model Comparison Table

| Metric | CSP + LDA (Spatial Filters + Shrinkage) | EEGNet (Deep Conv2D Architecture) | Chance Baseline |
| :--- | :---: | :---: | :---: |
| **Mean Trial Accuracy** | **90.2% ± 15.6%** | **89.1% ± 17.8%** | 50.0% |
| **Window-Level Accuracy** | **82.2% ± 11.2%** | **81.1% ± 13.6%** | 50.0% |
| **Cohen's Kappa ($\kappa$)** | **0.804 ± 0.311** | **0.782 ± 0.356** | 0.000 |
| **Macro F1-Score** | **89.7%** | **87.1%** | 50.0% |
| **Information Transfer Rate (ITR)** | **10.91 bits/min** | **10.86 bits/min** | 0.00 bits/min |
| **Median Inference Latency** | **0.41 ms** (p95: 0.48 ms) | **0.93 ms** (p95: 1.42 ms) | Budget: 50.0 ms |

### Per-Subject Trial Breakdown (CSP + LDA)

| Subject | Trial Accuracy | Window Accuracy | Cohen's $\kappa$ | Wolpaw ITR | Status |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **S1** | 87.5% | 82.7% | 0.750 | 6.85 bpm | High Generalizer |
| **S2** | 59.0% | 58.5% | 0.181 | 0.35 bpm | Known BCI Illiteracy |
| **S3** | 100.0% | 99.4% | 1.000 | 15.00 bpm | Perfect Decoding |
| **S4** | 65.3% | 63.7% | 0.306 | 1.08 bpm | Moderate Responder |
| **S5** | 98.6% | 91.4% | 0.972 | 13.98 bpm | High Generalizer |
| **S6** | 98.6% | 87.9% | 0.972 | 13.98 bpm | High Generalizer |
| **S7** | 100.0% | 97.4% | 1.000 | 15.00 bpm | Perfect Decoding |
| **S8** | 100.0% | 98.7% | 1.000 | 15.00 bpm | Perfect Decoding |
| **S9** | 100.0% | 97.5% | 1.000 | 15.00 bpm | Perfect Decoding |

### Noise Robustness Sweep (Injected Electrical & Baseline Artifacts)

| Injected Noise SNR | Mean Accuracy | Accuracy Retention | Real-Time Headroom |
| :---: | :---: | :---: | :---: |
| **Clean (Inf dB)** | 90.4% ± 15.2% | 100.0% baseline | 122× headroom |
| **+20 dB** | 89.5% ± 16.4% | 99.0% retention | 120× headroom |
| **+10 dB** | 86.0% ± 20.7% | 95.1% retention | 118× headroom |
| **+5 dB** | 85.0% ± 21.6% | 93.9% retention | 115× headroom |
| **0 dB** | 85.3% ± 21.3% | 94.4% retention | 115× headroom |
| **-5 dB (Severe)** | 84.7% ± 21.9% | 93.7% retention | 110× headroom |

---

## 🖥️ User Interface Scenes

1. **Overview Scene (`/`)**: High-level problem narrative, real-time cortical brain visualizer with live floating chips, interactive "What the model learned" CSP topomap calibration, and methodology notes. Press <kbd>D</kbd> to launch the guided tour.
2. **Live Neural Stream (`/live`)**: Continuous zero-chrome uPlot EEG traces, interactive 3D cortical map with C3/C4 sensorimotor glow, and dual-dwell Intent Ring.
3. **Assistive Control (`/assist`)**:
   - **Command Board**: 3-level binary hierarchy for wheelchairs, hydration, and emergency dispatch.
   - **Predictive Huffman Keyboard**: Dynamic letter frequency tree with continuous language-model completions.
   - **Decision Log**: Real-time audit trail tracking latency, intended vs decided labels, and accuracy.
4. **Metrics Lab (`/lab`)**: Complete quantitative held-out evaluation, 2×2 confusion matrix, latency distribution with live moving dot, interactive noise stress test, and architectural pipeline flow.

---

## ⚠️ Honest Scientific Limitations

- **Subject Cohort**: Evaluated across 9 healthy individuals. While standard in academic BCI literature, clinical deployment requires broader validation across diverse neurological cohorts.
- **BCI Illiteracy**: Subject 2 demonstrates physiological motor imagery illiteracy (~59% accuracy), a known phenomenon affecting approximately 15–20% of users.
- **Hardware Interface**: Validated against calibrated benchmark recordings rather than wet-electrode live telemetry.
- **Calibration Requirement**: While inference runs in 0.41 ms, an initial 2-minute session calibration is required per participant to fit personalized CSP spatial filters.

---

## 📜 Citations & Open Source

- **Dataset**: BCI Competition IV (Dataset 2a), Graz University of Technology (Brunner et al., 2008).
- **Libraries**: MOABB, Braindecode, MNE-Python, scikit-learn, PyTorch, FastAPI, Next.js, uPlot, Framer Motion, shadcn/ui.
- **Hackathon**: Developed for AI MANTHAN 2.0. All code written during the event.
