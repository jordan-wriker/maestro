import pytest
from pathlib import Path
from app.main import app

@pytest.mark.asyncio
async def test_clear_session(seeded_async_client):
    session_id = "test-session-001"

    # Verify initial state (using current or list)
    response = await seeded_async_client.get("/api/sessions/current")
    assert response.status_code == 200
    assert response.json()["session_id"] == session_id
    
    # Check conversations exist
    response = await seeded_async_client.get(f"/api/conversations?session_id={session_id}")
    assert response.status_code == 200
    assert len(response.json()) >= 1
    
    # Check log files exist
    # Access log_storage from app.state which is patched by fixture
    log_storage = app.state.log_storage
    assert (log_storage.logs_dir / "claude" / "conv-claude-001.json").exists()

    # Clear session
    response = await seeded_async_client.post(f"/api/admin/clear-session/{session_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # Verify conversations are gone via API
    response = await seeded_async_client.get(f"/api/conversations?session_id={session_id}")
    assert response.status_code == 200
    assert len(response.json()) == 0
    
    # Verify log files are gone
    assert not (log_storage.logs_dir / "claude" / "conv-claude-001.json").exists()
    
    # Verify session still exists (using list)
    response = await seeded_async_client.get("/api/sessions")
    assert response.status_code == 200
    sessions = response.json().get("sessions", [])
    assert any(s["session_id"] == session_id for s in sessions)

