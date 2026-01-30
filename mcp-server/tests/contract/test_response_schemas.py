"""
Contract tests for API response schemas.

These tests validate that API responses conform to expected schemas,
ensuring backend and frontend type definitions remain in sync.

Contract tests are designed to:
1. Fetch from each endpoint
2. Validate response structure against expected schema
3. Test that status values match expected enums
4. Test that all required fields are present
"""
import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from typing import Any, Dict, List, Set

from app.models.responses import (
    SessionListResponse,
    ConversationSummary,
    ConversationDetail,
    BatchResponse,
    BatchTaskResponse,
    LogEntry,
)
from app.models.work_session import WorkSession, WorkSessionAgent


# ============================================================================
# Schema Definitions - Expected field requirements
# ============================================================================

# Required fields for each response type (what frontend expects)
SESSION_REQUIRED_FIELDS = {
    "session_id", "title", "status", "root_directory", "agents",
    "total_tokens", "last_active", "is_current_session", "created_at", "updated_at"
}

CONVERSATION_SUMMARY_REQUIRED_FIELDS = {
    "conversation_id", "agent", "created_at", "status", "task", "final_response"
}

CONVERSATION_DETAIL_REQUIRED_FIELDS = {
    "conversation_id", "agent", "created_at", "status", "task", "events"
}

BATCH_REQUIRED_FIELDS = {
    "batch_id", "session_id", "status", "total_tasks", "completed_tasks",
    "progress", "tasks", "created_at", "updated_at"
}

BATCH_TASK_REQUIRED_FIELDS = {
    "task_id", "batch_id", "status"
}

# Valid enum values
VALID_CONVERSATION_STATUSES = {"completed", "error", "active", "running"}
VALID_AGENTS = {"claude", "codex"}
VALID_SESSION_STATUSES = {"active", "inactive", "archived"}
VALID_BATCH_STATUSES = {"pending", "running", "completed", "failed"}
VALID_BATCH_TASK_STATUSES = {"pending", "running", "completed", "failed", "fetched"}


# ============================================================================
# Helper Functions
# ============================================================================

def validate_required_fields(data: Dict[str, Any], required_fields: Set[str], context: str):
    """Validate that all required fields are present in data."""
    missing_fields = required_fields - set(data.keys())
    if missing_fields:
        pytest.fail(
            f"{context}: Missing required fields: {missing_fields}. "
            f"Got fields: {list(data.keys())}"
        )


def validate_enum_value(value: str, valid_values: Set[str], field_name: str, context: str):
    """Validate that a value is from the expected enum."""
    if value not in valid_values:
        pytest.fail(
            f"{context}: Invalid {field_name} value '{value}'. "
            f"Expected one of: {valid_values}"
        )


# ============================================================================
# Session Contract Tests
# ============================================================================

class TestSessionContract:
    """Contract tests for session-related endpoints."""

    @pytest.mark.asyncio
    async def test_sessions_list_response_contract(self, seeded_async_client: AsyncClient):
        """
        Contract: GET /api/sessions returns SessionListResponse structure.
        """
        response = await seeded_async_client.get("/api/sessions")
        assert response.status_code == 200

        data = response.json()

        # Top-level structure
        assert "sessions" in data, "Response must have 'sessions' key"
        assert isinstance(data["sessions"], list), "'sessions' must be a list"

        # Validate against Pydantic model
        try:
            validated = SessionListResponse(**data)
        except ValidationError as e:
            pytest.fail(f"SessionListResponse validation failed: {e}")

    @pytest.mark.asyncio
    async def test_work_session_contract(self, seeded_async_client: AsyncClient):
        """
        Contract: Each session in the list has all required WorkSession fields.
        """
        response = await seeded_async_client.get("/api/sessions")
        assert response.status_code == 200

        sessions = response.json()["sessions"]
        assert len(sessions) > 0, "Need seeded sessions for contract test"

        for i, session in enumerate(sessions):
            context = f"Session[{i}]"

            # Validate required fields
            validate_required_fields(session, SESSION_REQUIRED_FIELDS, context)

            # Validate against Pydantic model
            try:
                WorkSession(**session)
            except ValidationError as e:
                pytest.fail(f"{context}: WorkSession validation failed: {e}")

            # Validate enum values
            validate_enum_value(
                session["status"], VALID_SESSION_STATUSES,
                "status", context
            )

            # Validate agents structure
            assert isinstance(session["agents"], list), f"{context}: agents must be list"
            for j, agent in enumerate(session["agents"]):
                agent_context = f"{context}.agents[{j}]"
                assert "name" in agent, f"{agent_context}: missing 'name'"
                assert "color" in agent, f"{agent_context}: missing 'color'"
                try:
                    WorkSessionAgent(**agent)
                except ValidationError as e:
                    pytest.fail(f"{agent_context}: WorkSessionAgent validation failed: {e}")

    @pytest.mark.asyncio
    async def test_current_session_contract(self, seeded_async_client: AsyncClient):
        """
        Contract: GET /api/sessions/current returns WorkSession structure.
        """
        response = await seeded_async_client.get("/api/sessions/current")
        assert response.status_code == 200

        session = response.json()
        validate_required_fields(session, SESSION_REQUIRED_FIELDS, "CurrentSession")

        try:
            WorkSession(**session)
        except ValidationError as e:
            pytest.fail(f"CurrentSession validation failed: {e}")

        # Current session must have is_current_session=True
        assert session["is_current_session"] is True, "Current session must have is_current_session=True"


# ============================================================================
# Conversation Contract Tests
# ============================================================================

class TestConversationContract:
    """Contract tests for conversation-related endpoints."""

    @pytest.mark.asyncio
    async def test_conversations_list_contract(self, seeded_async_client: AsyncClient):
        """
        Contract: GET /api/conversations returns list of ConversationSummary.
        """
        response = await seeded_async_client.get("/api/conversations")
        assert response.status_code == 200

        conversations = response.json()
        assert isinstance(conversations, list), "Response must be a list"
        assert len(conversations) > 0, "Need seeded conversations for contract test"

        for i, conv in enumerate(conversations):
            context = f"Conversation[{i}]"

            # Validate required fields
            validate_required_fields(conv, CONVERSATION_SUMMARY_REQUIRED_FIELDS, context)

            # CRITICAL: Check for field name mismatches
            if "prompt" in conv and "task" not in conv:
                pytest.fail(
                    f"{context}: Has 'prompt' but not 'task'. "
                    "Frontend expects 'task' field."
                )
            if "response" in conv and "final_response" not in conv:
                pytest.fail(
                    f"{context}: Has 'response' but not 'final_response'. "
                    "Frontend expects 'final_response' field."
                )

            # Validate against Pydantic model
            try:
                ConversationSummary(**conv)
            except ValidationError as e:
                pytest.fail(f"{context}: ConversationSummary validation failed: {e}")

            # Validate enum values
            validate_enum_value(
                conv["status"], VALID_CONVERSATION_STATUSES,
                "status", context
            )
            validate_enum_value(
                conv["agent"], VALID_AGENTS,
                "agent", context
            )

    @pytest.mark.asyncio
    async def test_conversation_detail_contract(self, seeded_async_client: AsyncClient):
        """
        Contract: GET /api/conversations/{id} returns ConversationDetail.
        """
        # First get list to find a conversation_id
        list_response = await seeded_async_client.get("/api/conversations")
        conversations = list_response.json()
        assert len(conversations) > 0, "Need conversations for detail test"

        conv_id = conversations[0]["conversation_id"]
        response = await seeded_async_client.get(f"/api/conversations/{conv_id}")
        assert response.status_code == 200

        detail = response.json()
        context = f"ConversationDetail[{conv_id}]"

        # Validate required fields
        validate_required_fields(detail, CONVERSATION_DETAIL_REQUIRED_FIELDS, context)

        # CRITICAL: Check for field name mismatches
        if "prompt" in detail and "task" not in detail:
            pytest.fail(
                f"{context}: Has 'prompt' but not 'task'. "
                "Frontend expects 'task' field."
            )

        # Validate against Pydantic model
        try:
            ConversationDetail(**detail)
        except ValidationError as e:
            pytest.fail(f"{context}: ConversationDetail validation failed: {e}")

        # Validate enum values
        validate_enum_value(
            detail["status"], VALID_CONVERSATION_STATUSES,
            "status", context
        )
        validate_enum_value(
            detail["agent"], VALID_AGENTS,
            "agent", context
        )

        # Events must be a list
        assert isinstance(detail["events"], list), f"{context}: events must be a list"


# ============================================================================
# Batch Contract Tests
# ============================================================================

class TestBatchContract:
    """Contract tests for batch-related endpoints."""

    @pytest.mark.asyncio
    async def test_batches_list_contract(self, seeded_async_client: AsyncClient):
        """
        Contract: GET /api/batches returns list of BatchResponse.
        """
        response = await seeded_async_client.get("/api/batches")
        assert response.status_code == 200

        batches = response.json()
        assert isinstance(batches, list), "Response must be a list"
        assert len(batches) > 0, "Need seeded batches for contract test"

        for i, batch in enumerate(batches):
            context = f"Batch[{i}]"

            # Validate required fields
            validate_required_fields(batch, BATCH_REQUIRED_FIELDS, context)

            # Validate against Pydantic model
            try:
                BatchResponse(**batch)
            except ValidationError as e:
                pytest.fail(f"{context}: BatchResponse validation failed: {e}")

            # Validate enum values
            validate_enum_value(
                batch["status"], VALID_BATCH_STATUSES,
                "status", context
            )

            # Validate field types
            assert isinstance(batch["total_tasks"], int), f"{context}: total_tasks must be int"
            assert isinstance(batch["completed_tasks"], int), f"{context}: completed_tasks must be int"
            assert isinstance(batch["progress"], (int, float)), f"{context}: progress must be numeric"
            assert isinstance(batch["tasks"], list), f"{context}: tasks must be list"

    @pytest.mark.asyncio
    async def test_batch_task_contract(self, seeded_async_client: AsyncClient):
        """
        Contract: Each task in a batch has all required BatchTaskResponse fields.
        """
        response = await seeded_async_client.get("/api/batches")
        batches = response.json()

        for i, batch in enumerate(batches):
            for j, task in enumerate(batch.get("tasks", [])):
                context = f"Batch[{i}].tasks[{j}]"

                # Validate required fields
                validate_required_fields(task, BATCH_TASK_REQUIRED_FIELDS, context)

                # Validate against Pydantic model
                try:
                    BatchTaskResponse(**task)
                except ValidationError as e:
                    pytest.fail(f"{context}: BatchTaskResponse validation failed: {e}")

                # Validate enum values
                validate_enum_value(
                    task["status"], VALID_BATCH_TASK_STATUSES,
                    "status", context
                )

                # If result is present, it should be a dict or None
                if "result" in task and task["result"] is not None:
                    assert isinstance(task["result"], dict), \
                        f"{context}: result must be dict when present"

    @pytest.mark.asyncio
    async def test_batch_progress_contract(self, seeded_async_client: AsyncClient):
        """
        Contract: Progress calculation is consistent with total/completed tasks.
        """
        response = await seeded_async_client.get("/api/batches")
        batches = response.json()

        for i, batch in enumerate(batches):
            context = f"Batch[{i}]"
            total = batch["total_tasks"]
            completed = batch["completed_tasks"]
            progress = batch["progress"]

            # Progress must be 0-100
            assert 0 <= progress <= 100, \
                f"{context}: progress {progress} out of range [0, 100]"

            # Progress should match completed/total ratio
            if total > 0:
                expected = (completed / total) * 100
                assert abs(progress - expected) < 0.5, \
                    f"{context}: progress mismatch. Expected ~{expected:.1f}, got {progress}"


# ============================================================================
# Cross-Endpoint Contract Tests
# ============================================================================

class TestCrossEndpointContract:
    """Contract tests that verify consistency across endpoints."""

    @pytest.mark.asyncio
    async def test_session_id_consistency(self, seeded_async_client: AsyncClient):
        """
        Contract: session_id values are consistent across endpoints.
        """
        # Get sessions
        sessions_resp = await seeded_async_client.get("/api/sessions")
        session_ids = {s["session_id"] for s in sessions_resp.json()["sessions"]}

        # Get batches
        batches_resp = await seeded_async_client.get("/api/batches")
        for batch in batches_resp.json():
            assert batch["session_id"] in session_ids, \
                f"Batch {batch['batch_id']} references unknown session {batch['session_id']}"

    @pytest.mark.asyncio
    async def test_agent_values_consistent(self, seeded_async_client: AsyncClient):
        """
        Contract: Agent values are consistent across endpoints.
        """
        conv_resp = await seeded_async_client.get("/api/conversations")

        for conv in conv_resp.json():
            agent = conv["agent"]
            assert agent in VALID_AGENTS, \
                f"Conversation {conv['conversation_id']} has invalid agent '{agent}'"


# ============================================================================
# Negative Contract Tests
# ============================================================================

class TestNegativeContract:
    """Contract tests for error cases."""

    @pytest.mark.asyncio
    async def test_conversation_not_found_contract(self, seeded_async_client: AsyncClient):
        """
        Contract: GET /api/conversations/{invalid_id} returns 404.
        """
        response = await seeded_async_client.get("/api/conversations/nonexistent-id-12345")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_session_not_found_contract(self, async_client: AsyncClient):
        """
        Contract: GET /api/sessions/current returns 404 when no session exists.
        """
        response = await async_client.get("/api/sessions/current")
        assert response.status_code == 404
