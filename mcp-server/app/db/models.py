from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Index

class WorkSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(unique=True, index=True)
    title: str
    status: str
    root_directory: str
    agents: str  # JSON string to store list of agents
    total_tokens: str
    last_active: str  # ISO format timestamp string
    is_current_session: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    __table_args__ = (
        Index(
            "ix_worksession_is_current_session_unique",
            "is_current_session",
            unique=True,
            sqlite_where="is_current_session = 1",
        ),
    )

class Batch(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    batch_id: str = Field(unique=True, index=True)
    session_id: str = Field(foreign_key="worksession.session_id", index=True)
    status: str
    total_tasks: int
    completed_tasks: int = Field(default=0)
    progress: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: str = Field(unique=True, index=True)
    session_id: str = Field(foreign_key="worksession.session_id", index=True)
    batch_id: Optional[str] = Field(default=None, foreign_key="batch.batch_id", index=True)
    agent: str  # "claude" or "codex"
    status: str  # "completed", "error", "active", "running"
    prompt: str
    response: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)

class BatchTaskEntity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: str = Field(index=True)
    batch_id: str = Field(foreign_key="batch.batch_id", index=True)
    status: str  # "pending", "running", "completed", "failed", "fetched"
    result: Optional[str] = None  # JSON string
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
