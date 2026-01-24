from fastapi import Request, Depends
from sqlmodel import Session
from app.db.database import get_session
from app.services.agent_runner import AgentRunner
from app.services.log_storage import LogStorageService
from app.services.websocket_manager import WebSocketManager
from app.services.batch_manager import BatchManager
from app.services.db_service import DBService

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

def get_db(session: Session = Depends(get_session)):
    """Dependency to get a database session."""
    yield session

def get_db_service(session: Session = Depends(get_db)) -> DBService:
    """Dependency to get a database service instance."""
    return DBService(session)
