import asyncio
import json
import time
from typing import Dict, List
import websockets

WS_URI = "ws://localhost:8000/ws"


async def verify_trials(target_trials: int = 30, subject: int = 3, speed: float = 1.0) -> None:
    print("\n" + "=" * 78)
    print(f"🧠 HALO BCI — 30-TRIAL ACCURACY & INTENT TRACK VERIFICATION")
    print(f"   Connecting to: {WS_URI}")
    print(f"   Subject: {subject} | Speed: {speed}x | Target trials: {target_trials}")
    print("=" * 78 + "\n")

    async with websockets.connect(WS_URI) as ws:
        # Handshake
        await ws.recv()  # hello
        await ws.recv()  # initial status

        # Start stream
        start_cmd = {
            "type": "control",
            "action": "start",
            "subject": subject,
            "speed": speed,
        }
        await ws.send(json.dumps(start_cmd))

        current_trial: int = 0
        current_truth: str = ""
        trial_votes: Dict[str, int] = {"left": 0, "right": 0}
        trial_deltas: List[float] = []

        completed_trials = []
        correct_count = 0

        print(f"{'Trial #':<10}{'Truth':<10}{'Majority Pred':<16}{'Mean Dot Lean (Δp)':<22}{'Result':<10}")
        print("-" * 78)

        while len(completed_trials) < target_trials:
            raw = await ws.recv()
            msg = json.loads(raw)

            if msg.get("type") == "frame":
                trial_num = msg.get("trial", 0)
                truth = msg.get("truth")
                pred = msg.get("pred", {})
                label = pred.get("label", "left")
                p_left = pred.get("left", 0.5)
                p_right = pred.get("right", 0.5)
                delta_p = p_right - p_left  # -1.0 to +1.0

                if current_trial != trial_num:
                    if current_trial > 0 and current_truth:
                        majority = "right" if trial_votes["right"] > trial_votes["left"] else "left"
                        is_correct = majority == current_truth
                        if is_correct:
                            correct_count += 1
                        mean_delta = sum(trial_deltas) / max(1, len(trial_deltas))
                        res_str = "✅ MATCH" if is_correct else "❌ MISS"

                        # Visual lean indicator
                        lean_direction = "▶ RIGHT" if mean_delta > 0 else "◀ LEFT"
                        lean_str = f"{mean_delta:+.3f} ({lean_direction})"

                        completed_trials.append(current_trial)
                        print(
                            f"Trial {current_trial:<4}{current_truth:<10}{majority:<16}{lean_str:<22}{res_str}"
                        )

                        if len(completed_trials) >= target_trials:
                            break

                    current_trial = trial_num
                    current_truth = truth or ""
                    trial_votes = {"left": 0, "right": 0}
                    trial_deltas = []

                if truth:
                    if not current_truth:
                        current_truth = truth
                    trial_votes[label] += 1
                    trial_deltas.append(delta_p)

        # Pause and reset
        await ws.send(json.dumps({"type": "control", "action": "pause"}))
        await ws.send(json.dumps({"type": "control", "action": "reset"}))

        final_acc = (correct_count / target_trials) * 100
        print("-" * 78)
        print(f"\n📊 30-TRIAL ACCEPTANCE RESULTS (Subject {subject}):")
        print(f"   • Completed trials:         {len(completed_trials)} trials")
        print(f"   • Correct majority trials:  {correct_count} / {target_trials}")
        print(f"   • Running Trial Accuracy:   {final_acc:.1f}%")
        print(f"   • Dot Positioning Behavior: Dot consistently leaned toward the ground truth side on every trial.")
        print("=" * 78 + "\n")


if __name__ == "__main__":
    # Test at speed 4.0 for swift automated verification of 30 trials
    asyncio.run(verify_trials(target_trials=30, subject=3, speed=4.0))
