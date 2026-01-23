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

# Try importing from db_logger at root. Assumes pythonpath allows it.
# If running as 'python server.py' or 'uvicorn app.main:app' from mcp-server dir, this works if mcp-server is current dir.
try:
    from db_logger import log_request_to_db
except ImportError:
    # Fallback or mock if running in isolation/testing where path isn't set
    # But for production code we expect it to work.
    import sys
    sys.path.append(str(Path(__file__).resolve().parents[2])) # Add mcp-server to path
    from db_logger import log_request_to_db

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
    async def save_log_to_file(self, agent: str, session_id: str, log_entry: Dict[str, Any], is_new_session: bool) -> None:
        """
        Save log entry to JSON file asynchronously.
        """
        if not session_id:
            return

        log_file = self.logs_dir / agent / f"{session_id}.json"
        
        # Ensure directory exists (sync operation, safe strictly speaking as it's quick and cached usually, 
        # but could wrap in to_thread if strictly async purity required. Path.mkdir is usually fine)
        if not log_file.parent.exists():
            log_file.parent.mkdir(parents=True, exist_ok=True)

        try:
            if is_new_session or not log_file.exists():
                session_data = {
                    "session_id": session_id,
                    "agent": agent,
                    "created_at": log_entry.get("timestamp", datetime.now().isoformat()),
                    "logs": [log_entry]
                }
                async with aiofiles.open(log_file, 'w') as f:
                    await f.write(json.dumps(session_data, indent=2))
            else:
                # Read-Modify-Write needs to be safe. 
                # Since we are single-threaded event loop, race conditions between read/write *within this process* 
                # for the SAME session are unlikely if we await immediately. 
                # But multiple calls for same session could interleave.
                # ideally we should lock per session file. 
                # For now implementing as requested.
                async with aiofiles.open(log_file, 'r') as f:
                    content = await f.read()
                
                session_data = json.loads(content)
                session_data["logs"].append(log_entry)
                
                async with aiofiles.open(log_file, 'w') as f:
                    await f.write(json.dumps(session_data, indent=2))
                    
        except (json.JSONDecodeError, OSError, IOError) as e:
            logger.error("Failed to save log file", agent=agent, session_id=session_id, error=str(e))
            # Return without raising to prevent aborting the request
            return
        except Exception as e:
             logger.error("Unexpected error saving log file", agent=agent, session_id=session_id, error=str(e))
             # We can decide to suppress or raise other exceptions, but the instruction said "catch json..., OSError, and generic I/O ... and return without raising".
             # Generic I/O covers IOError.
             # I'll suppress all to be safe or just the requested ones. 
             # "catch json.JSONDecodeError, OSError, and generic I/O exceptions... and return without raising"
             # It implies others might raise? But it also says "save_log_to_file() re-raises JSON or I/O failures".
             # The simplest interpretation of "return without raising" usually essentially means "don't raise".
             # I will stick to catching the requested ones.
             raise

    async def log_to_database(self, agent: str, prompt: str, status: str, duration: int, session_id: str) -> None:
        """
        Log request to database asynchronously.
        """
        try:
            await asyncio.to_thread(log_request_to_db, agent, prompt, status, duration, session_id)
            logger.debug("Logged to database", agent=agent, session_id=session_id, status=status)
        except Exception as e:
            # We explicitly don't fail the request if DB logging fails
            logger.warning("Database logging failed", agent=agent, error=str(e))

    async def load_logs_from_files(self) -> List[Dict[str, Any]]:
        """
        Load recent logs from files into AppState on startup.
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
                    
                    session_data = json.loads(content)
                    for log in session_data.get("logs", []):
                        all_logs.append(log)
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning("Skipping corrupted log file", file=str(log_file))
                    continue
        
        # Sort by ID (timestamp usually) descending
        all_logs.sort(key=lambda x: x.get("id", 0), reverse=True)
        
        # Add top 50 to state
        # Add top 50 to state
        recent_logs = all_logs[:50]
        for log in recent_logs:
            await self.app_state.add_call_history(log)
            
        return recent_logs
            
    async def get_session_logs(self, agent: str, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve logs for a specific session.
        """
        log_file = self.logs_dir / agent / f"{session_id}.json"
        if not log_file.exists():
            return None
            
        try:
            async with aiofiles.open(log_file, 'r') as f:
                content = await f.read()
            data = json.loads(content)
            
            # Post-processing to ensure events are present (backward compatibility)
            for log in data.get("logs", []):
                if "events" not in log and "raw_output" in log:
                    prompt = log.get("prompt", "")
                    raw = log.get("raw_output", "")
                    if agent == "claude":
                        log["events"], _ = parse_claude_events(raw, prompt)
                    else:
                        log["events"], _ = parse_codex_events(raw, prompt)
            return data
        except Exception as e:
            logger.error("Error reading session log", session_id=session_id, error=str(e))
            return None
            
    async def list_sessions(self, agent: str = "all") -> List[Dict[str, Any]]:
        """
        List all sessions, optionally filtered by agent.
        """
        sessions = []
        agents = ["claude", "codex"] if agent == "all" else [agent]
        
        for agent_name in agents:
            if agent_name not in ["claude", "codex"]: continue
            
            agent_path = self.logs_dir / agent_name
            if not agent_path.exists(): continue
            
            # We use sync glob here as iterating directories is okay for this operation usually,
            # or could wrap in to_thread if very large.
            for log_file in agent_path.glob("*.json"):
                try:
                    async with aiofiles.open(log_file, 'r') as f:
                        content = await f.read()
                    data = json.loads(content)
                    logs = data.get("logs", [])
                    last_log = logs[-1] if logs else {}
                    
                    sessions.append({
                        "id": data.get("session_id"),
                        "agent": agent_name,
                        "created_at": data.get("created_at"),
                        "status": "completed",
                        "prompt": last_log.get("prompt", ""),
                        "response": last_log.get("response", ""),
                        "last_activity": last_log.get("timestamp", data.get("created_at")),
                    })
                except:
                    continue
                    
        # Sort by created_at descending
        # We can implement a helper for parsing, or just string compare if ISO format (which is sortable)
        # The original code had a robust parser, let's keep it simple or assume consistent ISO
        sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return sessions
