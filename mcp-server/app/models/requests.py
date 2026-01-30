from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.work_session import WorkSessionAgent

class AgentRequest(BaseModel):
    prompt: str
    pwd: str
    conversation_id: Optional[str] = None

class BatchTask(BaseModel):
    id: str
    agent: str
    instruction: str
    conversation_id: Optional[str] = None

class BatchSubmitRequest(BaseModel):
    tasks: List[BatchTask]
    pwd: str

class BatchStatusRequest(BaseModel):
    batch_id: str
    ack_task_ids: List[str] = []

class CreateSessionRequest(BaseModel):
    title: str
    root_directory: Optional[str] = None
    agents: Optional[List[WorkSessionAgent]] = None

class UpdateSessionRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    root_directory: Optional[str] = None
    agents: Optional[List[WorkSessionAgent]] = None
    total_tokens: Optional[str] = None

class ClientLogEntry(BaseModel):
    session_id: Optional[str] = None
    level: str = "info"
    source: str
    message: str
    data: Optional[dict] = None
    timestamp: Optional[str] = None
