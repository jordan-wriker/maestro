import json
import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime
import aiofiles
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type

from app.core.config import settings
from app.core.state import AppState
from app.core.logging import get_logger
from app.services.parsers import parse_claude_events, parse_codex_events

from app.services.db_service import DBService

logger = get_logger(__name__)

class LogStorageService:
    """
    Service for storing and retrieving logs from files and database.
    """
    
    def __init__(self, app_state: AppState):
        self.app_state = app_state
        # Normalize logs_dir using settings logic if needed, but settings.logs_dir should be string
        self.logs_dir = Path(settings.logs_dir)

    @retry(stop=stop_after_attempt(3), wait=wait_fixed(1), retry=retry_if_exception_type(OSError))
    async def save_log_to_file(self, agent: str, conversation_id: str, log_entry: Dict[str, Any], is_new_session: bool) -> None:
        """
        Save log entry to JSON file asynchronously.
        """
        if not conversation_id:
            return

        log_file = self.logs_dir / agent / f"{conversation_id}.json"
        
        # Ensure directory exists (sync operation, safe strictly speaking as it's quick and cached usually, 
        # but could wrap in to_thread if strictly async purity required. Path.mkdir is usually fine)
        if not log_file.parent.exists():
            log_file.parent.mkdir(parents=True, exist_ok=True)

        try:
            if is_new_session or not log_file.exists():
                conversation_data = {
                    "conversation_id": conversation_id,
                    "agent": agent,
                    "created_at": log_entry.get("timestamp", datetime.now().isoformat()),
                    "logs": [log_entry]
                }
                async with aiofiles.open(log_file, 'w') as f:
                    await f.write(json.dumps(conversation_data, indent=2))
            else:
                # Read-Modify-Write needs to be safe. 
                # Since we are single-threaded event loop, race conditions between read/write *within this process* 
                # for the SAME conversation are unlikely if we await immediately. 
                # But multiple calls for same conversation could interleave.
                # ideally we should lock per conversation file. 
                # For now implementing as requested.
                async with aiofiles.open(log_file, 'r') as f:
                    content = await f.read()
                
                conversation_data = json.loads(content)
                conversation_data["logs"].append(log_entry)
                
                async with aiofiles.open(log_file, 'w') as f:
                    await f.write(json.dumps(conversation_data, indent=2))
                    
        except (json.JSONDecodeError, OSError, IOError) as e:
            logger.error("Failed to save log file", agent=agent, conversation_id=conversation_id, error=str(e))
            # Return without raising to prevent aborting the request
            return
        except Exception as e:
             logger.error("Unexpected error saving log file", agent=agent, conversation_id=conversation_id, error=str(e))
             # We can decide to suppress or raise other exceptions, but the instruction said "catch json..., OSError, and generic I/O ... and return without raising".
             # Generic I/O covers IOError.
             # I'll suppress all to be safe or just the requested ones. 
             # "catch json.JSONDecodeError, OSError, and generic I/O exceptions... and return without raising"
             # It implies others might raise? But it also says "save_log_to_file() re-raises JSON or I/O failures".
             # The simplest interpretation of "return without raising" usually essentially means "don't raise".
             # I will stick to catching the requested ones.
             raise

    async def log_to_database(self, agent: str, prompt: str, status: str, duration: int, conversation_id: str, session_id: str, db_service: DBService) -> None:
        """
        Log request to database using DBService. Supports upsert for resumed conversations.
        """
        try:
            # Map status strings to database values
            # "Completed" -> "completed", "Failed" -> "error", "Running..." -> "running"
            db_status = status.lower()
            if "running" in db_status:
                db_status = "running"
            elif "failed" in db_status or "error" in db_status:
                db_status = "error"
            elif "completed" in db_status:
                db_status = "completed"

            # Check if conversation exists (for resumed conversations)
            existing_conv = db_service.get_conversation(conversation_id)
            
            if existing_conv:
                # Update existing conversation to link to current session and refresh metadata
                db_service.update_conversation(conversation_id, {
                    "session_id": session_id,
                    "agent": agent,
                    "prompt": prompt,
                    "status": db_status,
                    "last_activity": datetime.utcnow()
                })
                logger.debug("Updated resumed conversation in database", agent=agent, conversation_id=conversation_id, session_id=session_id)
            else:
                # Create new record
                db_service.create_conversation({
                    "conversation_id": conversation_id,
                    "session_id": session_id,
                    "agent": agent,
                    "status": db_status,
                    "prompt": prompt,
                    "response": None,
                    "created_at": datetime.utcnow(),
                    "last_activity": datetime.utcnow()
                })
                logger.debug("Created new conversation in database", agent=agent, conversation_id=conversation_id, session_id=session_id)
        except Exception as e:
            # We explicitly don't fail the request if DB logging fails
            logger.warning("Database logging failed via DBService", agent=agent, conversation_id=conversation_id, error=str(e))

    async def update_conversation_response(self, conversation_id: str, response_text: str, status: str, db_service: DBService) -> None:
        """
        Update conversation record with final response and status.
        """
        try:
            # Map status strings
            db_status = status.lower()
            if "failed" in db_status or "error" in db_status:
                db_status = "error"
            elif "completed" in db_status:
                db_status = "completed"
            
            db_service.update_conversation(conversation_id, {
                "response": response_text,
                "status": db_status,
                "last_activity": datetime.utcnow()
            })
            logger.debug("Updated conversation response in database", conversation_id=conversation_id, status=db_status)
        except Exception as e:
            logger.warning("Failed to update conversation response in database", conversation_id=conversation_id, error=str(e))

    async def load_logs_from_files(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Load recent logs from files into AppState on startup.
        If session_id is provided, only loads logs for that session.
        """
        all_logs = []
        
        for agent_dir in ["claude", "codex"]:
            agent_path = self.logs_dir / agent_dir
            if not agent_path.exists():
                continue
                
            # glob is sync, but fast enough for directory listing usually. 
            # Could use aiofiles.os.scandir? standard glob is fine for startup.
            for log_file in agent_path.glob("*.json"):
                try:
                    async with aiofiles.open(log_file, 'r') as f:
                        content = await f.read()
                    
                    if not content.strip():
                        continue
                        
                    conversation_data = json.loads(content)
                    logs = conversation_data.get("logs", [])
                    if isinstance(logs, list):
                        for log in logs:
                            if isinstance(log, dict):
                                # Ensure session_id exists for older logs
                                log.setdefault("session_id", None)
                                
                                # Filter by session ID if provided
                                if session_id and log.get("session_id") != session_id:
                                    continue
                                    
                                all_logs.append(log)
                except (json.JSONDecodeError, KeyError, Exception) as e:
                    logger.warning(f"Skipping corrupted log file {log_file}: {e}")
                    continue
        
        # Sort by ID (timestamp usually) descending
        all_logs.sort(key=lambda x: x.get("id", 0), reverse=True)
        
        # Add top 50 to state
        # Add top 50 to state
        recent_logs = all_logs[:50]
        for log in recent_logs:
            await self.app_state.add_call_history(log)
            
        return recent_logs
            
    async def get_conversation_logs(self, agent: str, conversation_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve logs for a specific conversation.
        """
        if not conversation_id:
            return None
            
        # Handle cases where conversation_id might already have .json suffix
        safe_id = conversation_id
        if safe_id.endswith(".json"):
            safe_id = safe_id[:-5]
            
        log_file = self.logs_dir / agent / f"{safe_id}.json"
        
        # If not found in specified agent, try finding in any agent folder (fallback)
        if not log_file.exists():
            for possible_agent in ["claude", "codex"]:
                fallback_file = self.logs_dir / possible_agent / f"{safe_id}.json"
                if fallback_file.exists():
                    log_file = fallback_file
                    break
                    
        if not log_file.exists():
            return None
            
        try:
            async with aiofiles.open(log_file, 'r') as f:
                content = await f.read()
            data = json.loads(content)
            
            # Post-processing to ensure events are present (backward compatibility)
            if "logs" in data:
                for log in data.get("logs", []):
                    if "events" not in log and "raw_output" in log:
                        prompt = log.get("prompt", "")
                        raw = log.get("raw_output", "")
                        try:
                            if agent == "claude":
                                log["events"], _ = parse_claude_events(raw, prompt)
                            else:
                                log["events"], _ = parse_codex_events(raw, prompt)
                        except Exception as e:
                            logger.warning(f"Failed to parse internal events for {safe_id}: {e}")
                            log["events"] = []
            return data
        except Exception as e:
            logger.error("Error reading conversation log", conversation_id=conversation_id, error=str(e))
            return None
            
    async def list_conversations(self, agent: str = "all", session_id: Optional[str] = None, db_service: Optional[DBService] = None) -> List[Dict[str, Any]]:
        """
        List all conversations, optionally filtered by agent or session.
        If db_service and session_id are provided, it uses the database.
        """
        if db_service and session_id:
            try:
                db_conversations = db_service.list_conversations_by_session(session_id)
                results = []
                for conv in db_conversations:
                    # Filter by agent if requested
                    if agent != "all" and conv.agent != agent:
                        continue
                        
                    results.append({
                        "conversation_id": conv.conversation_id,
                        "agent": conv.agent,
                        "created_at": conv.created_at.isoformat() if conv.created_at else "",
                        "status": conv.status,
                        "prompt": conv.prompt or "",
                        "response": conv.response or "",
                        "last_activity": conv.last_activity.isoformat() if conv.last_activity else "",
                    })
                return results
            except Exception as e:
                logger.warning(f"Failed to query conversations from database for session {session_id}: {e}")
                # Fall back to file-based listing
        
        conversations = []
        agents_to_check = ["claude", "codex"] if agent == "all" else [agent]
        
        for agent_name in agents_to_check:
            if agent_name not in ["claude", "codex"]: 
                continue
            
            agent_path = self.logs_dir / agent_name
            if not agent_path.exists(): 
                continue
            
            # Use glob to find all json files
            for log_file in agent_path.glob("*.json"):
                try:
                    async with aiofiles.open(log_file, 'r') as f:
                        content = await f.read()
                    
                    if not content.strip():
                        continue
                        
                    data = json.loads(content)
                    logs = data.get("logs", [])
                    
                    # Sources for basic info
                    first_log = logs[0] if logs else {}
                    last_log = logs[-1] if logs else {}
                    
                    # Conversation ID source: 1. data field, 2. filename stem
                    s_id = str(data.get("conversation_id") or log_file.stem)
                    
                    # Prompt source
                    prompt = last_log.get("task") or first_log.get("task") or ""
                             
                    # Response source
                    response = last_log.get("final_response") or ""
                    
                    # Status source
                    status = "completed"
                    log_status = str(last_log.get("status", "completed")).lower()
                    if "error" in log_status or "failed" in log_status:
                        status = "error"
                    elif "running" in log_status:
                        status = "active"
                    
                    conversations.append({
                        "conversation_id": s_id,
                        "agent": str(data.get("agent") or agent_name),
                        "created_at": str(data.get("created_at") or last_log.get("timestamp") or ""),
                        "status": status,
                        "prompt": str(prompt),
                        "response": str(response),
                        "last_activity": str(last_log.get("timestamp") or data.get("created_at") or ""),
                    })
                except Exception as e:
                    logger.debug(f"Skipping log file {log_file}: {e}")
                    continue
                    
        # Sort by last_activity or created_at descending
        conversations.sort(key=lambda x: x.get("last_activity") or x.get("created_at") or "", reverse=True)
        return conversations
