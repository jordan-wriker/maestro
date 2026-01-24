from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.deps import get_log_storage, get_app_state, get_db_service
from app.models.responses import LogEntry, ConversationSummary, ConversationDetail
from app.services.log_storage import LogStorageService
from app.services.db_service import DBService
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

@router.get("/api/conversations", response_model=List[ConversationSummary])
async def list_conversations(
    agent: str = Query("all", description="Filter by agent"),
    log_storage: LogStorageService = Depends(get_log_storage),
    app_state: AppState = Depends(get_app_state),
    db_service: DBService = Depends(get_db_service)
):
    session_id = await app_state.get_current_session_id()
    conversations = await log_storage.list_conversations(agent, session_id=session_id, db_service=db_service)
    return conversations

async def _get_conversation_detail(conversation_id: str, log_storage: LogStorageService, agent: Optional[str] = None) -> ConversationDetail:
    conversation_data = None
    if agent:
         conversation_data = await log_storage.get_conversation_logs(agent, conversation_id)
    else:
        # Try finding in both if agent not specified
        conversation_data = await log_storage.get_conversation_logs("claude", conversation_id)
        if not conversation_data:
            conversation_data = await log_storage.get_conversation_logs("codex", conversation_id)
        
    if not conversation_data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Extract conversation conversation
    conversation_id_value = str(conversation_data.get("conversation_id") or conversation_id)
    # Source agent: 1. data field, 2. passed agent, 3. fallback to claude but usually data has it
    agent_value = str(conversation_data.get("agent") or agent or "claude")
    created_at_value = str(conversation_data.get("created_at") or "")

    # Extract events from logs
    events = []
    logs = conversation_data.get("logs", [])
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
            
        # Ensure conversation_id and thread_id
        if "conversation_id" not in new_event:
             new_event["conversation_id"] = conversation_id_value
             
        # Also ensure content is a string
        if "content" not in new_event:
            new_event["content"] = str(new_event.get("text") or "")

        processed_events.append(new_event)
            
    return ConversationDetail(
        conversation_id=conversation_id_value,
        agent=agent_value,
        created_at=created_at_value,
        status=status_value,
        prompt=prompt_value,
        events=processed_events
    )

@router.get("/api/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation_detail(
    conversation_id: str,
    log_storage: LogStorageService = Depends(get_log_storage)
):
    return await _get_conversation_detail(conversation_id, log_storage)

@router.get("/api/conversations/{agent}/{conversation_id}", response_model=ConversationDetail)
async def get_conversation_detail_legacy(
    agent: str,
    conversation_id: str,
    log_storage: LogStorageService = Depends(get_log_storage)
):
    return await _get_conversation_detail(conversation_id, log_storage, agent)

