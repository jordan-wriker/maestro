from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class AgentResponse(BaseModel):
    text: str
    conversation_id: Optional[str]
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
    conversation_id: Optional[str] = None

class ConversationSummary(BaseModel):
    conversation_id: str
    agent: str  # "claude" or "codex"
    created_at: str  # ISO format string
    status: str  # "completed", "error", or "active"
    prompt: str
    response: str
    last_activity: Optional[str] = None  # ISO format string

class ConversationDetail(BaseModel):
    conversation_id: str
    agent: str  # "claude" or "codex"
    created_at: str  # ISO format string
    status: str  # "completed", "error", or "active"
    prompt: str
    events: List[Dict[str, Any]]
