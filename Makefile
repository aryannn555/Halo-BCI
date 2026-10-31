export PATH := $(HOME)/.local/bin:$(HOME)/.local/node/bin:$(PATH)

.PHONY: dev dev-backend dev-frontend install test-health demo evaluate export-session test

demo:
	@echo "Launching Halo BCI Platform (Backend + Frontend)..."
	@trap 'kill 0' EXIT; \
	(cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000) & \
	(cd frontend && npm run dev) & \
	sleep 5; \
	open http://localhost:3000 || xdg-open http://localhost:3000 || echo "Open http://localhost:3000 in your browser"; \
	wait

dev:
	@echo "Starting Halo Backend (FastAPI on :8000) and Frontend (Next.js on :3000)..."
	@trap 'kill 0' EXIT; (cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000) & (cd frontend && npm run dev)

dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

test:
	cd frontend && npx vitest run
	cd backend && .venv/bin/pytest tests/

evaluate:
	cd backend && .venv/bin/python -m ml.evaluate

export-session:
	cd backend && .venv/bin/python scripts/export_session.py

test-health:
	curl -s http://localhost:8000/health
