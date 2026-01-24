import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from app.api.deps import get_batch_manager, get_app_state, get_db_service
from app.models.requests import BatchSubmitRequest, BatchStatusRequest
from app.models.responses import BatchSubmitResponse, BatchStatusResponse
from app.services.batch_manager import BatchManager
from app.services.db_service import DBService
from app.core.state import AppState

router = APIRouter()

@router.post("/batch/submit", response_model=BatchSubmitResponse)
async def submit_batch(
    request: BatchSubmitRequest,
    batch_manager: BatchManager = Depends(get_batch_manager),
    app_state: AppState = Depends(get_app_state),
    db_service: DBService = Depends(get_db_service)
):
    batch_id = str(uuid.uuid4())
    
    # Get current session ID
    session_id = await app_state.get_current_session_id()
    if not session_id:
        raise HTTPException(status_code=500, detail="No active session found")
        
    # Create batch record in database
    db_service.create_batch({
        "batch_id": batch_id,
        "session_id": session_id,
        "status": "pending",
        "total_tasks": len(request.tasks),
        "completed_tasks": 0,
        "progress": 0.0
    })
    
    # Create task records in database
    for task in request.tasks:
        db_service.create_batch_task({
            "task_id": task.id,
            "batch_id": batch_id,
            "status": "pending"
        })
    
    # Launch execution in background - stop passing db_service
    asyncio.create_task(batch_manager.execute_batch(batch_id, request.tasks, request.pwd))
    
    return BatchSubmitResponse(
        batch_id=batch_id,
        message="Batch submitted successfully"
    )

@router.post("/batch/status", response_model=BatchStatusResponse)
async def get_batch_status(
    request: BatchStatusRequest,
    db_service: DBService = Depends(get_db_service)
):
    # Query batch from database
    db_batch = db_service.get_batch(request.batch_id)
    if not db_batch:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    # Process acknowledgments in DB
    for task_id in request.ack_task_ids:
        db_service.update_batch_task(request.batch_id, task_id, {"status": "fetched"})
        
    # Collect new results from database
    db_tasks = db_service.get_batch_tasks(request.batch_id)
    new_results = []
    
    for t in db_tasks:
        if t.status in ["completed", "failed"] and t.task_id not in request.ack_task_ids:
            import json
            result_data = None
            if t.result:
                try:
                    result_data = json.loads(t.result)
                except:
                    result_data = t.result
            
            new_results.append({
                "task_id": t.task_id,
                "status": t.status,
                "result": result_data
            })
    
    return BatchStatusResponse(
        batch_id=request.batch_id,
        status=db_batch.status,
        new_results=new_results
    )
