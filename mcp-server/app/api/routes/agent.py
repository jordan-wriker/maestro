from datetime import datetime
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from app.api.deps import get_agent_runner, get_log_storage, get_websocket_manager, get_app_state
from app.models.requests import AgentRequest
from app.models.responses import AgentResponse, LogEntry
from app.services.agent_runner import AgentRunner
from app.services.log_storage import LogStorageService
from app.services.parsers import parse_claude_events, parse_codex_events
from app.services.websocket_manager import WebSocketManager
from app.core.state import AppState
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.post("/agent/claude", response_model=AgentResponse)
async def run_claude(
    request: AgentRequest,
    agent_runner: AgentRunner = Depends(get_agent_runner),
    log_storage: LogStorageService = Depends(get_log_storage),
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    app_state: AppState = Depends(get_app_state)
):
    # Critical: Generate unique log ID before async operations
    log_id = int(datetime.now().timestamp() * 1000) + (int(uuid.uuid4()) % 1000)
    start_time = datetime.now()
    # Check if new session before any assignment
    is_new_session = request.session_id is None
    session_id = request.session_id
    
    # Create initial log entry
    initial_log = LogEntry(
        id=log_id,
        timestamp=datetime.now().isoformat(),
        status="Running...",
        agent="claude",
        task=request.prompt,
        details="Agent starting...",
        events=[],
        session_id=request.session_id
    )
    
    # Add to state and broadcast
    await app_state.add_call_history(initial_log.model_dump())
    await websocket_manager.broadcast_log_update(initial_log.model_dump())
    
    try:
        # Run agent
        args = ["--print", "--output-format=json", "--dangerously-skip-permissions", "--verbose"]
        if request.session_id:
            args.append(f"--resume={request.session_id}")
        args.append(request.prompt)

        stdout, stderr, exit_code = await agent_runner.run_agent(
            "claude", 
            args, 
            request.pwd
        )
        
        # Parse output
        events, extracted_session_id = parse_claude_events(stdout, request.prompt)
        
        # Determine status
        status = "Completed" if exit_code == 0 else "Failed"
        if exit_code != 0 and not events:
            # If failed and no events, add stderr as detail
            initial_log.details = stderr or "Unknown error"
            
        # Update log entry
        final_log = initial_log.model_copy()
        final_log.status = status
        final_log.events = events
        
        # Determine final session_id
        if not session_id and extracted_session_id:
             session_id = extracted_session_id
             final_log.session_id = session_id
        elif not session_id:
             # Fallback if still no session_id found (rare)
             session_id = str(uuid.uuid4())
             final_log.session_id = session_id
        
        response_text = ""
        # Find last result
        for event in reversed(events):
            if event.get("type") == "result":
                response_text = event.get("content", "")
                break
        
        # Update state
        await app_state.update_call_by_id(log_id, final_log.model_dump())
        
        # Save to file and db
        # Save to file and db
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        await log_storage.save_log_to_file("claude", str(session_id), final_log.model_dump(), is_new_session)
        await log_storage.log_to_database("claude", request.prompt, final_log.status, duration_ms, str(session_id))
        
        # Broadcast final
        await websocket_manager.broadcast_log_update(final_log.model_dump())
        
        return AgentResponse(
            text=response_text,
            session_id=session_id
        )
        
    except Exception as e:
        logger.error(f"Error running claude agent: {e}")
        # Update log to error
        error_log = initial_log.model_copy()
        error_log.status = "Error"
        error_log.details = str(e)
        
        await app_state.update_call_by_id(log_id, error_log.model_dump())
        await websocket_manager.broadcast_log_update(error_log.model_dump())
        
        return AgentResponse(
            text="",
            session_id=request.session_id,
            error=str(e)
        )

@router.post("/agent/codex", response_model=AgentResponse)
async def run_codex(
    request: AgentRequest,
    agent_runner: AgentRunner = Depends(get_agent_runner),
    log_storage: LogStorageService = Depends(get_log_storage),
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    app_state: AppState = Depends(get_app_state)
):
    # Critical: Generate unique log ID before async operations
    log_id = int(datetime.now().timestamp() * 1000) + (int(uuid.uuid4()) % 1000)
    start_time = datetime.now()
    is_new_session = request.session_id is None
    session_id = request.session_id
    
    # Create initial log entry
    initial_log = LogEntry(
        id=log_id,
        timestamp=datetime.now().isoformat(),
        status="Running...",
        agent="codex",
        task=request.prompt,
        details="Agent starting...",
        events=[],
        session_id=request.session_id
    )
    
    # Add to state and broadcast
    await app_state.add_call_history(initial_log.model_dump())
    await websocket_manager.broadcast_log_update(initial_log.model_dump())
    
    try:
        # Run agent
        args = ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check"]
        if request.session_id:
             args.extend(["resume", request.session_id, request.prompt])
        else:
             args.append(request.prompt)

        stdout, stderr, exit_code = await agent_runner.run_agent(
            "codex", 
            args, 
            request.pwd
        )
        
        # Parse output
        events, extracted_session_id = parse_codex_events(stdout, request.prompt)
        
        # Determine status
        status = "Completed" if exit_code == 0 else "Failed"
        
        # Update log entry
        final_log = initial_log.model_copy()
        final_log.status = status
        final_log.events = events
        
        if exit_code != 0 and stderr:
             final_log.details = stderr
        
        # Extract session_id and response text from NDJSON
        # Extract response text
        full_text = []
        for event in events:
             if event.get("type") == "response":
                  full_text.append(event.get("content", ""))
        
        response_text = "".join(full_text)
        
        # Update session_id
        if not session_id and extracted_session_id:
             session_id = extracted_session_id
             final_log.session_id = session_id
        elif not session_id:
             session_id = str(uuid.uuid4())
             final_log.session_id = session_id
        
        # Update state
        await app_state.update_call_by_id(log_id, final_log.model_dump())
        
        # Save to file and db
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        await log_storage.save_log_to_file("codex", str(session_id), final_log.model_dump(), is_new_session)
        await log_storage.log_to_database("codex", request.prompt, final_log.status, duration_ms, str(session_id))
        
        # Broadcast final
        await websocket_manager.broadcast_log_update(final_log.model_dump())

        return AgentResponse(
            text=response_text,
            session_id=session_id
        )
        
    except Exception as e:
        logger.error(f"Error running codex agent: {e}")
        error_log = initial_log.model_copy()
        error_log.status = "Error"
        error_log.details = str(e)
        
        await app_state.update_call_by_id(log_id, error_log.model_dump())
        await websocket_manager.broadcast_log_update(error_log.model_dump())
        
        return AgentResponse(
            text="",
            session_id=request.session_id,
            error=str(e)
        )
