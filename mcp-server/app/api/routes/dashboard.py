from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.deps import get_log_storage, get_app_state
from app.models.responses import LogEntry, SessionSummary, SessionDetail
from app.services.log_storage import LogStorageService
from app.core.state import AppState

router = APIRouter()

@router.get("/api/logs", response_model=List[LogEntry])
async def get_logs(app_state: AppState = Depends(get_app_state)):
    history = await app_state.get_call_history()
    processed_history = []
    for entry in history:
        if isinstance(entry, dict):
            # Map legacy fields to new model fields
            if "prompt" in entry and "task" not in entry:
                entry["task"] = entry["prompt"]
            if "response" in entry and "final_response" not in entry:
                entry["final_response"] = entry["response"]
                
    # Ensure compatibility with LogEntry model
    return [LogEntry(**entry) if isinstance(entry, dict) else entry for entry in history]

@router.get("/api/stats")
async def get_stats(app_state: AppState = Depends(get_app_state)):
    history = await app_state.get_call_history()
    
    claude_tasks = sum(1 for entry in history if entry.get("agent") == "claude")
    codex_tasks = sum(1 for entry in history if entry.get("agent") == "codex")
    
    # Placeholder for average latency if not tracked
    avg_latency = 1500 
    
    return {
        "claudeTasks": claude_tasks,
        "codexTasks": codex_tasks,
        "avgLatency": avg_latency
    }

@router.get("/api/sessions", response_model=List[SessionSummary])
async def list_sessions(
    agent: str = Query("all", description="Filter by agent"),
    log_storage: LogStorageService = Depends(get_log_storage)
):
    # log_storage.list_sessions likely returns list of dicts
    sessions = await log_storage.list_sessions(agent)
    # Sort by created_at descending
    sessions.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    
    return [
        SessionSummary(
            session_id=s.get("id"),
            created_at=datetime.fromisoformat(s.get("created_at")).timestamp() if s.get("created_at") else 0.0,
            preview=s.get("response", "")[:100] + "..." if s.get("response") else "",
            event_count=0 
        )
        for s in sessions
    ]

async def _get_session_detail(session_id: str, log_storage: LogStorageService, agent: Optional[str] = None) -> SessionDetail:
    session_data = None
    if agent:
         session_data = await log_storage.get_session_logs(agent, session_id)
    else:
        # Try finding in both if agent not specified
        session_data = await log_storage.get_session_logs("claude", session_id)
        if not session_data:
            session_data = await log_storage.get_session_logs("codex", session_id)
        
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Extract events from logs
    events = []
    if "logs" in session_data:
        for log in session_data["logs"]:
            if "events" in log:
                events.extend(log["events"])
        
    # Post-process events
    processed_events = []
    for i, event in enumerate(events):
        new_event = event.copy()
        
        # Display styling
        if new_event.get("type") == "reasoning":
            new_event["type"] = "thinking"
            
        # Mark last response as result
        if i == len(events) - 1 and new_event.get("role") == "assistant":
            new_event["type"] = "result"
            
        # Fix truncated thread IDs
        if new_event.get("type") == "system" and "thread_id" in new_event:
             # Check if thread_id is truncated or different, normalize to session_id if needed
             new_event["thread_id"] = session_id
             
        # Also ensure session_id is available if missing
        if "session_id" not in new_event:
             new_event["session_id"] = session_id

        processed_events.append(new_event)
            
    return SessionDetail(
        session_id=session_id,
        events=processed_events
    )

@router.get("/api/sessions/{session_id}", response_model=SessionDetail)
async def get_session_detail(
    session_id: str,
    log_storage: LogStorageService = Depends(get_log_storage)
):
    return await _get_session_detail(session_id, log_storage)

@router.get("/api/sessions/{agent}/{session_id}", response_model=SessionDetail)
async def get_session_detail_legacy(
    agent: str,
    session_id: str,
    log_storage: LogStorageService = Depends(get_log_storage)
):
    return await _get_session_detail(session_id, log_storage, agent)

