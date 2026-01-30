from fastapi import APIRouter, Depends
from app.api.deps import get_agent_runner, get_log_storage, get_websocket_manager, get_app_state, get_db_service
from app.models.requests import AgentRequest
from app.models.responses import AgentResponse
from app.services.agent_runner import AgentRunner
from app.services.log_storage import LogStorageService
from app.services.db_service import DBService
from app.services.websocket_manager import WebSocketManager
from app.core.state import AppState
from app.services.agents.claude import run_claude_agent
from app.services.agents.codex import run_codex_agent

router = APIRouter()

@router.post("/agent/claude", response_model=AgentResponse)
async def run_claude(
    request: AgentRequest,
    agent_runner: AgentRunner = Depends(get_agent_runner),
    log_storage: LogStorageService = Depends(get_log_storage),
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    app_state: AppState = Depends(get_app_state),
    db_service: DBService = Depends(get_db_service)
):
    return await run_claude_agent(
        request,
        agent_runner,
        log_storage,
        websocket_manager,
        app_state,
        db_service
    )

@router.post("/agent/codex", response_model=AgentResponse)
async def run_codex(
    request: AgentRequest,
    agent_runner: AgentRunner = Depends(get_agent_runner),
    log_storage: LogStorageService = Depends(get_log_storage),
    websocket_manager: WebSocketManager = Depends(get_websocket_manager),
    app_state: AppState = Depends(get_app_state),
    db_service: DBService = Depends(get_db_service)
):
    return await run_codex_agent(
        request,
        agent_runner,
        log_storage,
        websocket_manager,
        app_state,
        db_service
    )
