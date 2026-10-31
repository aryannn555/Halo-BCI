from pathlib import Path
from typing import List, Tuple
from pydantic import BaseModel, Field
import torch

BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = BASE_DIR / "cache"
MODELS_DIR = BASE_DIR / "models"

CACHE_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)

DATASET: str = "BNCI2014_001"
SFREQ: int = 250
BANDPASS: Tuple[float, float] = (8.0, 30.0)
WINDOW_S: float = 2.0
HOP_MS: int = 100
CLASSES: List[str] = ["left_hand", "right_hand"]
SEED: int = 42

CHANNELS: List[str] = [
    "Fz", "FC3", "FC1", "FCz", "FC2", "FC4",
    "C5", "C3", "C1", "Cz", "C2", "C4", "C6",
    "CP3", "CP1", "CPz", "CP2", "CP4",
    "P1", "Pz", "P2", "Oz"
]

SUBJECTS: List[int] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
MODELS: List[str] = ["csp_lda", "shallow_fbcsp", "eegnet"]


class Settings(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000
    sfreq: float = float(SFREQ)
    window_s: float = float(WINDOW_S)
    hop_ms: float = float(HOP_MS)
    channels: List[str] = Field(default_factory=lambda: list(CHANNELS))
    classes: List[str] = Field(default_factory=lambda: list(CLASSES))
    subjects: List[int] = Field(default_factory=lambda: list(SUBJECTS))
    models: List[str] = Field(default_factory=lambda: list(MODELS))
    default_model: str = "csp_lda"
    default_subject: int = 1
    device: str = "mps" if torch.backends.mps.is_available() else "cpu"

    @property
    def window_samples(self) -> int:
        return int(round(self.window_s * self.sfreq))

    @property
    def hop_samples(self) -> int:
        return int(round((self.hop_ms / 1000.0) * self.sfreq))


settings = Settings()
