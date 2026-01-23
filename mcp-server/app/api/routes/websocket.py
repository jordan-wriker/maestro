import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time log updates."""
    client_id = str(uuid.uuid4())[:8]
    
    # Access websocket_manager directly from app state
    # WebSocket endpoints don't support Depends() with request-based dependencies
    manager = websocket.app.state.websocket_manager
    
    try:
        await manager.handle_client_lifecycle(client_id, websocket)
    except WebSocketDisconnect:
        logger.info(f"WebSocket client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
