# WEBSOCKET CONTRACT (ws://localhost:8000/ws) - JSON messages

## Server -> client:
- **hello**:
  ```json
  {
    "type": "hello",
    "channels": ["Fz", "FC3", "FC1", "FCz", "FC2", "FC4", "C5", "C3", "C1", "Cz", "C2", "C4", "C6", "CP3", "CP1", "CPz", "CP2", "CP4", "P1", "Pz", "P2", "Oz"],
    "sfreq": 250,
    "classes": ["left", "right"],
    "window_s": 2.0,
    "hop_ms": 100,
    "subjects": [1, 2, 3, 4, 5, 6, 7, 8, 9],
    "models": ["csp_lda", "shallow_fbcsp", "eegnet"]
  }
  ```
- **frame**:
  ```json
  {
    "type": "frame",
    "t": 12.4,
    "trial": 4,
    "trial_id": "sub01_sess1_trial004_left",
    "truth": "left",
    "eeg": [[0.0]],
    "bandpower": {
      "mu": [1.42],
      "beta": [0.65]
    },
    "pred": {
      "left": 0.84,
      "right": 0.16,
      "label": "left",
      "confidence": 0.84,
      "latency_ms": 14.2
    },
    "noise_snr_db": null
  }
  ```
  *Note on `bandpower`: Values are sent as a normalized **RATIO** relative to each channel's rolling baseline (exponential moving average over ~20 s). 1.0 indicates resting baseline power; values < 1.0 indicate event-related desynchronization (ERD, e.g. motor cortex activation during imagery), and values > 1.0 indicate event-related synchronization (ERS).*

- **status**:
  ```json
  {
    "type": "status",
    "state": "idle",
    "subject": 1,
    "model": "csp_lda",
    "mode": "open"
  }
  ```
- **error**:
  ```json
  {
    "type": "error",
    "message": "Error description"
  }
  ```

---

## Client -> server:
- **control**:
  ```json
  {
    "type": "control",
    "action": "start", // "start" | "pause" | "reset" | "queue_trial"
    "subject": 1,
    "speed": 1.0,
    "want": "left" // required when action is "queue_trial": "left" | "right"
  }
  ```
  *Note on `queue_trial`: Ends the current trial now and starts the next held-out trial of that class (cycles through the pool, never repeating the same trial twice in a row). Decoder smoother and ring buffer reset at trial start.*

- **config**:
  ```json
  {
    "type": "config",
    "model": "csp_lda",
    "noise_snr_db": null,
    "threshold": 0.65,
    "dwell_ms": 600,
    "mode": "open" // "open" | "scripted"
  }
  ```
  *Note on `mode`: In `open` mode trials play in dataset order. In `scripted` mode the server only advances when it receives `queue_trial` and loops the current trial's final second if none arrives (so the stream never stalls).*
