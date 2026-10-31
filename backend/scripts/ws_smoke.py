import asyncio
import json
import time
from typing import List
import numpy as np
import websockets

WS_URI = "ws://localhost:8000/ws"


async def run_smoke_test(target_frames: int = 20, subject: int = 3) -> None:
    print("\n" + "=" * 78)
    print(f"🚀 HALO BCI — WEBSOCKET REPLAY SMOKE TEST")
    print(f"   Connecting to: {WS_URI}")
    print(f"   Target: Subject {subject} | Target frames: {target_frames} | Speed: 1.0x")
    print("=" * 78 + "\n")

    async with websockets.connect(WS_URI) as ws:
        # 1. Receive Handshake Hello
        hello_raw = await ws.recv()
        hello = json.loads(hello_raw)
        print(f"✅ Handshake: {hello['type'].upper()} received.")
        print(f"   Channels: {len(hello['channels'])}, sfreq: {hello['sfreq']} Hz, hop: {hello['hop_ms']} ms")
        print(f"   Available models: {hello['models']}")

        # 2. Receive Initial Status
        status_raw = await ws.recv()
        status = json.loads(status_raw)
        print(f"✅ Initial status: state='{status['state']}', subject={status['subject']}, model='{status['model']}'\n")

        # 3. Send Control: Start Subject 3
        start_cmd = {
            "type": "control",
            "action": "start",
            "subject": subject,
            "speed": 1.0,
        }
        await ws.send(json.dumps(start_cmd))

        # Header for frame table
        print("-" * 78)
        print(f"{'#':<4}{'Time (s)':<10}{'Trial':<8}{'Truth':<10}{'Pred Label':<12}{'Confidence':<14}{'Latency':<12}{'Match':<6}")
        print("-" * 78)

        frames_received = 0
        timestamps: List[float] = []
        latencies: List[float] = []
        matches: List[bool] = []

        t_start = time.perf_counter()

        while frames_received < target_frames:
            msg_raw = await ws.recv()
            msg = json.loads(msg_raw)

            if msg.get("type") == "frame":
                now = time.perf_counter()
                timestamps.append(now)

                t = msg.get("t", 0.0)
                trial = msg.get("trial", 0)
                truth = msg.get("truth", "rest")
                pred = msg.get("pred", {})
                label = pred.get("label", "-")
                conf = pred.get("confidence", 0.0)
                lat = pred.get("latency_ms", 0.0)

                latencies.append(lat)
                truth_str = str(truth) if truth is not None else "rest"
                is_match = (truth == label) if truth is not None else True
                if truth is not None:
                    matches.append(truth == label)

                match_str = "✅" if is_match else "❌"

                frames_received += 1
                print(
                    f"{frames_received:<4}{t:<10.2f}{trial:<8}{truth_str:<10}{label:<12}{conf:<14.2%}{lat:<8.2f} ms   {match_str}"
                )

        t_end = time.perf_counter()

        # Send pause and reset
        await ws.send(json.dumps({"type": "control", "action": "pause"}))
        await ws.send(json.dumps({"type": "control", "action": "reset"}))

        # Calculate statistics
        total_time = t_end - t_start
        actual_fps = (target_frames - 1) / (timestamps[-1] - timestamps[0]) if len(timestamps) > 1 else 10.0

        lat_arr = np.array(latencies)
        p50 = float(np.median(lat_arr))
        p95 = float(np.percentile(lat_arr, 95))
        mean_lat = float(np.mean(lat_arr))

        print("-" * 78)
        print("\n📊 SMOKE TEST PERFORMANCE METRICS:")
        print(f"   • Frames streamed:          {frames_received} frames")
        print(f"   • Total elapsed time:       {total_time:.2f} s")
        print(f"   • Measured Frame Rate:      {actual_fps:.2f} fps (Target: ~10.0 fps)")
        print(f"   • Inference Latency (Mean): {mean_lat:.2f} ms")
        print(f"   • Inference Latency (p50):  {p50:.2f} ms")
        print(f"   • Inference Latency (p95):  {p95:.2f} ms (Budget: < 50.0 ms)")

        if matches:
            acc = (sum(matches) / len(matches)) * 100
            print(f"   • Active trial accuracy:    {acc:.1f}% ({sum(matches)}/{len(matches)} frames)")

        # Acceptance checks
        fps_ok = 8.5 <= actual_fps <= 11.5
        lat_ok = p95 < 50.0

        print("\n" + "=" * 78)
        print(f"🏁 ACCEPTANCE CRITERIA STATUS:")
        print(f"   [1] Frame rate ~ 10 fps (8.5 - 11.5): {'✅ PASSED' if fps_ok else '❌ FAILED'} ({actual_fps:.2f} fps)")
        print(f"   [2] p95 Latency < 50 ms:              {'✅ PASSED' if lat_ok else '❌ FAILED'} ({p95:.2f} ms)")
        print("=" * 78 + "\n")


if __name__ == "__main__":
    asyncio.run(run_smoke_test(target_frames=20, subject=3))
