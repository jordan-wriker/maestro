from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class WorkSessionAgent(BaseModel):
    name: str
    color: str

class WorkSession(BaseModel):
    session_id: str
    title: str
    status: str
    root_directory: str
    agents: List[WorkSessionAgent]
    total_tokens: str
    last_active: str  # Kept as string for now to match frontend mock requirements, can be datetime later
    is_current_session: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
