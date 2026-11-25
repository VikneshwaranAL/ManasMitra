#!/usr/bin/env python3
"""
Test ManasMitra REST API Endpoints
"""

import urllib.request
import json
import time
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000"

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode('utf-8'))

def post(path, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode('utf-8'))

def test_all():
    print("Testing ManasMitra API Endpoints...")
    
    # 1. Status
    status = get("/api/status")
    print("[OK] Status:", status.get('status'), "| DB:", status.get('database'))
    assert status.get('status') == 'online', "Status check failed"

    # 2. Patient
    patient = get("/api/patient")
    print("[OK] Active Patient:", patient.get('name'), "| Age:", patient.get('age'), "| Caregiver:", patient.get('caregiver_name'))
    assert patient.get('name') == 'Shanti Devi', "Patient fetch failed"

    # 3. Cognitive Games
    games = get("/api/games")
    print(f"[OK] Catalog Games Count: {len(games)} activities")
    assert len(games) == 14, "Games count should be 14"

    # 4. Scores
    scores = get("/api/scores")
    print(f"[OK] Scores Count: {len(scores)} historical sessions")
    assert len(scores) >= 6, "Expected at least 6 seed scores"

    # 5. Add new score via POST
    new_score = post("/api/scores", {
        "patient_id": 1,
        "game_id": "g_s1_memory",
        "game_name": "Memory Match Cards",
        "stage": "Stage I",
        "score": 100,
        "duration_seconds": 32
    })
    print("[OK] Recorded Game Score POST:", new_score)
    assert new_score.get('success') is True, "Score insertion failed"

    # 6. Reminders
    reminders = get("/api/reminders")
    print(f"[OK] Reminders Count: {len(reminders)} routine tasks")
    assert len(reminders) >= 4, "Expected at least 4 reminders"

    # 7. AI Insights
    ai = get("/api/ai-insights")
    print(f"[OK] AI Insights: Games={ai.get('games_count')}, AvgAcc={ai.get('avg_accuracy')}%, TaskPct={ai.get('task_completion_pct')}%")
    assert len(ai.get('recommendations')) >= 3, "Expected at least 3 recommendations"

    # 8. Memories
    memories = get("/api/memories")
    print(f"[OK] Memory Book: {len(memories)} entries")

    # 9. Family
    family = get("/api/family")
    print(f"[OK] Family Directory: {len(family)} members")

    print("\n[SUCCESS] ALL DATABASE REST API TESTS PASSED PERFECTLY!\n")

if __name__ == '__main__':
    try:
        test_all()
    except Exception as e:
        print(f"[FAIL] Test failed: {e}", file=sys.stderr)
        sys.exit(1)
