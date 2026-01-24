import requests
import json
import time

BASE_URL = "http://localhost:8000"

def run_verification():
    print("Starting verification...")
    
    # 1. Get current session
    print("Fetching sessions...")
    try:
        resp = requests.get(f"{BASE_URL}/api/sessions")
        sessions = resp.json()['sessions']
        if not sessions:
            print("No sessions found. Creating one...")
            resp = requests.post(f"{BASE_URL}/api/sessions", json={"title": "Test Session", "root_directory": "/tmp"})
            session = resp.json()
            session_id = session['session_id']
            # Set as current
            requests.post(f"{BASE_URL}/api/sessions/{session_id}/current")
        else:
            # Find current or take first
            current = next((s for s in sessions if s.get('is_current_session')), sessions[0])
            session_id = current['session_id']
            if not current.get('is_current_session'):
                 requests.post(f"{BASE_URL}/api/sessions/{session_id}/current")
                 
        print(f"Using session: {session_id}")
    except Exception as e:
        print(f"Failed to get session: {e}")
        return

    # 2. Submit new batch
    print("Submitting new batch...")
    payload = {
        "pwd": "/tmp",
        "tasks": [
            {"id": "task_1", "agent": "claude", "instruction": "Test Task 1"},
            {"id": "task_2", "agent": "codex", "instruction": "Test Task 2"}
        ]
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/batch/submit", json=payload)
        resp.raise_for_status()
        data = resp.json()
        batch_id = data['batch_id']
        print(f"Submitted batch. ID: {batch_id}")
        
        # Verify ID format
        if batch_id.startswith("BCH-") and len(batch_id.split("-")) == 3:
            print("SUCCESS: Batch ID format matches BCH-XXXX-X")
        else:
            print(f"FAILURE: Batch ID format incorrect: {batch_id}")
            
    except Exception as e:
        print(f"Failed to submit batch: {e}")
        return

    # 3. List batches and check tasks
    print("Listing batches...")
    try:
        # Wait a moment for DB async? usually fast
        time.sleep(1)
        resp = requests.get(f"{BASE_URL}/api/batches?session_id={session_id}")
        batches = resp.json()
        
        target_batch = next((b for b in batches if b['batch_id'] == batch_id), None)
        
        if not target_batch:
            print("FAILURE: Newly created batch not found in list")
            return
            
        print("Found batch in list.")
        
        # Verify tasks
        tasks = target_batch.get('tasks', [])
        if len(tasks) == 2:
            print(f"SUCCESS: Batch has {len(tasks)} tasks.")
            print(f"Tasks: {json.dumps(tasks, indent=2)}")
        else:
            print(f"FAILURE: Batch has {len(tasks)} tasks, expected 2.")
            
    except Exception as e:
        print(f"Failed to list batches: {e}")

if __name__ == "__main__":
    run_verification()
