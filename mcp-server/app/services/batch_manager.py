import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlmodel import Session
from app.db.database import engine
from app.models.requests import BatchTask
from app.core.state import AppState
from app.core.logging import get_logger
from app.services.agent_runner import AgentRunner
from app.services.db_service import DBService
from app.services.parsers import parse_claude_events, parse_codex_events

logger = get_logger(__name__)

class BatchManager:
    """
    Manages batch execution of agent tasks using asyncio TaskGroups.
    """
    
    def __init__(self, app_state: AppState, agent_runner: AgentRunner):
        """
        Initialize BatchManager with dependencies.
        
        Args:
            app_state: Application state container
            agent_runner: Service for running agent commands
        """
        self.app_state = app_state
        self.agent_runner = agent_runner
        
    async def execute_batch(self, batch_id: str, tasks: List[BatchTask], pwd: str) -> None:
        """
        Execute a list of tasks concurrently using asyncio.TaskGroup.
        
        Args:
            batch_id: Unique ID for the batch
            tasks: List of BatchTask objects to execute
            pwd: Working directory for execution
        """
        logger.info("Starting batch execution", batch_id=batch_id, task_count=len(tasks))
        
        # Get session_id from batch record and update status
        with Session(engine) as session:
            db_service = DBService(session)
            db_batch = db_service.get_batch(batch_id)
            if not db_batch:
                logger.error("Batch not found for execution", batch_id=batch_id)
                return
            session_id = db_batch.session_id
            db_service.update_batch(batch_id, {"status": "running"})
            logger.info("Batch status updated to running", batch_id=batch_id, session_id=session_id)
        
        try:
            async with asyncio.TaskGroup() as tg:
                for task in tasks:
                    tg.create_task(self._execute_single_task(batch_id, task, pwd, session_id))
                    
            # After all tasks complete, update final status
            with Session(engine) as session:
                db_service = DBService(session)
                db_service.update_batch(batch_id, {"status": "completed"})
            logger.info("Batch execution completed", batch_id=batch_id)
            
        except ExceptionGroup as e:
            logger.error(
                "Batch execution completed with errors", 
                batch_id=batch_id, 
                error_count=len(e.exceptions)
            )
            with Session(engine) as session:
                db_service = DBService(session)
                db_service.update_batch(batch_id, {"status": "failed"})

    async def _execute_single_task(self, batch_id: str, task: BatchTask, pwd: str, session_id: str) -> None:
        """
        Execute a single task and update state in DB.
        """
        logger.debug("Starting task execution", batch_id=batch_id, task_id=task.id, agent=task.agent)
        
        # 1. Update status to running in DB
        with Session(engine) as session:
            db_service = DBService(session)
            db_service.update_batch_task(batch_id, task.id, {"status": "running"})
        
        result_payload = {
            "text": "",
            "conversation_id": task.conversation_id,
            "error": None
        }
        
        try:
            # 2. Run Agent
            args = []
            if task.agent == "claude":
                args = ["--print", "--output-format=json", "--dangerously-skip-permissions", "--verbose"]
                if task.conversation_id: args.append(f"--resume={task.conversation_id}")
                args.append(task.instruction)
            else: # codex
                args = ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check"]
                if task.conversation_id:
                    args.extend(["resume", task.conversation_id, task.instruction])
                else:
                    args.append(task.instruction)
            
            stdout, stderr, exit_code = await self.agent_runner.run_agent(task.agent, args, pwd)
            
            # 3. Parse Output
            final_text = ""
            conversation_id = task.conversation_id
            
            if exit_code != 0:
                logger.warning("Task execution failed with non-zero exit code", batch_id=batch_id, task_id=task.id, exit_code=exit_code)
                result_payload["error"] = stderr or f"Process exited with code {exit_code}"
                
                with Session(engine) as session:
                    db_service = DBService(session)
                    db_service.update_batch_task(batch_id, task.id, {"status": "failed", "result": result_payload})
                    db_service.increment_batch_progress(batch_id)
                return

            if task.agent == "claude":
                try:
                    import json
                    data = json.loads(stdout)
                    item = next((i for i in (data if isinstance(data, list) else [data]) 
                               if isinstance(i, dict) and "result" in i), {})
                    final_text = item.get("result", "")
                    conversation_id = item.get("conversation_id", conversation_id)
                except:
                    final_text = stdout
            else: # codex
                try:
                    import json
                    full_text = []
                    for line in stdout.splitlines():
                        if not line.strip(): continue
                        ev = json.loads(line)
                        if ev.get("type") == "thread.started": 
                            conversation_id = ev.get("thread_id")
                        if ev.get("type") == "item.completed" and ev.get("item", {}).get("type") == "agent_message":
                            full_text.append(ev.get("item", {}).get("text", ""))
                    final_text = "".join(full_text)
                except:
                    final_text = stdout

            result_payload["text"] = final_text
            result_payload["conversation_id"] = str(conversation_id) if conversation_id else None
            
            # 4. Handle DB updates in a single session
            with Session(engine) as session:
                db_service = DBService(session)
                
                # Handle Conversation DB record
                if conversation_id:
                    existing = db_service.get_conversation(str(conversation_id))
                    if not existing:
                        db_service.create_conversation({
                            "conversation_id": str(conversation_id),
                            "session_id": session_id,
                            "batch_id": batch_id,
                            "agent": task.agent,
                            "status": "completed",
                            "prompt": task.instruction,
                            "created_at": datetime.utcnow(),
                            "last_activity": datetime.utcnow()
                        })
                    else:
                        db_service.link_conversation_to_batch(str(conversation_id), batch_id)
                        db_service.update_conversation(str(conversation_id), {"status": "completed"})

                # Update Success
                db_service.update_batch_task(batch_id, task.id, {"status": "completed", "result": result_payload})
                db_service.increment_batch_progress(batch_id)
            
            logger.info("Task completed successfully", batch_id=batch_id, task_id=task.id)

        except Exception as e:
            # 5. Handle Failure
            logger.error("Task failed", batch_id=batch_id, task_id=task.id, error=str(e))
            result_payload["error"] = str(e)
            with Session(engine) as session:
                db_service = DBService(session)
                db_service.update_batch_task(batch_id, task.id, {"status": "failed", "result": result_payload})
                db_service.increment_batch_progress(batch_id)

    async def get_batch_status(self, batch_id: str) -> Dict[str, Any]:
        """
        Retrieve status of a batch from DB.
        """
        with Session(engine) as session:
            db_service = DBService(session)
            db_batch = db_service.get_batch(batch_id)
            if not db_batch:
                return {"error": "Batch not found"}
            
            db_tasks = db_service.get_batch_tasks(batch_id)
            
            tasks_dict = {}
            for t in db_tasks:
                import json
                result = None
                if t.result:
                    try:
                        result = json.loads(t.result)
                    except:
                        result = t.result
                
                tasks_dict[t.task_id] = {
                    "status": t.status,
                    "result": result
                }
            
            return {
                "batch_id": batch_id,
                "status": db_batch.status,
                "progress": db_batch.progress,
                "tasks": tasks_dict
            }
