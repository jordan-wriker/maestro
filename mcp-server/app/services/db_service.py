import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlmodel import Session, select
from app.db.models import WorkSession as DBWorkSession, Conversation, Batch, BatchTaskEntity
from app.models.work_session import WorkSession, WorkSessionAgent
from app.core.logging import get_logger

logger = get_logger(__name__)

class DBService:
    """
    Service class to handle database operations for sessions, conversations, and batches.
    Encapsulates CRUD logic and entity relationships.
    """

    def __init__(self, session: Session):
        self.session = session

    # --- Session Methods ---

    def create_session(self, session_data: Dict[str, Any]) -> WorkSession:
        """
        Create a new session record.
        Converts agents list to JSON string for storage.
        """
        try:
            # Prepare data for DB model
            db_data = session_data.copy()
            if isinstance(db_data.get("agents"), list):
                db_data["agents"] = json.dumps(db_data["agents"])
            
            # Ensure timestamps
            if "created_at" not in db_data:
                db_data["created_at"] = datetime.utcnow()
            if "updated_at" not in db_data:
                db_data["updated_at"] = datetime.utcnow()

            # Guard is_current_session activation
            set_as_current = db_data.pop("is_current_session", False)

            db_session = DBWorkSession(**db_data)
            db_session.is_current_session = False  # Ensure False initially to avoid index conflicts
            self.session.add(db_session)
            self.session.commit()
            self.session.refresh(db_session)
            
            if set_as_current:
                logger.debug("Routing through set_current_session for new session", session_id=db_session.session_id)
                return self.set_current_session(db_session.session_id)

            logger.info("Created session", session_id=db_session.session_id)
            return self._convert_db_session_to_pydantic(db_session)
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to create session", error=str(e), session_id=session_data.get("session_id"))
            raise

    def get_session(self, session_id: str) -> Optional[WorkSession]:
        """Retrieve a session by ID and convert to Pydantic model."""
        statement = select(DBWorkSession).where(DBWorkSession.session_id == session_id)
        db_session = self.session.exec(statement).first()
        if not db_session:
            return None
        return self._convert_db_session_to_pydantic(db_session)

    def get_session_by_id(self, session_id: str) -> Optional[WorkSession]:
        """Alias for get_session for consistency."""
        return self.get_session(session_id)

    def list_sessions(self) -> List[WorkSession]:
        """Get all sessions ordered by updated_at descending."""
        statement = select(DBWorkSession).order_by(DBWorkSession.updated_at.desc())
        results = self.session.exec(statement).all()
        return [self._convert_db_session_to_pydantic(s) for s in results]

    def update_session(self, session_id: str, updates: Dict[str, Any]) -> Optional[WorkSession]:
        """Update session fields."""
        try:
            statement = select(DBWorkSession).where(DBWorkSession.session_id == session_id)
            db_session = self.session.exec(statement).first()
            if not db_session:
                return None

            # Guard is_current_session activation
            set_as_current = updates.pop("is_current_session", False)

            for key, value in updates.items():
                if key == "agents" and isinstance(value, list):
                    value = json.dumps(value)
                setattr(db_session, key, value)
            
            db_session.updated_at = datetime.utcnow()
            self.session.add(db_session)
            self.session.commit()
            self.session.refresh(db_session)
            
            if set_as_current:
                return self.set_current_session(session_id)
            
            return self._convert_db_session_to_pydantic(db_session)
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to update session", error=str(e), session_id=session_id)
            raise

    def set_current_session(self, session_id: str) -> WorkSession:
        """
        Set a session as current, ensuring only one session has is_current_session=True.
        """
        try:
            # 1. Reset all current sessions and commit/flush to satisfy unique index in SQLite
            reset_statement = select(DBWorkSession).where(DBWorkSession.is_current_session == True)
            current_sessions = self.session.exec(reset_statement).all()
            for s in current_sessions:
                s.is_current_session = False
                self.session.add(s)
            
            if current_sessions:
                self.session.commit() # Commit resets before setting new current session

            # 2. Set target session as current
            statement = select(DBWorkSession).where(DBWorkSession.session_id == session_id)
            db_session = self.session.exec(statement).first()
            if not db_session:
                raise ValueError(f"Session {session_id} not found")

            db_session.is_current_session = True
            db_session.updated_at = datetime.utcnow()
            self.session.add(db_session)
            
            # 3. Final commit
            self.session.commit()
            self.session.refresh(db_session)
            
            logger.info("Set current session", session_id=session_id)
            return self._convert_db_session_to_pydantic(db_session)
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to set current session", error=str(e), session_id=session_id)
            raise

    def get_current_session(self) -> Optional[WorkSession]:
        """Query for the session where is_current_session=True."""
        statement = select(DBWorkSession).where(DBWorkSession.is_current_session == True)
        db_session = self.session.exec(statement).first()
        if not db_session:
            return None
        return self._convert_db_session_to_pydantic(db_session)

    # --- Conversation Methods ---

    def create_conversation(self, conversation_data: Dict[str, Any]) -> Conversation:
        """Create a new conversation record."""
        try:
            db_conversation = Conversation(**conversation_data)
            self.session.add(db_conversation)
            self.session.commit()
            self.session.refresh(db_conversation)
            logger.info("Created conversation", conversation_id=db_conversation.conversation_id)
            return db_conversation
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to create conversation", error=str(e), conversation_id=conversation_data.get("conversation_id"))
            raise

    def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """Retrieve a conversation by ID."""
        statement = select(Conversation).where(Conversation.conversation_id == conversation_id)
        return self.session.exec(statement).first()

    def list_conversations_by_session(self, session_id: str) -> List[Conversation]:
        """Get all conversations for a session, ordered by created_at descending."""
        statement = select(Conversation).where(Conversation.session_id == session_id).order_by(Conversation.created_at.desc())
        return self.session.exec(statement).all()

    def update_conversation(self, conversation_id: str, updates: Dict[str, Any]) -> Optional[Conversation]:
        """Update conversation fields."""
        try:
            statement = select(Conversation).where(Conversation.conversation_id == conversation_id)
            db_conversation = self.session.exec(statement).first()
            if not db_conversation:
                return None

            for key, value in updates.items():
                setattr(db_conversation, key, value)
            
            db_conversation.last_activity = datetime.utcnow()
            self.session.add(db_conversation)
            self.session.commit()
            self.session.refresh(db_conversation)
            return db_conversation
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to update conversation", error=str(e), conversation_id=conversation_id)
            raise

    def link_conversation_to_batch(self, conversation_id: str, batch_id: str) -> Optional[Conversation]:
        """Set the batch_id foreign key on a conversation."""
        return self.update_conversation(conversation_id, {"batch_id": batch_id})

    # --- Batch Methods ---

    def create_batch(self, batch_data: Dict[str, Any]) -> Batch:
        """Create a new batch record."""
        try:
            db_batch = Batch(**batch_data)
            self.session.add(db_batch)
            self.session.commit()
            self.session.refresh(db_batch)
            logger.info("Created batch", batch_id=db_batch.batch_id)
            return db_batch
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to create batch", error=str(e), batch_id=batch_data.get("batch_id"))
            raise

    def get_batch(self, batch_id: str) -> Optional[Batch]:
        """Retrieve a batch by ID."""
        statement = select(Batch).where(Batch.batch_id == batch_id)
        return self.session.exec(statement).first()

    def list_batches_by_session(self, session_id: str) -> List[Batch]:
        """Get all batches for a session, ordered by created_at descending."""
        statement = select(Batch).where(Batch.session_id == session_id).order_by(Batch.created_at.desc())
        return self.session.exec(statement).all()

    def update_batch(self, batch_id: str, updates: Dict[str, Any]) -> Optional[Batch]:
        """Update batch fields."""
        try:
            statement = select(Batch).where(Batch.batch_id == batch_id)
            db_batch = self.session.exec(statement).first()
            if not db_batch:
                return None

            for key, value in updates.items():
                setattr(db_batch, key, value)
            
            db_batch.updated_at = datetime.utcnow()
            self.session.add(db_batch)
            self.session.commit()
            self.session.refresh(db_batch)
            return db_batch
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to update batch", error=str(e), batch_id=batch_id)
            raise

    def increment_batch_progress(self, batch_id: str) -> Optional[Batch]:
        """Increment completed_tasks and recalculate progress."""
        try:
            statement = select(Batch).where(Batch.batch_id == batch_id)
            db_batch = self.session.exec(statement).first()
            if not db_batch:
                return None

            db_batch.completed_tasks += 1
            if db_batch.total_tasks > 0:
                db_batch.progress = (db_batch.completed_tasks / db_batch.total_tasks) * 100
            
            db_batch.updated_at = datetime.utcnow()
            self.session.add(db_batch)
            self.session.commit()
            self.session.refresh(db_batch)
            return db_batch
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to increment batch progress", error=str(e), batch_id=batch_id)
            raise

    # --- Batch Task Methods ---

    def create_batch_task(self, task_data: Dict[str, Any]) -> BatchTaskEntity:
        """Create a new batch task record."""
        try:
            db_task = BatchTaskEntity(**task_data)
            self.session.add(db_task)
            self.session.commit()
            self.session.refresh(db_task)
            return db_task
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to create batch task", error=str(e), batch_id=task_data.get("batch_id"))
            raise

    def update_batch_task(self, batch_id: str, task_id: str, updates: Dict[str, Any]) -> Optional[BatchTaskEntity]:
        """Update a batch task record."""
        try:
            statement = select(BatchTaskEntity).where(
                BatchTaskEntity.batch_id == batch_id,
                BatchTaskEntity.task_id == task_id
            )
            db_task = self.session.exec(statement).first()
            if not db_task:
                return None

            for key, value in updates.items():
                if key == "result" and isinstance(value, dict):
                    value = json.dumps(value)
                setattr(db_task, key, value)
            
            db_task.updated_at = datetime.utcnow()
            self.session.add(db_task)
            self.session.commit()
            self.session.refresh(db_task)
            return db_task
        except Exception as e:
            self.session.rollback()
            logger.error("Failed to update batch task", error=str(e), batch_id=batch_id, task_id=task_id)
            raise

    def get_batch_tasks(self, batch_id: str) -> List[BatchTaskEntity]:
        """Get all tasks for a batch."""
        statement = select(BatchTaskEntity).where(BatchTaskEntity.batch_id == batch_id)
        return self.session.exec(statement).all()

    # --- Helpers ---

    def _convert_db_session_to_pydantic(self, db_session: DBWorkSession) -> WorkSession:
        """Convert database model to Pydantic model."""
        try:
            agents_data = json.loads(db_session.agents)
            agents = [WorkSessionAgent(**a) for a in agents_data]
            
            return WorkSession(
                session_id=db_session.session_id,
                title=db_session.title,
                status=db_session.status,
                root_directory=db_session.root_directory,
                agents=agents,
                total_tokens=db_session.total_tokens,
                last_active=db_session.last_active,
                is_current_session=db_session.is_current_session,
                created_at=db_session.created_at,
                updated_at=db_session.updated_at
            )
        except Exception as e:
            logger.error("Failed to convert DB session to Pydantic", error=str(e), session_id=db_session.session_id)
            # Return with empty agents list if parse fails, or re-raise depending on strictness
            return WorkSession(
                session_id=db_session.session_id,
                title=db_session.title,
                status=db_session.status,
                root_directory=db_session.root_directory,
                agents=[],
                total_tokens=db_session.total_tokens,
                last_active=db_session.last_active,
                is_current_session=db_session.is_current_session,
                created_at=db_session.created_at,
                updated_at=db_session.updated_at
            )
