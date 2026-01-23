from fastapi import Request
from app.services.agent_runner import AgentRunner
from app.services.log_storage import LogStorageService
from app.services.websocket_manager import WebSocketManager
from app.services.batch_manager import BatchManager

def get_agent_runner(request: Request) -> AgentRunner:
    return request.app.state.agent_runner

def get_log_storage(request: Request) -> LogStorageService:
    return request.app.state.log_storage

def get_websocket_manager(request: Request) -> WebSocketManager:
    return request.app.state.websocket_manager

def get_batch_manager(request: Request) -> BatchManager:
    return request.app.state.batch_manager

def get_app_state(request: Request):
    return request.app.state.app_state
