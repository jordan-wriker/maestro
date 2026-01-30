"""Integration tests for session API endpoints."""
import pytest
from httpx import AsyncClient
from app.models.responses import SessionListResponse
from app.models.work_session import WorkSession, WorkSessionAgent


@pytest.mark.asyncio
async def test_list_sessions_empty(async_client: AsyncClient):
    """Test that sessions endpoint returns empty list when no data exists."""
    response = await async_client.get("/api/sessions")
    assert response.status_code == 200

    data = response.json()
    assert "sessions" in data, f"Response missing 'sessions' key. Has: {list(data.keys())}"
    assert data["sessions"] == []


@pytest.mark.asyncio
async def test_list_sessions_returns_data(seeded_async_client: AsyncClient):
    """Test that sessions endpoint returns seeded data."""
    response = await seeded_async_client.get("/api/sessions")
    assert response.status_code == 200

    data = response.json()
    assert "sessions" in data
    assert len(data["sessions"]) >= 1, "Expected at least 1 seeded session"


@pytest.mark.asyncio
async def test_session_list_response_structure(seeded_async_client: AsyncClient):
    """
    CRITICAL TEST: Validates that SessionListResponse structure matches
    what the frontend expects.
    """
    response = await seeded_async_client.get("/api/sessions")
    assert response.status_code == 200

    data = response.json()

    # Validate top-level structure
    assert "sessions" in data, f"Response missing 'sessions' key. Has: {list(data.keys())}"

    # Validate against Pydantic model
    session_list = SessionListResponse(**data)
    assert len(session_list.sessions) > 0, "No sessions returned - check seeded data"


@pytest.mark.asyncio
async def test_work_session_structure(seeded_async_client: AsyncClient):
    """
    CRITICAL TEST: Validates that WorkSession structure matches
    what the frontend expects.
    """
    response = await seeded_async_client.get("/api/sessions")
    assert response.status_code == 200

    data = response.json()
    sessions = data["sessions"]
    assert len(sessions) > 0, "No sessions to validate"

    for session in sessions:
        # Validate against Pydantic model
        work_session = WorkSession(**session)

        # Check required fields explicitly
        assert "session_id" in session, f"Missing 'session_id' field"
        assert "title" in session, f"Missing 'title' field"
        assert "status" in session, f"Missing 'status' field"
        assert "root_directory" in session, f"Missing 'root_directory' field"
        assert "agents" in session, f"Missing 'agents' field"
        assert "total_tokens" in session, f"Missing 'total_tokens' field"
        assert "last_active" in session, f"Missing 'last_active' field"
        assert "is_current_session" in session, f"Missing 'is_current_session' field"
        assert "created_at" in session, f"Missing 'created_at' field"
        assert "updated_at" in session, f"Missing 'updated_at' field"

        # Validate field types
        assert isinstance(session["agents"], list), "agents should be a list"
        assert isinstance(session["is_current_session"], bool), "is_current_session should be bool"


@pytest.mark.asyncio
async def test_work_session_agent_structure(seeded_async_client: AsyncClient):
    """Test that agent objects have correct structure."""
    response = await seeded_async_client.get("/api/sessions")
    assert response.status_code == 200

    data = response.json()
    sessions = data["sessions"]

    for session in sessions:
        agents = session.get("agents", [])
        for agent in agents:
            # Validate against Pydantic model
            agent_obj = WorkSessionAgent(**agent)

            # Check required fields
            assert "name" in agent, f"Agent missing 'name' field"
            assert "color" in agent, f"Agent missing 'color' field"


@pytest.mark.asyncio
async def test_session_status_values(seeded_async_client: AsyncClient):
    """Test that session status values are from expected enum."""
    response = await seeded_async_client.get("/api/sessions")
    assert response.status_code == 200

    valid_statuses = {"active", "inactive", "archived"}
    for session in response.json()["sessions"]:
        status = session.get("status")
        assert status in valid_statuses, f"Invalid status '{status}'. Expected one of {valid_statuses}"


@pytest.mark.asyncio
async def test_get_current_session(seeded_async_client: AsyncClient):
    """Test getting the current active session."""
    response = await seeded_async_client.get("/api/sessions/current")
    assert response.status_code == 200

    session = response.json()

    # Validate structure
    WorkSession(**session)

    # Current session should have is_current_session = True
    assert session["is_current_session"] is True


@pytest.mark.asyncio
async def test_current_session_not_found(async_client: AsyncClient):
    """Test that 404 is returned when no current session exists."""
    response = await async_client.get("/api/sessions/current")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_session_has_unique_session_id(seeded_async_client: AsyncClient):
    """Test that each session has a unique session_id."""
    response = await seeded_async_client.get("/api/sessions")
    assert response.status_code == 200

    sessions = response.json()["sessions"]
    session_ids = [s["session_id"] for s in sessions]

    # All session_ids should be unique
    assert len(session_ids) == len(set(session_ids)), "Duplicate session_ids found"
