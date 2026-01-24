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
    # Check if new conversation before any assignment
    is_new_conversation = request.conversation_id is None
    conversation_id = request.conversation_id
    
    # Create initial log entry
    initial_log = LogEntry(
        id=log_id,
        timestamp=datetime.now().isoformat(),
        status="Running...",
        agent="claude",
        task=request.prompt,
        details="Agent starting...",
        events=[],
        conversation_id=request.conversation_id
    )
    
    # Add to state and broadcast
    await app_state.add_call_history(initial_log.model_dump())
    await websocket_manager.broadcast_log_update(initial_log.model_dump())
    
    try:
        # Run agent
        args = ["--print", "--output-format=json", "--dangerously-skip-permissions", "--verbose"]
        if request.conversation_id:
            args.append(f"--resume={request.conversation_id}")
        args.append(request.prompt)

        stdout, stderr, exit_code = await agent_runner.run_agent(
            "claude", 
            args, 
            request.pwd
        )
        
        # Parse output
        events, extracted_conversation_id = parse_claude_events(stdout, request.prompt)
        
        # Determine status
        status = "Completed" if exit_code == 0 else "Failed"
        if exit_code != 0 and not events:
            # If failed and no events, add stderr as detail
            initial_log.details = stderr or "Unknown error"
            
        # Determine final conversation_id
        if not conversation_id and extracted_conversation_id:
             conversation_id = extracted_conversation_id
        elif not conversation_id:
             conversation_id = str(uuid.uuid4())

        # Extract response text
        response_text = ""
        for event in reversed(events):
            if event.get("type") == "result":
                response_text = event.get("content", "")
                break

        # Update log entry
        final_log = initial_log.model_copy(update={
            "status": status,
            "events": events,
            "conversation_id": conversation_id,
            "final_response": response_text
        })
        
        # Update state
        await app_state.update_call_by_id(log_id, final_log.model_dump())
        
        # Save to file and db
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        await log_storage.save_log_to_file("claude", str(conversation_id), final_log.model_dump(), is_new_conversation)
        await log_storage.log_to_database("claude", request.prompt, final_log.status, duration_ms, str(conversation_id))
        
        # Broadcast final
        await websocket_manager.broadcast_log_update(final_log.model_dump())
        
        return AgentResponse(
            text=response_text,
            conversation_id=conversation_id
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
            conversation_id=request.conversation_id,
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
    is_new_conversation = request.conversation_id is None
    conversation_id = request.conversation_id
    
    # Create initial log entry
    initial_log = LogEntry(
        id=log_id,
        timestamp=datetime.now().isoformat(),
        status="Running...",
        agent="codex",
        task=request.prompt,
        details="Agent starting...",
        events=[],
        conversation_id=request.conversation_id
    )
    
    # Add to state and broadcast
    await app_state.add_call_history(initial_log.model_dump())
    await websocket_manager.broadcast_log_update(initial_log.model_dump())
    
    try:
        # Run agent
        args = ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check"]
        if request.conversation_id:
             args.extend(["resume", request.conversation_id, request.prompt])
        else:
             args.append(request.prompt)

        stdout, stderr, exit_code = await agent_runner.run_agent(
            "codex", 
            args, 
            request.pwd
        )
        
        # Parse output
        events, extracted_conversation_id = parse_codex_events(stdout, request.prompt)
        
        # Determine status
        status = "Completed" if exit_code == 0 else "Failed"
        
        # Update conversation_id if found
        if not conversation_id and extracted_conversation_id:
             conversation_id = extracted_conversation_id
        elif not conversation_id:
             conversation_id = str(uuid.uuid4())

        # Extract response text
        full_text = []
        for event in events:
             if event.get("type") in ["response", "result"]:
                  full_text.append(event.get("content", ""))
        
        response_text = "".join(full_text)

        # Update log entry
        final_log = initial_log.model_copy(update={
            "status": status,
            "events": events,
            "conversation_id": conversation_id,
            "final_response": response_text
        })
        
        if exit_code != 0 and stderr:
             final_log.details = stderr
        
        # Update state
        await app_state.update_call_by_id(log_id, final_log.model_dump())
        
        # Save to file and db
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        await log_storage.save_log_to_file("codex", str(conversation_id), final_log.model_dump(), is_new_conversation)
        await log_storage.log_to_database("codex", request.prompt, final_log.status, duration_ms, str(conversation_id))
        
        # Broadcast final
        await websocket_manager.broadcast_log_update(final_log.model_dump())

        return AgentResponse(
            text=response_text,
            conversation_id=conversation_id
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
            conversation_id=request.conversation_id,
            error=str(e)
        )
