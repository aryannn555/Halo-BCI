import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import (
    CHANNELS,
    HOP_MS,
    MODELS_DIR,
    SFREQ,
    SUBJECTS,
    WINDOW_S,
)
from app.replay import ReplaySession

logger = logging.getLogger("halo.ws")
router = APIRouter()


def get_available_models() -> list[str]:
    """Dynamically discovers fitted model architectures from backend/models/."""
    available = set()
    if MODELS_DIR.exists():
        for file in MODELS_DIR.iterdir():
            if file.suffix in (".joblib", ".pt"):
                stem = file.stem
                if stem in ("csp_lda", "eegnet", "shallow_fbcsp"):
                    available.add(stem)
                elif "_csp_lda" in stem:
                    available.add("csp_lda")
                elif "_eegnet" in stem:
                    available.add("eegnet")
                elif "_shallow_fbcsp" in stem:
                    available.add("shallow_fbcsp")

    discovered = sorted(list(available))
    return discovered if discovered else ["csp_lda", "eegnet"]


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Manages an isolated ReplaySession per WebSocket client connection.

    Implements the full CONTRACTS.md specification with zero-crash robustness.
    """
    await websocket.accept()
    logger.info("Client connected to /ws from %s", websocket.client)

    async def send_json(payload: dict[str, Any]) -> None:
        try:
            await websocket.send_text(json.dumps(payload))
        except Exception:
            pass

    # Initialize isolated session for this connection
    available_models = get_available_models()
    default_model = "csp_lda" if "csp_lda" in available_models else available_models[0]

    session = ReplaySession(
        broadcast_fn=send_json,
        subject=1,
        model_name=default_model,
        speed=1.0,
    )

    try:
        # 1. Send Hello handshake
        hello_payload = {
            "type": "hello",
            "channels": list(CHANNELS),
            "sfreq": SFREQ,
            "classes": ["left", "right"],
            "window_s": float(WINDOW_S),
            "hop_ms": HOP_MS,
            "subjects": list(SUBJECTS),
            "models": available_models,
        }
        await send_json(hello_payload)

        # 2. Send Initial Status
        await send_json(session.get_status_payload())

        # 3. Message loop
        while True:
            text = await websocket.receive_text()

            # Malformed JSON robustness
            try:
                data = json.loads(text)
            except json.JSONDecodeError as exc:
                logger.warning("Received malformed JSON from client: %s", exc)
                await send_json({
                    "type": "error",
                    "message": "Malformed JSON payload. Expected valid JSON object.",
                })
                continue

            if not isinstance(data, dict):
                await send_json({
                    "type": "error",
                    "message": "Message payload must be a JSON object with 'type' field.",
                })
                continue

            msg_type = data.get("type")

            # A. Control Message
            if msg_type == "control":
                action = data.get("action")
                subj_arg = data.get("subject")
                speed_arg = data.get("speed")

                # Handle subject change if provided
                if subj_arg is not None:
                    try:
                        s_int = int(subj_arg)
                        if s_int not in SUBJECTS:
                            await send_json({
                                "type": "error",
                                "message": f"Unknown subject ID: {s_int}. Available: {SUBJECTS}",
                            })
                            continue
                        elif s_int != session.subject:
                            await session.set_subject(s_int)
                    except ValueError:
                        await send_json({
                            "type": "error",
                            "message": f"Invalid subject argument: '{subj_arg}'. Must be an integer.",
                        })
                        continue

                # Handle speed change if provided
                if speed_arg is not None:
                    try:
                        sp_val = float(speed_arg)
                        await session.set_speed(sp_val)
                    except ValueError:
                        await send_json({
                            "type": "error",
                            "message": f"Invalid speed argument: '{speed_arg}'. Must be a number.",
                        })
                        continue

                # Dispatch actions
                if action == "start":
                    await session.start()
                elif action == "pause":
                    await session.pause()
                elif action == "reset":
                    await session.reset()
                elif action == "queue_trial":
                    want_arg = data.get("want")
                    if not want_arg or want_arg not in ("left", "right"):
                        await send_json({
                            "type": "error",
                            "message": f"Invalid or missing 'want' argument for queue_trial: '{want_arg}'. Must be 'left' or 'right'.",
                        })
                    else:
                        await session.queue_trial(want_arg)
                elif action == "change_subject" or action == "change_speed":
                    pass  # Already handled above
                else:
                    await send_json({
                        "type": "error",
                        "message": f"Unrecognized control action: '{action}'. Expected 'start', 'pause', 'reset', 'queue_trial', 'change_subject', or 'change_speed'.",
                    })

            # B. Config Message
            elif msg_type == "config":
                model_arg = data.get("model")
                noise_arg = data.get("noise_snr_db")
                thresh_arg = data.get("threshold")
                dwell_arg = data.get("dwell_ms")
                mode_arg = data.get("mode")

                if model_arg is not None:
                    if model_arg not in available_models:
                        await send_json({
                            "type": "error",
                            "message": f"Requested model '{model_arg}' not found. Available models: {available_models}",
                        })
                        continue

                if mode_arg is not None and mode_arg not in ("open", "scripted"):
                    await send_json({
                        "type": "error",
                        "message": f"Invalid mode argument: '{mode_arg}'. Must be 'open' or 'scripted'.",
                    })
                    continue

                await session.set_config(
                    model=model_arg,
                    noise_snr_db=noise_arg,
                    threshold=thresh_arg,
                    dwell_ms=dwell_arg,
                    mode=mode_arg,
                )

            else:
                await send_json({
                    "type": "error",
                    "message": f"Unrecognized message type: '{msg_type}'. Expected 'control' or 'config'.",
                })

    except WebSocketDisconnect:
        logger.info("Client disconnected cleanly.")
    except Exception as exc:
        logger.exception("Unexpected error in WebSocket session: %s", exc)
        try:
            await send_json({"type": "error", "message": f"Internal server error: {exc!s}"})
        except Exception:
            pass
    finally:
        session.close()
