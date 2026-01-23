import urllib.request
import urllib.error
import json
import sys
import concurrent.futures
import time

BASE_URL = "http://localhost:8000"

def get_json(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        if response.status != 200:
            raise Exception(f"Status {response.status}")
        return json.loads(response.read().decode())

def post_json(url, data):
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as response:
        return response.status, json.loads(response.read().decode())

def test_health():
    data = get_json(f"{BASE_URL}/health")
    print(f"Health: OK {data}")

def test_logs():
    data = get_json(f"{BASE_URL}/api/logs")
    print(f"Logs: OK Count: {len(data)}")

def call_agent(i):
    payload = {
        "prompt": f"Hello {i}", 
        "pwd": "/tmp",
        "session_id": f"test-session-urllib-{i}"
    }
    try:
        status, _ = post_json(f"{BASE_URL}/agent/claude", payload)
        return status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return str(e)

def test_agent_concurrent():
    print("Launching 3 concurrent requests...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(call_agent, i) for i in range(3)]
        results = [f.result() for f in futures]
        
    print(f"Results: {results}")

    # Check logs for entries
    try:
        logs = get_json(f"{BASE_URL}/api/logs")
    except Exception as e:
        print("Failed to get logs")
        raise e
        
    # Look for our test-session logs
    # We used session_id starting with test-session-urllib-
    test_logs = [l for l in logs if l.get("session_id", "").startswith("test-session-urllib-")]
    print(f"Test Logs Found: {len(test_logs)}")
    
    # Verify IDs are unique
    ids = [l["id"] for l in test_logs]
    print(f"Log IDs: {ids}")
    
    if len(ids) < 3:
        print("WARNING: Fewer logs than requests. Agent might have failed too fast or queue full?")
        
    if len(ids) != len(set(ids)):
        print("DUPLICATE IDS FOUND!")
        sys.exit(1)
        
    # Check if IDs are unique
    if len(set(ids)) == len(ids):
        print("IDs are unique.")
    else:
        print("FAIL: IDs are not unique.")
        sys.exit(1)

def main():
    try:
        # wait a bit
        time.sleep(2) 
        print("Testing Health...")
        test_health()
        print("Testing Logs...")
        test_logs()
        print("Testing Concurrent Agent Calls...")
        test_agent_concurrent()
        print("Verification Complete!")
    except Exception as e:
        print(f"Verification Failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
