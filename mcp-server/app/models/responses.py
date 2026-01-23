from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class AgentResponse(BaseModel):
    text: str
    session_id: Optional[str]
    error: Optional[str] = None

class BatchSubmitResponse(BaseModel):
    batch_id: str
    message: str

class BatchStatusResponse(BaseModel):
    batch_id: str
    status: str
    new_results: List[Dict[str, Any]]

class LogEntry(BaseModel):
    id: int
    timestamp: str
    status: str
    agent: str
    task: str
    details: Optional[str] = None
    events: Optional[List[Dict[str, Any]]] = None
    final_response: Optional[str] = None
    session_id: Optional[str] = None

class SessionSummary(BaseModel):
    session_id: str
    created_at: float
    preview: str
    event_count: int

class SessionDetail(BaseModel):
    session_id: str
    events: List[Dict[str, Any]]
