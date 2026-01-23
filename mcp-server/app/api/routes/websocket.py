import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.api.deps import get_websocket_manager
from app.services.websocket_manager import WebSocketManager

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    manager: WebSocketManager = Depends(get_websocket_manager)
):
    # Plan: Generate unique client_id
    client_id = str(uuid.uuid4())[:8]
    
    # Handle lifecycle
    # Plan says: "Call websocket_manager.handle_client_lifecycle(client_id, websocket)"
    # This implies the manager has this loop inside it.
    
    try:
        await manager.handle_client_lifecycle(client_id, websocket)
    except WebSocketDisconnect:
        # Manager likely handles this internally or we need to cleanup if it raises
        # But if manager handles lifecycle, it probably catches disconnects or expects caller to ignore
        pass
    except Exception as e:
        # Log error?
        print(f"WebSocket error: {e}")
