import subprocess
import json
import logging
import asyncio
import os
import threading
import uuid
from typing import Optional, Set, List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from collections import deque
from datetime import datetime
from pathlib import Path
from db_logger import log_request_to_db

# --- Configuration ---
app = FastAPI()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory "Flight Recorder" (Stores last 50 calls)
call_history = deque(maxlen=50)

# WebSocket connections
connected_clients: Set[WebSocket] = set()

# Log storage directory
LOGS_DIR = Path(__file__).parent.parent / "logs"

# Batch Storage
batches: Dict[str, Dict[str, Any]] = {}
batch_lock = threading.Lock() # Global lock for batch dictionary operations


# --- Startup: Load existing logs from files ---
@app.on_event("startup")
async def load_logs_from_files():
    """Load recent logs from JSON files into memory on startup."""
    all_logs = []

    for agent_dir in ["claude", "codex"]:
        agent_path = LOGS_DIR / agent_dir
        if not agent_path.exists():
            continue

        for log_file in agent_path.glob("*.json"):
            try:
                session_data = json.loads(log_file.read_text())
                for log in session_data.get("logs", []):
                    all_logs.append(log)
            except (json.JSONDecodeError, KeyError):
                continue

    # Sort by ID (timestamp) descending and take most recent 50
    all_logs.sort(key=lambda x: x.get("id", 0), reverse=True)
    for log in all_logs[:50]:
        call_history.append(log)


# --- WebSocket Helper ---
async def broadcast_log_update(log_entry: dict):
    """Send log update to all connected WebSocket clients."""
    if not connected_clients:
        return
    message = json.dumps({"type": "log_update", "log": log_entry})
    disconnected = set()
    for client in connected_clients:
        try:
            await client.send_text(message)
        except:
            disconnected.add(client)
    connected_clients.difference_update(disconnected)

def broadcast_log_update_sync(log_entry: dict):
    """Thread-safe wrapper to call broadcast from background threads."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(broadcast_log_update(log_entry), loop)


# --- JSON Log File Storage ---
def save_log_to_file(agent: str, session_id: str, log_entry: dict, is_new_session: bool):
    """Save or append log entry to JSON file based on session ID."""
    if not session_id:
        return

    log_file = LOGS_DIR / agent / f"{session_id}.json"
    log_file.parent.mkdir(parents=True, exist_ok=True) # Ensure directory exists

    try:
        if is_new_session or not log_file.exists():
            session_data = {
                "session_id": session_id,
                "agent": agent,
                "created_at": log_entry["timestamp"],
                "logs": [log_entry]
            }
            log_file.write_text(json.dumps(session_data, indent=2))
        else:
            session_data = json.loads(log_file.read_text())
            session_data["logs"].append(log_entry)
            log_file.write_text(json.dumps(session_data, indent=2))
    except Exception as e:
        print(f"Error saving log: {e}")

class AgentRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None

class BatchTask(BaseModel):
    id: str
    agent: str # "claude" or "codex"
    instruction: str # The prompt
    session_id: Optional[str] = None # For resuming specific sessions

class BatchSubmitRequest(BaseModel):
    tasks: List[BatchTask]

class BatchStatusRequest(BaseModel):
    batch_id: str
    ack_task_ids: List[str] = []


# --- Event Parsers (Unchanged) ---
def parse_claude_events(raw_output: str, prompt: str) -> list:
    """Parse Claude JSON output into normalized events."""
    events = []
    tool_calls_by_id = {}
    events.append({"type": "prompt", "content": prompt})

    try:
        data = json.loads(raw_output)
        if not isinstance(data, list): data = [data]
        
        final_result = None
        for item in data:
            if isinstance(item, dict) and item.get("type") == "result":
                final_result = item.get("result", "")
                break

        for item in data:
            if not isinstance(item, dict): continue
            item_type = item.get("type")

            if item_type == "system" and item.get("subtype") == "init":
                events.append({"type": "system", "content": f"Session initialized (model: {item.get('model', 'unknown')})"})
            elif item_type == "assistant":
                message = item.get("message", {})
                content_list = message.get("content", [])
                for content in content_list:
                    if content.get("type") == "text":
                        text = content.get("text", "")
                        if text and text == final_result: continue
                        events.append({"type": "response", "content": text})
                    elif content.get("type") == "tool_use":
                        tool_id = content.get("id")
                        tool_event = {"type": "tool_call", "tool": content.get("name", "unknown"), "content": json.dumps(content.get("input", {}), indent=2)}
                        events.append(tool_event)
                        if tool_id: tool_calls_by_id[tool_id] = tool_event
            elif item_type == "user":
                message = item.get("message", {})
                content_list = message.get("content", [])
                for content in content_list:
                    if content.get("type") == "tool_result":
                        tool_use_id = content.get("tool_use_id")
                        result_content = content.get("content", "")
                        if len(result_content) > 500: result_content = result_content[:500] + "\n... (truncated)"
                        if tool_use_id and tool_use_id in tool_calls_by_id:
                            tool_calls_by_id[tool_use_id]["output"] = result_content
                        else:
                            events.append({"type": "tool_result", "content": result_content})
            elif item_type == "result":
                events.append({"type": "result", "subtype": item.get("subtype", "unknown"), "content": item.get("result", "")})
    except json.JSONDecodeError:
        events.append({"type": "error", "content": "Failed to parse output"})
    return events

def parse_codex_events(raw_output: str, prompt: str) -> list:
    """Parse Codex NDJSON output into normalized events."""
    events = []
    events.append({"type": "prompt", "content": prompt})

    for line in raw_output.splitlines():
        if not line.strip(): continue
        try:
            event = json.loads(line)
            event_type = event.get("type")
            if event_type == "thread.started":
                events.append({"type": "system", "content": f"Thread started: {event.get('thread_id', 'unknown')[:8]}..."})
            elif event_type == "item.completed":
                item = event.get("item", {})
                item_type = item.get("type")
                if item_type == "reasoning":
                    events.append({"type": "reasoning", "content": item.get("text", "")})
                elif item_type == "command_execution":
                    cmd = item.get("command", "")
                    output = item.get("aggregated_output", "")
                    if len(output) > 500: output = output[:500] + "\n... (truncated)"
                    events.append({"type": "tool_call", "tool": "bash", "content": cmd, "output": output, "exit_code": item.get("exit_code")})
                elif item_type == "agent_message":
                    events.append({"type": "response", "content": item.get("text", "")})
        except json.JSONDecodeError:
            continue
    return events


# --- Helper: Command Runner (Async for Single Calls) ---
async def run_cli_command(command, args, prompt_text=""):
    """Generic async wrapper for CLI calls.

    Returns tuple of (output, start_time) so caller can log with session_id.
    """
    full_cmd = [command] + args
    start_time = datetime.now()
    log_entry = {
        "id": int(start_time.timestamp() * 1000),
        "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "agent": command,
        "command": " ".join(full_cmd),
        "prompt": prompt_text,
        "status": "Running...",
        "response": "",
        "raw_output": ""
    }
    call_history.appendleft(log_entry)
    await broadcast_log_update(log_entry)

    try:
        env = os.environ.copy()
        env["CI"] = "true"
        process = subprocess.run(full_cmd, capture_output=True, text=True, encoding='utf-8', env=env)

        log_entry["raw_output"] = process.stdout + "\n" + process.stderr

        if process.returncode != 0:
            log_entry["status"] = "Error"
            log_entry["response"] = f"Exit Code {process.returncode}: {process.stderr}"
            await broadcast_log_update(log_entry)
            raise Exception(process.stderr)
        return process.stdout, start_time
    except Exception as e:
        log_entry["status"] = "Failed"
        log_entry["response"] = str(e)
        await broadcast_log_update(log_entry)
        raise e

# --- Helper: Command Runner (Synchronous for Batch Threads) ---
def run_agent_sync(task: BatchTask):
    """
    Synchronous version of agent execution to run in a background thread.
    Returns the final response string.
    """
    agent = task.agent
    prompt = task.instruction
    session_id = task.session_id
    is_new_session = session_id is None

    # Construct args
    if agent == "claude":
        args = ["--print", "--output-format=json", "--dangerously-skip-permissions", "--verbose"]
        if session_id: args.append(f"--resume={session_id}")
        args.append(prompt)
        cmd = "claude"
    else: # codex
        args = ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check"]
        if session_id:
            args.extend(["resume", session_id, prompt])
        else:
            args.append(prompt)
        cmd = "codex"

    # Setup Logging
    full_cmd = [cmd] + args
    start_time = datetime.now()
    log_entry = {
        "id": int(start_time.timestamp() * 1000) + (int(uuid.uuid4()) % 1000), # Ensure unique ID in threads
        "timestamp": start_time.strftime("%Y-%m-%d %H:%M:%S"),
        "agent": agent,
        "command": " ".join(full_cmd),
        "prompt": prompt,
        "status": "Running (Batch)...",
        "response": "",
        "raw_output": ""
    }

    # Append to history safely
    call_history.appendleft(log_entry)
    broadcast_log_update_sync(log_entry)

    final_status = "error"
    try:
        env = os.environ.copy()
        env["CI"] = "true"

        # BLOCKING CALL - Safe because we are in a thread
        process = subprocess.run(full_cmd, capture_output=True, text=True, encoding='utf-8', env=env)

        output = process.stdout
        log_entry["raw_output"] = output + "\n" + process.stderr

        final_text = ""
        sid = session_id
        events = []

        if process.returncode != 0:
            log_entry["status"] = "Error"
            log_entry["response"] = process.stderr
            final_text = f"Error: {process.stderr}"
        else:
            # Parse Output based on agent
            if agent == "claude":
                try:
                    data = json.loads(output)
                    result_item = next((item for item in (data if isinstance(data, list) else [data]) if isinstance(item, dict) and "result" in item), {})
                    final_text = result_item.get("result", "")
                    sid = result_item.get("session_id", "")
                    events = parse_claude_events(output, prompt)
                except:
                    final_text = output
            else: # codex
                full_text = []
                try:
                    for line in output.splitlines():
                        if not line.strip(): continue
                        event = json.loads(line)
                        if event.get("type") == "thread.started": sid = event.get("thread_id")
                        if event.get("type") == "item.completed":
                            item = event.get("item", {})
                            if item.get("type") == "agent_message": full_text.append(item.get("text", ""))
                    final_text = "".join(full_text)
                    events = parse_codex_events(output, prompt)
                except:
                    final_text = output

            log_entry["status"] = "Success"
            log_entry["response"] = final_text[:100] + "..."
            log_entry["events"] = events
            log_entry["session_id"] = str(sid) if sid else None
            final_status = "success"

            # Save log
            save_log_to_file(agent, str(sid), log_entry, is_new_session)

        broadcast_log_update_sync(log_entry)

        # Return format for the batch system
        return {
            "text": final_text,
            "session_id": sid,
            "error": None if process.returncode == 0 else process.stderr
        }

    except Exception as e:
        log_entry["status"] = "Failed"
        log_entry["response"] = str(e)
        broadcast_log_update_sync(log_entry)
        return {"text": "", "session_id": session_id, "error": str(e)}
    finally:
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        log_request_to_db(agent, prompt, final_status, duration_ms, str(sid) if sid else "")

def batch_worker(batch_id: str, task: BatchTask):
    """Worker function for threads."""
    result = run_agent_sync(task)
    
    with batch_lock:
        if batch_id in batches:
            batches[batch_id]["tasks"][task.id]["status"] = "completed"
            batches[batch_id]["tasks"][task.id]["result"] = result

# --- Routes ---

@app.post("/agent/claude")
async def call_claude(req: AgentRequest):
    args = ["--print", "--output-format=json", "--dangerously-skip-permissions", "--verbose"]
    if req.session_id: args.append(f"--resume={req.session_id}")
    args.append(req.prompt)
    output, start_time = await run_cli_command("claude", args, req.prompt)

    sid = ""
    final_status = "error"
    try:
        data = json.loads(output)
        result_item = next((item for item in (data if isinstance(data, list) else [data]) if isinstance(item, dict) and "result" in item), {})
        text = result_item.get("result", "")
        sid = result_item.get("session_id", "")
        events = parse_claude_events(output, req.prompt)

        call_history[0]["status"] = "Success"
        call_history[0]["response"] = text[:100] + "..."
        call_history[0]["events"] = events
        call_history[0]["session_id"] = sid
        save_log_to_file("claude", sid, call_history[0], req.session_id is None)
        await broadcast_log_update(call_history[0])
        #save_log_to_file("claude", sid, call_history[0], req.session_id is None)
        final_status = "success"
        return {"text": text, "session_id": sid}
    except Exception as e:
        return {"error": str(e), "raw": output}
    finally:
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        log_request_to_db("claude", req.prompt, final_status, duration_ms, sid)

@app.post("/agent/codex")
async def call_codex(req: AgentRequest):
    args = ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check"]
    if req.session_id: args.extend(["resume", req.session_id, req.prompt])
    else: args.append(req.prompt)
    output, start_time = await run_cli_command("codex", args, req.prompt)

    sid = None
    final_status = "error"
    try:
        full_text = []
        for line in output.splitlines():
            if not line.strip(): continue
            ev = json.loads(line)
            if ev.get("type") == "thread.started": sid = ev.get("thread_id")
            if ev.get("type") == "item.completed" and ev.get("item", {}).get("type") == "agent_message":
                full_text.append(ev.get("item", {}).get("text", ""))

        final_response = "".join(full_text)
        events = parse_codex_events(output, req.prompt)
        call_history[0]["status"] = "Success"
        call_history[0]["response"] = final_response[:100] + "..."
        call_history[0]["events"] = events
        call_history[0]["session_id"] = str(sid) if sid else None
        save_log_to_file("codex", str(sid), call_history[0], req.session_id is None)
        await broadcast_log_update(call_history[0])
        #save_log_to_file("codex", str(sid), call_history[0], req.session_id is None)
        final_status = "success"
        return {"text": final_response, "session_id": sid}
    except Exception as e:
        return {"error": str(e), "raw": output}
    finally:
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        log_request_to_db("codex", req.prompt, final_status, duration_ms, str(sid) if sid else "")

# --- BATCH ENDPOINTS ---

@app.post("/batch/submit")
async def submit_batch(req: BatchSubmitRequest):
    batch_id = str(uuid.uuid4())
    
    with batch_lock:
        batches[batch_id] = {
            "tasks": {t.id: {"status": "pending", "result": None, "fetched": False} for t in req.tasks}
        }
    
    # Launch threads
    for task in req.tasks:
        t = threading.Thread(target=batch_worker, args=(batch_id, task))
        t.daemon = True
        t.start()
        
    return {"batch_id": batch_id, "message": f"Started {len(req.tasks)} tasks."}

@app.post("/batch/status")
async def check_batch_status(req: BatchStatusRequest):
    batch_id = req.batch_id
    if batch_id not in batches:
        return {"error": "Batch not found"}
    
    ack_ids = set(req.ack_task_ids)
    updates = []
    batch_completed = True
    
    with batch_lock:
        tasks = batches[batch_id]["tasks"]
        
        # 1. Process ACKs (Mark as fetched)
        for tid in ack_ids:
            if tid in tasks:
                tasks[tid]["fetched"] = True
        
        # 2. Collect New Results
        for tid, data in tasks.items():
            if data["status"] == "pending":
                batch_completed = False
            
            # Return result if it's done AND (not fetched OR it's un-ACKed from before)
            # The 'fetched' flag acts as our "ACK received" state.
            if data["status"] == "completed" and not data["fetched"]:
                updates.append({
                    "task_id": tid,
                    "result": data["result"]
                })

    return {
        "batch_id": batch_id,
        "status": "completed" if batch_completed else "processing",
        "new_results": updates
    }

# --- UI Endpoints (Session Management) ---

@app.get("/api/sessions/{agent}")
async def get_sessions(agent: str):
    # (Same as your original code)
    if agent not in ["claude", "codex"]: return {"error": "Invalid agent"}
    agent_path = LOGS_DIR / agent
    if not agent_path.exists(): return {"sessions": []}
    sessions = []
    for log_file in agent_path.glob("*.json"):
        try:
            data = json.loads(log_file.read_text())
            logs = data.get("logs", [])
            last_log = logs[-1] if logs else {}
            sessions.append({
                "session_id": data.get("session_id"),
                "created_at": data.get("created_at"),
                "last_activity": last_log.get("timestamp", data.get("created_at")),
                "log_count": len(logs),
                "last_id": last_log.get("id", 0)
            })
        except: continue
    # Sort by created_at timestamp (descending - newest first)
    # Format: %Y-%m-%d %H:%M:%S (or fallback to %H:%M:%S for legacy logs)
    def parse_timestamp(ts: str) -> datetime:
        if not ts:
            return datetime.min
        try:
            return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                # Fallback for legacy time-only format
                return datetime.strptime(ts, "%H:%M:%S")
            except ValueError:
                return datetime.min

    sessions.sort(key=lambda x: parse_timestamp(x.get("created_at", "")), reverse=True)
    return {"sessions": sessions}

@app.get("/api/sessions/{agent}/{session_id}")
async def get_session_logs(agent: str, session_id: str):
    # (Same as your original code)
    if agent not in ["claude", "codex"]: return {"error": "Invalid agent"}
    log_file = LOGS_DIR / agent / f"{session_id}.json"
    if not log_file.exists(): return {"error": "Session not found"}
    try:
        data = json.loads(log_file.read_text())
        for log in data.get("logs", []):
            if "events" not in log and "raw_output" in log:
                prompt = log.get("prompt", "")
                raw = log.get("raw_output", "")
                log["events"] = parse_claude_events(raw, prompt) if agent == "claude" else parse_codex_events(raw, prompt)
        return data
    except: return {"error": "Parse failed"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    print(f"[WS] Client connected. Total clients: {len(connected_clients)}")
    try:
        for log in call_history:
            await websocket.send_text(json.dumps({"type": "log_update", "log": log}))
        print(f"[WS] Sent {len(call_history)} initial logs to client")
        while True: 
            await websocket.receive_text()
    except (WebSocketDisconnect, RuntimeError) as e:
        print(f"[WS] Client disconnected: {type(e).__name__}")
    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        connected_clients.discard(websocket)
        print(f"[WS] Client removed. Total clients: {len(connected_clients)}")