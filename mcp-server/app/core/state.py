"""
Application state management module.
Provides thread-safe state container for application-wide data.
"""
import asyncio
from typing import Dict, Any, List, Optional
from collections import deque
from datetime import datetime


class AppState:
    """
    Thread-safe singleton state container for the application.
    Manages call history, batch execution state, and connected WebSocket clients.
    """
    
    def __init__(self):
        """Initialize application state with thread-safe structures."""
        # Flight recorder: stores last 50 API calls
        self._call_history: deque = deque(maxlen=50)
        self._call_history_lock = asyncio.Lock()
        
        # Batch execution tracking
        self._batches: Dict[str, Dict[str, Any]] = {}
        self._batches_lock = asyncio.Lock()
        
        # WebSocket client connections (client_id -> WebSocket)
        self._connected_clients: Dict[str, Any] = {}
        self._clients_lock = asyncio.Lock()
    
    # Call History Management
    async def add_call_history(self, entry: Dict[str, Any]) -> None:
        """Add an entry to call history (thread-safe)."""
        async with self._call_history_lock:
            self._call_history.appendleft(entry)
    
    async def get_call_history(self) -> List[Dict[str, Any]]:
        """Get a copy of call history (thread-safe)."""
        async with self._call_history_lock:
            return list(self._call_history)
    
    async def update_latest_call(self, updates: Dict[str, Any]) -> None:
        """Update the most recent call history entry (thread-safe). DEPRECATED, use update_call_by_id."""
        async with self._call_history_lock:
            if self._call_history:
                self._call_history[0].update(updates)

    async def update_call_by_id(self, log_id: Any, updates: Dict[str, Any]) -> None:
        """Update a specific call history entry by ID (thread-safe)."""
        async with self._call_history_lock:
            for entry in self._call_history:
                if entry.get("id") == log_id:
                    entry.update(updates)
                    break
    
    # Batch Management
    async def create_batch(self, batch_id: str, batch_data: Dict[str, Any]) -> None:
        """Create a new batch (thread-safe)."""
        async with self._batches_lock:
            self._batches[batch_id] = batch_data
    
    async def get_batch(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """Get batch data (thread-safe)."""
        async with self._batches_lock:
            return self._batches.get(batch_id)
    
    async def update_batch_task(
        self, 
        batch_id: str, 
        task_id: str, 
        updates: Dict[str, Any]
    ) -> None:
        """Update a specific task in a batch (thread-safe)."""
        async with self._batches_lock:
            if batch_id in self._batches:
                if "tasks" in self._batches[batch_id]:
                    if task_id in self._batches[batch_id]["tasks"]:
                        self._batches[batch_id]["tasks"][task_id].update(updates)
    
    async def batch_exists(self, batch_id: str) -> bool:
        """Check if batch exists (thread-safe)."""
        async with self._batches_lock:
            return batch_id in self._batches
    
    async def get_batch_tasks(self, batch_id: str) -> Dict[str, Any]:
        """Get all tasks for a batch (thread-safe)."""
        async with self._batches_lock:
            if batch_id in self._batches:
                return self._batches[batch_id].get("tasks", {}).copy()
            return {}
    
    # WebSocket Client Management
    async def add_client(self, client_id: str, websocket: Any) -> None:
        """Add a WebSocket client (thread-safe)."""
        async with self._clients_lock:
            self._connected_clients[client_id] = websocket
    
    async def remove_client(self, client_id: str) -> None:
        """Remove a WebSocket client (thread-safe)."""
        async with self._clients_lock:
            if client_id in self._connected_clients:
                del self._connected_clients[client_id]
    
    async def get_all_clients(self) -> Dict[str, Any]:
        """Get all connected clients (thread-safe)."""
        async with self._clients_lock:
            return self._connected_clients.copy()
    
    async def get_client_count(self) -> int:
        """Get the number of connected clients (thread-safe)."""
        async with self._clients_lock:
            return len(self._connected_clients)


# Global application state instance
app_state = AppState()
