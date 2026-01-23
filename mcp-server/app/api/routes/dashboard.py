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
    sessions = await log_storage.list_sessions(agent)
    return sessions

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

    # Extract session metadata
    session_id_value = str(session_data.get("session_id") or session_id)
    # Source agent: 1. data field, 2. passed agent, 3. fallback to claude but usually data has it
    agent_value = str(session_data.get("agent") or agent or "claude")
    created_at_value = str(session_data.get("created_at") or "")

    # Extract events from logs
    events = []
    logs = session_data.get("logs", [])
    if isinstance(logs, list):
        for log in logs:
            if isinstance(log, dict) and "events" in log:
                events.extend(log["events"])

    # Extract prompt and status from logs for the summary
    prompt_value = ""
    status_value = "completed"
    if logs and isinstance(logs, list):
        first_log = logs[0]
        last_log = logs[-1]
        
        # Use 'task' field
        prompt_value = first_log.get("task") or ""
        
        # Derive status from the most recent log
        log_status = str(last_log.get("status", "completed")).lower()
        if "error" in log_status or "failed" in log_status:
            status_value = "error"
        elif "running" in log_status:
            status_value = "active"
        
    # Post-process events for UI compatibility
    processed_events = []
    for i, event in enumerate(events):
        if not isinstance(event, dict): 
            continue
            
        new_event = event.copy()
        
        # Ensure type is present
        e_type = str(new_event.get("type", "response")).lower()
        
        # Normalization
        if e_type == "reasoning":
            new_event["type"] = "thinking"
        elif e_type == "thinking":
            new_event["type"] = "thinking"
        elif e_type == "result":
            new_event["type"] = "result"
            
        # Support for 'role' based result (backward compatibility)
        if i == len(events) - 1 and new_event.get("role") == "assistant" and new_event.get("type") != "thinking":
            new_event["type"] = "result"
            
        # Ensure session_id and thread_id
        if "session_id" not in new_event:
             new_event["session_id"] = session_id_value
             
        # Also ensure content is a string
        if "content" not in new_event:
            new_event["content"] = str(new_event.get("text") or "")

        processed_events.append(new_event)
            
    return SessionDetail(
        id=session_id_value,
        agent=agent_value,
        created_at=created_at_value,
        status=status_value,
        prompt=prompt_value,
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

