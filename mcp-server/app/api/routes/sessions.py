import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_db_service, get_app_state
from app.core.logging import get_logger
from app.models.work_session import WorkSession
from app.models.requests import CreateSessionRequest, UpdateSessionRequest
from app.models.responses import SessionListResponse
from app.services.db_service import DBService

logger = get_logger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

@router.get("", response_model=SessionListResponse)
async def list_sessions(db_service: DBService = Depends(get_db_service)):
    """List all work sessions."""
    try:
        sessions = db_service.list_sessions()
        return SessionListResponse(sessions=sessions)
    except Exception as e:
        logger.error("Failed to list sessions", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")

@router.get("/current", response_model=WorkSession)
async def get_current_session(db_service: DBService = Depends(get_db_service)):
    """Get the currently active work session."""
    try:
        session = db_service.get_current_session()
        if not session:
            raise HTTPException(status_code=404, detail="No active session found")
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get current session", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get current session: {str(e)}")

@router.post("", response_model=WorkSession)
async def create_session(
    request: CreateSessionRequest,
    db_service: DBService = Depends(get_db_service)
):
    """Create a new work session."""
    try:
        session_id = uuid.uuid4().hex[:8]
        
        # Default agents if not provided
        agents = request.agents if request.agents else [
            {"name": "Claude", "color": "blue"},
            {"name": "Codex", "color": "green"}
        ]
        
        # Convert agents to list of dicts if they are pydantic models
        if agents and not isinstance(agents[0], dict):
            agents = [a.model_dump() for a in agents]

        session_data = {
            "session_id": session_id,
            "title": request.title,
            "status": "active",
            "root_directory": request.root_directory or str(Path.cwd()),
            "agents": agents,
            "total_tokens": "0",
            "last_active": datetime.utcnow().isoformat(),
            "is_current_session": False
        }
        
        new_session = db_service.create_session(session_data)
        return new_session
    except Exception as e:
        logger.error("Failed to create session", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@router.put("/{session_id}/activate", response_model=WorkSession)
async def activate_session(
    session_id: str,
    db_service: DBService = Depends(get_db_service),
    app_state=Depends(get_app_state)
):
    """Set a session as the current active session."""
    try:
        updated_session = db_service.set_current_session(session_id)
        # Update app state
        await app_state.set_current_session_id(session_id)
        return updated_session
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to activate session", error=str(e), session_id=session_id)
        raise HTTPException(status_code=500, detail=f"Failed to activate session: {str(e)}")

@router.put("/{session_id}", response_model=WorkSession)
async def update_session(
    session_id: str,
    request: UpdateSessionRequest,
    db_service: DBService = Depends(get_db_service)
):
    """Update session details."""
    try:
        updates = request.model_dump(exclude_unset=True)
        
        if "agents" in updates and updates["agents"]:
            updates["agents"] = [a.model_dump() if not isinstance(a, dict) else a for a in updates["agents"]]
            
        updated_session = db_service.update_session(session_id, updates)
        if not updated_session:
            raise HTTPException(status_code=404, detail="Session not found")
        return updated_session
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update session", error=str(e), session_id=session_id)
        raise HTTPException(status_code=500, detail=f"Failed to update session: {str(e)}")
