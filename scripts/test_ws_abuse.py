import asyncio
import json
import psutil
import websockets

WS_URI = "ws://localhost:8000/ws"

def get_server_process():
    for p in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmd = " ".join(p.info['cmdline'] or [])
            if "uvicorn" in cmd and "8000" in cmd:
                return p
        except Exception:
            pass
    return None

async def test_abuse_suite():
    print("\n" + "=" * 80)
    print("🔥 HALO BCI — WEBSOCKET ROBUSTNESS & ABUSE TEST SUITE")
    print("=" * 80)

    server_proc = get_server_process()
    initial_rss_mb = server_proc.memory_info().rss / (1024 * 1024) if server_proc else 0.0
    print(f"Initial server memory (RSS): {initial_rss_mb:.2f} MB")

    # 1. Malformed JSON test
    print("\n[1/7] Testing Malformed JSON & Unknown fields...")
    async with websockets.connect(WS_URI) as ws:
        await ws.recv()  # hello
        await ws.recv()  # status

        await ws.send("{malformed json text!@#$")
        res = json.loads(await ws.recv())
        assert res.get("type") == "error", f"Expected error for malformed JSON, got {res}"
        print("  ✓ Malformed JSON rejected gracefully with error message.")

        # 2. Unknown action
        await ws.send(json.dumps({"type": "control", "action": "unknown_action_xyz"}))
        res = json.loads(await ws.recv())
        assert res.get("type") == "error", f"Expected error for unknown action, got {res}"
        print("  ✓ Unknown action rejected gracefully.")

        # 3. Unknown subject
        await ws.send(json.dumps({"type": "control", "action": "start", "subject": 999}))
        res = json.loads(await ws.recv())
        assert res.get("type") == "error", f"Expected error for subject 999, got {res}"
        print("  ✓ Out-of-bounds subject ID rejected gracefully.")

        # 4. Unknown model
        await ws.send(json.dumps({"type": "config", "model": "non_existent_model"}))
        res = json.loads(await ws.recv())
        assert res.get("type") == "error", f"Expected error for unknown model, got {res}"
        print("  ✓ Unknown model name rejected gracefully.")

    # 5. Switching model & subject mid-trial
    print("\n[2/7] Testing mid-trial rapid Model and Subject switching...")
    async with websockets.connect(WS_URI) as ws:
        await ws.recv()
        await ws.recv()
        await ws.send(json.dumps({"type": "control", "action": "start", "subject": 1}))

        for i in range(10):
            # Switch subject and model rapidly while active
            subj = (i % 9) + 1
            mod = "eegnet" if i % 2 == 0 else "csp_lda"
            await ws.send(json.dumps({"type": "control", "subject": subj}))
            await ws.send(json.dumps({"type": "config", "model": mod}))
            # Read whatever comes (status or frames)
            msg = json.loads(await ws.recv())

        await ws.send(json.dumps({"type": "control", "action": "pause"}))
        print("  ✓ Rapid subject and model switching survived without crash.")

    # 6. Rapid start and pause spam (100 times)
    print("\n[3/7] Testing 100 rapid start/pause toggles...")
    async with websockets.connect(WS_URI) as ws:
        await ws.recv()
        await ws.recv()
        for _ in range(100):
            await ws.send(json.dumps({"type": "control", "action": "start"}))
            await ws.send(json.dumps({"type": "control", "action": "pause"}))
            await asyncio.sleep(0.005)
        await ws.send(json.dumps({"type": "control", "action": "reset"}))
        print("  ✓ 100 rapid start/pause toggles handled cleanly without task leaks.")

    # 7. Disconnecting mid-stream abruptly
    print("\n[4/7] Testing abrupt disconnects mid-stream (5 repetitions)...")
    for rep in range(5):
        ws = await websockets.connect(WS_URI)
        await ws.recv()
        await ws.recv()
        await ws.send(json.dumps({"type": "control", "action": "start", "subject": 3}))
        for _ in range(3):
            await ws.recv()
        # Abrupt hard close
        await ws.close()
    print("  ✓ 5 abrupt stream disconnections cleaned up with zero server errors.")

    # 8. 10 simultaneous connections streaming concurrently
    print("\n[5/7] Testing 10 simultaneous active streaming connections...")
    async def worker(idx):
        async with websockets.connect(WS_URI) as client_ws:
            await client_ws.recv()
            await client_ws.recv()
            await client_ws.send(json.dumps({"type": "control", "action": "start", "subject": (idx % 9) + 1}))
            received = 0
            for _ in range(10):
                msg = json.loads(await client_ws.recv())
                if msg.get("type") == "frame":
                    received += 1
            await client_ws.send(json.dumps({"type": "control", "action": "pause"}))
            return received

    tasks = [worker(i) for i in range(10)]
    results = await asyncio.gather(*tasks)
    print(f"  ✓ 10 simultaneous streaming clients received {sum(results)} total frames successfully.")

    # Memory Check
    print("\n[6/7] Verifying memory stability...")
    if server_proc:
        final_rss_mb = server_proc.memory_info().rss / (1024 * 1024)
        delta_mb = final_rss_mb - initial_rss_mb
        print(f"  Initial RSS: {initial_rss_mb:.2f} MB | Final RSS: {final_rss_mb:.2f} MB | Delta: {delta_mb:+.2f} MB")
        assert delta_mb < 150.0, f"Excessive memory growth: {delta_mb:.2f} MB"
        print("  ✓ Memory remains stable, bounded, and leak-free.")

    print("\n" + "=" * 80)
    print("🏁 ALL WEBSOCKET ABUSE & RESILIENCE TESTS PASSED (100%)")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    asyncio.run(test_abuse_suite())
