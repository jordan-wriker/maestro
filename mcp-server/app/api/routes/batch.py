import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_batch_manager, get_app_state
from app.models.requests import BatchSubmitRequest, BatchStatusRequest
from app.models.responses import BatchSubmitResponse, BatchStatusResponse
from app.services.batch_manager import BatchManager
from app.core.state import AppState

router = APIRouter()

@router.post("/batch/submit", response_model=BatchSubmitResponse)
async def submit_batch(
    request: BatchSubmitRequest,
    batch_manager: BatchManager = Depends(get_batch_manager),
    app_state: AppState = Depends(get_app_state)
):
    batch_id = str(uuid.uuid4())
    
    # Initialize batch in state
    batch_state = {
        "tasks": {t.id: {"status": "pending", "result": None} for t in request.tasks}
    }
    await app_state.create_batch(batch_id, batch_state)
    
    # Launch execution in background
    asyncio.create_task(batch_manager.execute_batch(batch_id, request.tasks, request.pwd))
    
    return BatchSubmitResponse(
        batch_id=batch_id,
        message="Batch submitted successfully"
    )

@router.post("/batch/status", response_model=BatchStatusResponse)
async def get_batch_status(
    request: BatchStatusRequest,
    app_state: AppState = Depends(get_app_state)
):
    if not await app_state.batch_exists(request.batch_id):
        raise HTTPException(status_code=404, detail="Batch not found")
        
    # Process acknowledgments
    # Process acknowledgments
    for task_id in request.ack_task_ids:
        await app_state.update_batch_task(request.batch_id, task_id, {"status": "fetched"})
        
    # Collect new results
    # Assuming get_batch_tasks returns list of dicts
    tasks = await app_state.get_batch_tasks(request.batch_id)
    new_results = []
    
    batch_completed = True
    
    for task_id, task in tasks.items():
        # Check if task is completed/failed but not fetched
        status = task.get("status")
        if status in ["completed", "failed"] and task_id not in request.ack_task_ids: 
             if status != "fetched": # Should rely on status being updated to fetched if acked previously
                 # Construct result with task_id explicit
                 result_item = task.copy()
                 result_item["task_id"] = task_id
                 new_results.append(result_item)
        
        if status not in ["completed", "failed", "fetched"]:
            batch_completed = False

    status = "completed" if batch_completed else "processing"
    
    return BatchStatusResponse(
        batch_id=request.batch_id,
        status=status,
        new_results=new_results
    )
