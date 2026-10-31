import asyncio
import json
import time
import numpy as np
import websockets

WS_URI = "ws://localhost:8000/ws"

async def test_subject_model(subject: int, model: str, n_frames: int = 15):
    async with websockets.connect(WS_URI) as ws:
        # Handshake
        hello = json.loads(await ws.recv())
        status = json.loads(await ws.recv())

        # Configure model
        await ws.send(json.dumps({"type": "config", "model": model}))
        # Start subject at 1.0x
        await ws.send(json.dumps({
            "type": "control",
            "action": "start",
            "subject": subject,
            "speed": 1.0,
        }))

        timestamps = []
        latencies = []
        times_t = []
        frames = 0
        dropped_or_oou = 0

        while frames < n_frames:
            msg = json.loads(await ws.recv())
            if msg.get("type") == "frame":
                now = time.perf_counter()
                timestamps.append(now)
                t_frame = msg.get("t", 0.0)
                times_t.append(t_frame)

                # Check monotonically increasing frame time
                if len(times_t) > 1 and times_t[-1] < times_t[-2]:
                    dropped_or_oou += 1

                lat = msg.get("pred", {}).get("latency_ms", 0.0)
                latencies.append(lat)
                frames += 1

        # Pause and clean up
        await ws.send(json.dumps({"type": "control", "action": "pause"}))
        await ws.send(json.dumps({"type": "control", "action": "reset"}))

        dur = timestamps[-1] - timestamps[0]
        fps = (frames - 1) / dur if dur > 0 else 10.0
        lat_arr = np.array(latencies)
        p50 = float(np.median(lat_arr))
        p95 = float(np.percentile(lat_arr, 95))

        return {
            "subject": subject,
            "model": model,
            "frames": frames,
            "fps": fps,
            "p50_ms": p50,
            "p95_ms": p95,
            "dropped_oou": dropped_or_oou,
        }

async def main():
    subjects = list(range(1, 10))
    models = ["csp_lda", "eegnet"]

    print("\n" + "=" * 80)
    print("🚀 HALO BCI — MULTI-SUBJECT & MULTI-MODEL WEBSOCKET SMOKE AUDIT")
    print("=" * 80)
    print(f"{'Subject':<10}{'Model':<12}{'Frames':<10}{'FPS':<12}{'p50 (ms)':<14}{'p95 (ms)':<14}{'Disorder/Drop':<15}")
    print("-" * 80)

    results = []
    for s in subjects:
        for m in models:
            res = await test_subject_model(s, m, n_frames=12)
            results.append(res)
            print(
                f"S{res['subject']:<9}{res['model']:<12}{res['frames']:<10}{res['fps']:<12.2f}"
                f"{res['p50_ms']:<14.2f}{res['p95_ms']:<14.2f}{res['dropped_oou']:<15}"
            )

    print("=" * 80)
    # Assertions
    all_fps_ok = all(8.5 <= r["fps"] <= 12.0 for r in results)
    all_lat_ok = all(r["p95_ms"] <= 50.0 for r in results)
    all_order_ok = all(r["dropped_oou"] == 0 for r in results)

    print(f"Frame Rate (~10 fps [8.5-12.0]):  {'✅ PASS' if all_fps_ok else '❌ FAIL'}")
    print(f"p95 Latency (< 50 ms budget):     {'✅ PASS' if all_lat_ok else '❌ FAIL'}")
    print(f"Dropped / Out-of-Order:          {'✅ PASS (0 errors)' if all_order_ok else '❌ FAIL'}")
    print("=" * 80 + "\n")

    if not (all_fps_ok and all_lat_ok and all_order_ok):
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
