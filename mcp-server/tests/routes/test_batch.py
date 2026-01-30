"""Integration tests for batch API endpoints."""
import pytest
from httpx import AsyncClient
from app.models.responses import BatchResponse, BatchTaskResponse


@pytest.mark.asyncio
async def test_list_batches_empty(async_client: AsyncClient):
    """Test that batches endpoint handles no data gracefully."""
    response = await async_client.get("/api/batches")
    # May return 403 if no session or 200 with empty list
    assert response.status_code in [200, 403]


@pytest.mark.asyncio
async def test_list_batches_returns_data(seeded_async_client: AsyncClient):
    """Test that batches endpoint returns seeded data."""
    response = await seeded_async_client.get("/api/batches")
    assert response.status_code == 200

    batches = response.json()
    assert len(batches) >= 1, "Expected at least 1 seeded batch"


@pytest.mark.asyncio
async def test_batch_response_structure(seeded_async_client: AsyncClient):
    """
    CRITICAL TEST: Validates that BatchResponse structure matches
    what the frontend expects.
    """
    response = await seeded_async_client.get("/api/batches")
    assert response.status_code == 200

    batches = response.json()
    assert len(batches) > 0, "No batches returned - check seeded data"

    for batch in batches:
        # Validate against Pydantic model (will raise ValidationError if fields wrong)
        BatchResponse(**batch)

        # Check required fields explicitly
        assert "batch_id" in batch, f"Missing 'batch_id' field. Has: {list(batch.keys())}"
        assert "session_id" in batch, f"Missing 'session_id' field"
        assert "status" in batch, f"Missing 'status' field"
        assert "total_tasks" in batch, f"Missing 'total_tasks' field"
        assert "completed_tasks" in batch, f"Missing 'completed_tasks' field"
        assert "progress" in batch, f"Missing 'progress' field"
        assert "tasks" in batch, f"Missing 'tasks' field"
        assert "created_at" in batch, f"Missing 'created_at' field"
        assert "updated_at" in batch, f"Missing 'updated_at' field"

        # Validate field types
        assert isinstance(batch["total_tasks"], int), f"total_tasks should be int"
        assert isinstance(batch["completed_tasks"], int), f"completed_tasks should be int"
        assert isinstance(batch["progress"], (int, float)), f"progress should be numeric"
        assert isinstance(batch["tasks"], list), f"tasks should be list"


@pytest.mark.asyncio
async def test_batch_tasks_have_proper_structure(seeded_async_client: AsyncClient):
    """
    CRITICAL TEST: Ensures batch tasks match expected structure.
    """
    response = await seeded_async_client.get("/api/batches")
    assert response.status_code == 200

    batches = response.json()
    assert len(batches) > 0, "No batches to test"

    for batch in batches:
        tasks = batch.get("tasks", [])
        assert isinstance(tasks, list), f"tasks should be a list"

        for task in tasks:
            # Validate against Pydantic model
            BatchTaskResponse(**task)

            # Check expected fields from frontend BatchTaskSchema
            assert "task_id" in task, f"Missing task_id in {task}"
            assert "batch_id" in task, f"Missing batch_id in {task}"
            assert "status" in task, f"Missing status in {task}"

            # result should be properly structured
            if "result" in task and task["result"] is not None:
                assert isinstance(task["result"], dict), \
                    f"result should be dict, got {type(task['result'])}"


@pytest.mark.asyncio
async def test_batch_status_values(seeded_async_client: AsyncClient):
    """Test that batch status values are from expected enum."""
    response = await seeded_async_client.get("/api/batches")
    assert response.status_code == 200

    valid_batch_statuses = {"pending", "running", "completed", "failed"}
    valid_task_statuses = {"pending", "running", "completed", "failed", "fetched"}

    for batch in response.json():
        batch_status = batch.get("status")
        assert batch_status in valid_batch_statuses, \
            f"Invalid batch status '{batch_status}'. Expected one of {valid_batch_statuses}"

        for task in batch.get("tasks", []):
            task_status = task.get("status")
            assert task_status in valid_task_statuses, \
                f"Invalid task status '{task_status}'. Expected one of {valid_task_statuses}"


@pytest.mark.asyncio
async def test_batch_progress_calculation(seeded_async_client: AsyncClient):
    """Test that progress percentage is calculated correctly."""
    response = await seeded_async_client.get("/api/batches")
    assert response.status_code == 200

    for batch in response.json():
        total = batch["total_tasks"]
        completed = batch["completed_tasks"]
        progress = batch["progress"]

        # Progress should be between 0 and 100
        assert 0 <= progress <= 100, f"Progress {progress} out of valid range"

        # If there are tasks, verify calculation
        if total > 0:
            expected_progress = (completed / total) * 100
            assert abs(progress - expected_progress) < 0.1, \
                f"Progress mismatch: expected {expected_progress}, got {progress}"


@pytest.mark.asyncio
async def test_batch_task_result_structure(seeded_async_client: AsyncClient):
    """Test that completed task results have expected structure."""
    response = await seeded_async_client.get("/api/batches")
    assert response.status_code == 200

    for batch in response.json():
        for task in batch.get("tasks", []):
            if task["status"] == "completed" and task.get("result"):
                result = task["result"]
                # Result should have text or conversation_id
                assert isinstance(result, dict), "result should be a dict"
                # Optional: check for expected keys in result
                # These may vary based on agent type
