from datetime import datetime
import uuid
from fastapi import HTTPException
from app.models.responses import AgentResponse, LogEntry
from app.services.agent_runner import AgentRunner
from app.services.log_storage import LogStorageService
from app.services.db_service import DBService
from app.services.parsers import parse_codex_events
from app.services.websocket_manager import WebSocketManager
from app.core.state import AppState
from app.core.logging import get_logger

logger = get_logger(__name__)

async def run_codex_agent(
    request,
    agent_runner: AgentRunner,
    log_storage: LogStorageService,
    websocket_manager: WebSocketManager,
    app_state: AppState,
    db_service: DBService
) -> AgentResponse:
    # Get current session ID
    session_id = await app_state.get_current_session_id()
    if session_id is None:
        logger.error("No active session found")
        raise HTTPException(status_code=500, detail="No active session found. Please create or select a session first.")

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
        conversation_id=request.conversation_id,
        session_id=session_id
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
            "final_response": response_text,
            "session_id": session_id
        })
        
        if exit_code != 0 and stderr:
             final_log.details = stderr
        
        # Update state
        await app_state.update_call_by_id(log_id, final_log.model_dump())
        
        # Save to file and db
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        await log_storage.save_log_to_file("codex", str(conversation_id), final_log.model_dump(), is_new_conversation)
        await log_storage.log_to_database("codex", request.prompt, final_log.status, duration_ms, str(conversation_id), session_id, db_service)
        await log_storage.update_conversation_response(str(conversation_id), response_text, status, db_service)
        
        # Broadcast final
        await websocket_manager.broadcast_log_update(final_log.model_dump())

        return AgentResponse(
            text=response_text,
            conversation_id=conversation_id
        )
        
    except Exception as e:
        logger.error(f"Error running codex agent: {e}")
        error_log = initial_log.model_copy(update={"session_id": session_id})
        error_log.status = "Error"
        error_log.details = str(e)
        
        # Ensure we have a conversation ID for the error record
        if not conversation_id:
            conversation_id = str(uuid.uuid4())

        # Log to database even on error
        await log_storage.log_to_database("codex", request.prompt, "Error", 0, str(conversation_id), session_id, db_service)
        await log_storage.update_conversation_response(str(conversation_id), str(e), "Error", db_service)

        await app_state.update_call_by_id(log_id, error_log.model_dump())
        await websocket_manager.broadcast_log_update(error_log.model_dump())
        
        return AgentResponse(
            text="",
            conversation_id=conversation_id,
            error=str(e)
        )
