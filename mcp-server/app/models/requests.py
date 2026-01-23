from typing import List, Optional
from pydantic import BaseModel

class AgentRequest(BaseModel):
    prompt: str
    pwd: str
    session_id: Optional[str] = None

class BatchTask(BaseModel):
    id: str
    agent: str
    instruction: str
    session_id: Optional[str] = None

class BatchSubmitRequest(BaseModel):
    tasks: List[BatchTask]
    pwd: str

class BatchStatusRequest(BaseModel):
    batch_id: str
    ack_task_ids: List[str] = []
