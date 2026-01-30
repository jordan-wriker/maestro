"""Shared pytest fixtures for backend tests."""
import pytest
import tempfile
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
from sqlmodel import Session

from app.main import app
from app.db import get_session
from app.db.models import WorkSession as DBWorkSession, Batch, Conversation, BatchTaskEntity
from app.models.responses import ConversationSummary, BatchResponse, BatchTaskResponse
from app.services.log_storage import LogStorageService
from app.services.batch_manager import BatchManager
from app.services.agent_runner import AgentRunner
from app.services.websocket_manager import WebSocketManager
from app.core.state import AppState
from app.core.config import settings


@pytest.fixture
def temp_db_path():
    """Create a temporary database file for testing."""
    fd, path = tempfile.mkstemp(suffix=".db")
    yield path
    import os
    try:
        os.close(fd)
    except:
        pass
    Path(path).unlink(missing_ok=True)


@pytest.fixture
def test_db(temp_db_path):
    """Create a temporary database for testing."""
    from sqlalchemy import create_engine
    test_engine = create_engine(f"sqlite:///{temp_db_path}", echo=False)

    # Create tables (excluding the complex index for tests)
    from sqlmodel import SQLModel
    # Remove the WorkSession with complex index temporarily
    DBWorkSession.__table__.opts = ()
    SQLModel.metadata.create_all(test_engine)

    with Session(test_engine) as session:
        yield session

    test_engine.dispose()


@pytest.fixture
def temp_logs_dir():
    """Create a temporary logs directory for testing."""
    import tempfile
    temp_dir = tempfile.mkdtemp(prefix="test_logs_")
    yield Path(temp_dir)
    # Cleanup
    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def seeded_test_db(test_db, temp_logs_dir):
    """
    Create a test database seeded with realistic sample data.

    Creates:
    - 1 WorkSession (current session)
    - 2 Conversation records (one claude, one codex)
    - 1 Batch with 2 BatchTaskEntity records
    - Log files for conversation detail endpoint
    """
    # Create a work session
    now = datetime.now(timezone.utc)
    session_data = DBWorkSession(
        session_id="test-session-001",
        title="Test Session for API Validation",
        status="active",
        root_directory="/home/test/project",
        agents=json.dumps([
            {"name": "Claude", "color": "blue"},
            {"name": "Codex", "color": "green"}
        ]),
        total_tokens="1500",
        last_active=now.isoformat(),
        is_current_session=True,
        created_at=now - timedelta(hours=2),
        updated_at=now
    )
    test_db.add(session_data)
    test_db.commit()
    test_db.refresh(session_data)

    # Create a Claude conversation
    claude_conversation = Conversation(
        conversation_id="conv-claude-001",
        session_id="test-session-001",
        batch_id=None,
        agent="claude",
        status="completed",
        prompt="Implement a function to calculate fibonacci numbers",
        response="Here is a Python implementation of the fibonacci function:\n\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
        created_at=now - timedelta(hours=1),
        last_activity=now - timedelta(minutes=30)
    )
    test_db.add(claude_conversation)

    # Create a Codex conversation
    codex_conversation = Conversation(
        conversation_id="conv-codex-001",
        session_id="test-session-001",
        batch_id=None,
        agent="codex",
        status="completed",
        prompt="Write unit tests for the fibonacci function",
        response="Created test_fibonacci.py with 5 test cases covering edge cases and normal inputs.",
        created_at=now - timedelta(minutes=45),
        last_activity=now - timedelta(minutes=20)
    )
    test_db.add(codex_conversation)
    test_db.commit()

    # Create a batch
    batch = Batch(
        batch_id="BCH-TEST-1",
        session_id="test-session-001",
        status="completed",
        total_tasks=2,
        completed_tasks=2,
        progress=100.0,
        created_at=now - timedelta(minutes=15),
        updated_at=now - timedelta(minutes=5)
    )
    test_db.add(batch)
    test_db.commit()
    test_db.refresh(batch)

    # Create batch tasks
    task1 = BatchTaskEntity(
        task_id="task-001",
        batch_id="BCH-TEST-1",
        status="completed",
        result=json.dumps({
            "text": "Task 1 completed successfully",
            "conversation_id": "conv-batch-001"
        }),
        created_at=now - timedelta(minutes=15),
        updated_at=now - timedelta(minutes=8)
    )
    test_db.add(task1)

    task2 = BatchTaskEntity(
        task_id="task-002",
        batch_id="BCH-TEST-1",
        status="completed",
        result=json.dumps({
            "text": "Task 2 completed successfully",
            "conversation_id": "conv-batch-002"
        }),
        created_at=now - timedelta(minutes=15),
        updated_at=now - timedelta(minutes=5)
    )
    test_db.add(task2)
    test_db.commit()

    # Create log files for conversation detail endpoint
    # These are needed because the detail endpoint reads from files
    _create_conversation_log_files(temp_logs_dir, now)

    # Store the logs_dir in test_db for fixture access
    test_db._test_logs_dir = temp_logs_dir

    yield test_db


def _create_conversation_log_files(logs_dir: Path, now: datetime):
    """Create log files for seeded conversations."""
    # Create claude logs directory
    claude_dir = logs_dir / "claude"
    claude_dir.mkdir(parents=True, exist_ok=True)

    # Create codex logs directory
    codex_dir = logs_dir / "codex"
    codex_dir.mkdir(parents=True, exist_ok=True)

    # Claude conversation log file
    claude_log = {
        "conversation_id": "conv-claude-001",
        "agent": "claude",
        "created_at": (now - timedelta(hours=1)).isoformat(),
        "logs": [
            {
                "id": 1,
                "session_id": "test-session-001",
                "timestamp": (now - timedelta(hours=1)).isoformat(),
                "status": "completed",
                "agent": "claude",
                "task": "Implement a function to calculate fibonacci numbers",
                "final_response": "Here is a Python implementation of the fibonacci function:\n\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
                "events": [
                    {
                        "type": "thinking",
                        "content": "I need to implement a fibonacci function in Python.",
                        "conversation_id": "conv-claude-001"
                    },
                    {
                        "type": "result",
                        "content": "Here is a Python implementation of the fibonacci function:\n\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
                        "conversation_id": "conv-claude-001"
                    }
                ]
            }
        ]
    }
    with open(claude_dir / "conv-claude-001.json", "w") as f:
        json.dump(claude_log, f, indent=2)

    # Codex conversation log file
    codex_log = {
        "conversation_id": "conv-codex-001",
        "agent": "codex",
        "created_at": (now - timedelta(minutes=45)).isoformat(),
        "logs": [
            {
                "id": 2,
                "session_id": "test-session-001",
                "timestamp": (now - timedelta(minutes=45)).isoformat(),
                "status": "completed",
                "agent": "codex",
                "task": "Write unit tests for the fibonacci function",
                "final_response": "Created test_fibonacci.py with 5 test cases covering edge cases and normal inputs.",
                "events": [
                    {
                        "type": "thinking",
                        "content": "I will create comprehensive unit tests for the fibonacci function.",
                        "conversation_id": "conv-codex-001"
                    },
                    {
                        "type": "result",
                        "content": "Created test_fibonacci.py with 5 test cases covering edge cases and normal inputs.",
                        "conversation_id": "conv-codex-001"
                    }
                ]
            }
        ]
    }
    with open(codex_dir / "conv-codex-001.json", "w") as f:
        json.dump(codex_log, f, indent=2)


@pytest.fixture
async def mock_app_state():
    """Create a mock app state with required dependencies."""
    # Create real AppState (no init parameters)
    app_state = AppState()

    # Create mock LogStorageService with real app_state
    logs_dir = Path(settings.logs_dir)
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_storage = LogStorageService(app_state)

    # Create mock BatchManager
    batch_manager = MagicMock(spec=BatchManager)

    # Create mock AgentRunner
    agent_runner = MagicMock(spec=AgentRunner)

    # Create mock WebSocketManager
    ws_manager = MagicMock(spec=WebSocketManager)
    ws_manager.broadcast = AsyncMock()

    return {
        "app_state": app_state,
        "log_storage": log_storage,
        "batch_manager": batch_manager,
        "agent_runner": agent_runner,
        "websocket_manager": ws_manager,
    }


@pytest.fixture
async def async_client(test_db, mock_app_state):
    """Create an async HTTP client for integration tests."""
    import httpx

    def override_get_db():
        yield test_db

    # Set up app state with all required dependencies
    app.state.app_state = mock_app_state["app_state"]
    app.state.log_storage = mock_app_state["log_storage"]
    app.state.batch_manager = mock_app_state["batch_manager"]
    app.state.agent_runner = mock_app_state["agent_runner"]
    app.state.websocket_manager = mock_app_state["websocket_manager"]

    app.dependency_overrides[get_session] = override_get_db

    # Use the ASGI transport for FastAPI app
    from httpx import ASGITransport
    transport = ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=10.0) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def seeded_async_client(seeded_test_db, mock_app_state):
    """
    Create an async HTTP client with a pre-seeded database for integration tests.
    This ensures tests have data to validate against.
    """
    import httpx

    def override_get_db():
        yield seeded_test_db

    # Set up app state with all required dependencies
    app.state.app_state = mock_app_state["app_state"]
    app.state.batch_manager = mock_app_state["batch_manager"]
    app.state.agent_runner = mock_app_state["agent_runner"]
    app.state.websocket_manager = mock_app_state["websocket_manager"]

    # Set current session ID for app_state
    await mock_app_state["app_state"].set_current_session_id("test-session-001")

    # Create log_storage with the test logs directory
    test_logs_dir = getattr(seeded_test_db, "_test_logs_dir", None)
    if test_logs_dir:
        # Create a new LogStorageService with the test logs directory
        log_storage = LogStorageService(mock_app_state["app_state"])
        log_storage.logs_dir = test_logs_dir
        app.state.log_storage = log_storage
    else:
        app.state.log_storage = mock_app_state["log_storage"]

    app.dependency_overrides[get_session] = override_get_db

    # Use the ASGI transport for FastAPI app
    from httpx import ASGITransport
    transport = ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=10.0) as ac:
        yield ac

    app.dependency_overrides.clear()
