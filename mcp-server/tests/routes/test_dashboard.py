"""Integration tests for dashboard API endpoints."""
import pytest
from httpx import AsyncClient
from app.models.responses import ConversationSummary, ConversationDetail


@pytest.mark.asyncio
async def test_list_conversations_empty(async_client: AsyncClient):
    """Test that conversations endpoint returns empty list when no data exists."""
    response = await async_client.get("/api/conversations")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_conversations_returns_data(seeded_async_client: AsyncClient):
    """Test that conversations endpoint returns seeded data."""
    response = await seeded_async_client.get("/api/conversations")
    assert response.status_code == 200

    conversations = response.json()
    assert len(conversations) >= 2, "Expected at least 2 seeded conversations"


@pytest.mark.asyncio
async def test_list_conversations_field_names_match(seeded_async_client: AsyncClient):
    """
    CRITICAL TEST: Validates that conversation summary field names
    match what frontend expects (task, final_response).
    """
    response = await seeded_async_client.get("/api/conversations")
    assert response.status_code == 200

    conversations = response.json()
    assert len(conversations) > 0, "No conversations returned - check seeded data"

    for conv in conversations:
        # Validate against Pydantic model (will raise ValidationError if fields wrong)
        ConversationSummary(**conv)

        # Check for FRONTEND-EXPECTED fields explicitly
        assert "task" in conv, f"ConversationSummary missing 'task' field. Has: {list(conv.keys())}"
        assert "final_response" in conv, f"ConversationSummary missing 'final_response' field. Has: {list(conv.keys())}"
        assert "conversation_id" in conv, f"Missing 'conversation_id' field"
        assert "agent" in conv, f"Missing 'agent' field"
        assert "created_at" in conv, f"Missing 'created_at' field"
        assert "status" in conv, f"Missing 'status' field"

        # Check that unexpected field names are NOT present
        if "prompt" in conv:
            pytest.fail(
                f"ConversationSummary has 'prompt' field instead of 'task'. "
                f"Frontend expects 'task'."
            )
        if "response" in conv and "final_response" not in conv:
            pytest.fail(
                f"ConversationSummary has 'response' field instead of 'final_response'. "
                f"Frontend expects 'final_response'."
            )


@pytest.mark.asyncio
async def test_conversation_detail_field_names_match(seeded_async_client: AsyncClient):
    """
    CRITICAL TEST: Validates that conversation detail field names
    match what frontend expects (task).
    """
    list_response = await seeded_async_client.get("/api/conversations")
    assert list_response.status_code == 200

    conversations = list_response.json()
    assert len(conversations) > 0, "No conversations to test detail view"

    conv_id = conversations[0]["conversation_id"]
    response = await seeded_async_client.get(f"/api/conversations/{conv_id}")

    assert response.status_code == 200
    conv_detail = response.json()

    # Validate against Pydantic model
    ConversationDetail(**conv_detail)

    # Check required fields
    assert "task" in conv_detail, f"ConversationDetail missing 'task' field. Has: {list(conv_detail.keys())}"
    assert "conversation_id" in conv_detail
    assert "agent" in conv_detail
    assert "created_at" in conv_detail
    assert "status" in conv_detail
    assert "events" in conv_detail

    if "prompt" in conv_detail and "task" not in conv_detail:
        pytest.fail(
            f"ConversationDetail has 'prompt' field instead of 'task'. "
            f"Frontend expects 'task'."
        )


@pytest.mark.asyncio
async def test_conversation_status_values(seeded_async_client: AsyncClient):
    """Test that conversation status values are from expected enum."""
    response = await seeded_async_client.get("/api/conversations")
    assert response.status_code == 200

    valid_statuses = {"completed", "error", "active", "running"}
    for conv in response.json():
        status = conv.get("status")
        assert status in valid_statuses, f"Invalid status '{status}'. Expected one of {valid_statuses}"


@pytest.mark.asyncio
async def test_conversation_agent_values(seeded_async_client: AsyncClient):
    """Test that agent values are from expected enum."""
    response = await seeded_async_client.get("/api/conversations")
    assert response.status_code == 200

    valid_agents = {"claude", "codex"}
    for conv in response.json():
        agent = conv.get("agent")
        assert agent in valid_agents, f"Invalid agent '{agent}'. Expected one of {valid_agents}"


@pytest.mark.asyncio
async def test_conversations_filter_by_agent(seeded_async_client: AsyncClient):
    """Test that filtering by agent works correctly."""
    # Get Claude conversations
    claude_response = await seeded_async_client.get("/api/conversations?agent=claude")
    assert claude_response.status_code == 200
    for conv in claude_response.json():
        assert conv["agent"] == "claude"

    # Get Codex conversations
    codex_response = await seeded_async_client.get("/api/conversations?agent=codex")
    assert codex_response.status_code == 200
    for conv in codex_response.json():
        assert conv["agent"] == "codex"
