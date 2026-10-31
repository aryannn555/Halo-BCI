import sys
from pathlib import Path

# Add repo root and backend directory to path
repo_root = Path(__file__).resolve().parent.parent
backend_dir = repo_root / "backend"
for p in [repo_root, backend_dir]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import asyncio
from backend.scripts.ws_smoke import run_smoke_test

if __name__ == "__main__":
    asyncio.run(run_smoke_test(target_frames=20, subject=3))
