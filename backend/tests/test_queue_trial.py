import asyncio
import json
import websockets

async def test_queue_trial():
    uri = "ws://localhost:8000/ws"
    print(f"Connecting to {uri} for queue_trial smoke test...")

    async with websockets.connect(uri) as ws:
        # Hello handshake
        hello = json.loads(await ws.recv())
        assert hello["type"] == "hello"

        # Initial status
        status = json.loads(await ws.recv())
        assert status["type"] == "status"
        print(f"✓ Initial status: {status}")

        # 1. Configure scripted mode
        print("\n1. Switching to scripted mode...")
        await ws.send(json.dumps({"type": "config", "mode": "scripted"}))

        # Drain until status reflects scripted mode
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("type") == "status":
                assert msg.get("mode") == "scripted", f"Expected mode=scripted, got {msg}"
                print("✓ Successfully confirmed mode: scripted")
                break

        # 2. Queue LEFT trial
        print("\n2. Queueing LEFT trial...")
        await ws.send(json.dumps({"type": "control", "action": "queue_trial", "want": "left"}))

        # Collect frames and verify truth and trial_id
        left_trial_id = None
        for _ in range(15):
            msg = json.loads(await ws.recv())
            if msg.get("type") == "frame":
                assert msg["truth"] == "left", f"Expected truth=left, got {msg['truth']}"
                assert "trial_id" in msg, "Missing trial_id in frame"
                assert "left" in msg["trial_id"], f"Expected left in trial_id: {msg['trial_id']}"
                if left_trial_id is None:
                    left_trial_id = msg["trial_id"]
                    print(f"✓ Confirmed LEFT trial active: trial_id={left_trial_id}")

        # 3. Queue RIGHT trial immediately (interruption test)
        print("\n3. Queueing RIGHT trial immediately (interruption)...")
        await ws.send(json.dumps({"type": "control", "action": "queue_trial", "want": "right"}))

        right_trial_id = None
        for _ in range(15):
            msg = json.loads(await ws.recv())
            if msg.get("type") == "frame":
                assert msg["truth"] == "right", f"Expected truth=right, got {msg['truth']}"
                assert "trial_id" in msg, "Missing trial_id in frame"
                assert "right" in msg["trial_id"], f"Expected right in trial_id: {msg['trial_id']}"
                if right_trial_id is None:
                    right_trial_id = msg["trial_id"]
                    print(f"✓ Confirmed RIGHT trial active: trial_id={right_trial_id}")

        # 4. Queue another RIGHT trial (pool cycling - verify no immediate repeat)
        print("\n4. Queueing second consecutive RIGHT trial (testing no-repeat pool cycling)...")
        await ws.send(json.dumps({"type": "control", "action": "queue_trial", "want": "right"}))

        second_right_id = None
        for _ in range(15):
            msg = json.loads(await ws.recv())
            if msg.get("type") == "frame":
                assert msg["truth"] == "right"
                if second_right_id is None:
                    second_right_id = msg["trial_id"]
                    print(f"✓ Confirmed second RIGHT trial: trial_id={second_right_id}")
                    assert second_right_id != right_trial_id, f"Repeated identical trial twice in a row: {second_right_id}"

        # 5. Reset back to open mode
        await ws.send(json.dumps({"type": "config", "mode": "open"}))
        await ws.send(json.dumps({"type": "control", "action": "pause"}))

        print("\n Smoke test passed: queue_trial, scripted mode, trial interruption, and trial_id are fully functional!")

if __name__ == "__main__":
    asyncio.run(test_queue_trial())
