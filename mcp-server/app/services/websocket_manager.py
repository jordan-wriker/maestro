import json
import asyncio
from typing import Dict, Any, List
from fastapi import WebSocket, WebSocketDisconnect
from app.core.state import AppState
from app.core.logging import get_logger

logger = get_logger(__name__)

class WebSocketManager:
    """
    Manages WebSocket connections and broadcasting.
    """
    
    def __init__(self, app_state: AppState):
        """
        Initialize with application state.
        
        Args:
            app_state: Application state container
        """
        self.app_state = app_state
        
    async def connect_client(self, client_id: str, websocket: WebSocket) -> None:
        """
        Handle new client connection.
        """
        await websocket.accept()
        await self.app_state.add_client(client_id, websocket)
        
        count = await self.app_state.get_client_count()
        logger.info("WebSocket client connected", client_id=client_id, total_clients=count)
        
        # Send initial history
        history = await self.app_state.get_call_history()
        # History is deque (via get_call_history converted to list), stored in reverse chronological order?
        # Actually state.py appends left, so [0] is newest.
        # But server.py was iterating call_history to send.
        # Let's send in defined order.
        for log in history:
            await websocket.send_text(json.dumps({"type": "log_update", "log": log}))
            
    async def disconnect_client(self, client_id: str) -> None:
        """
        Handle client disconnection.
        """
        await self.app_state.remove_client(client_id)
        count = await self.app_state.get_client_count()
        logger.info("WebSocket client disconnected", client_id=client_id, total_clients=count)

    async def broadcast_log_update(self, log_entry: Dict[str, Any]) -> None:
        """
        Broadcast log update to all connected clients.
        """
        clients = await self.app_state.get_all_clients()
        if not clients:
            return
            
        message = json.dumps({"type": "log_update", "log": log_entry})
        disconnected = []
        
        for client_id, websocket in clients.items():
            try:
                await websocket.send_text(message)
            except (WebSocketDisconnect, RuntimeError) as e:
                logger.debug("Failed to send to client", client_id=client_id, error=str(e))
                disconnected.append(client_id)
            except Exception as e:
                logger.warning("Unexpected error sending to client", client_id=client_id, error=str(e))
                disconnected.append(client_id)
                
        # Clean up
        for client_id in disconnected:
            await self.disconnect_client(client_id)

    async def get_active_connections(self) -> int:
        """Return count of active connections."""
        return await self.app_state.get_client_count()

    async def cleanup_stale_connections(self) -> None:
        """
        Ping clients to remove unresponsive ones.
        """
        clients = await self.app_state.get_all_clients()
        disconnected = []
        
        for client_id, websocket in clients.items():
            try:
                # We assume a simple ping/pong logic if strictly needed, 
                # but FastAPI WebSockets handle pings automatically often.
                # The plan asks to: send {"type": "ping"}
                await websocket.send_text(json.dumps({"type": "ping"}))
                # We don't block waiting for pong here because that would block broadcasting
                # We rely on send raising error if socket is dead.
            except Exception:
                disconnected.append(client_id)
                
        for client_id in disconnected:
            await self.disconnect_client(client_id)

    async def handle_client_lifecycle(self, client_id: str, websocket: WebSocket) -> None:
        """
        Manage full lifecycle of a client connection within an endpoint.
        """
        try:
            await self.connect_client(client_id, websocket)
            while True:
                # Keep alive loop
                data = await websocket.receive_text()
                # If we expect pong we could parse it here
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "pong":
                        continue
                except:
                    pass
        except WebSocketDisconnect:
            logger.info("Client disconnected normally", client_id=client_id)
        except RuntimeError as e:
             logger.info("Client connection runtime error", client_id=client_id, error=str(e))
        except Exception as e:
            logger.error("WebSocket error", client_id=client_id, error=str(e))
        finally:
            await self.disconnect_client(client_id)
