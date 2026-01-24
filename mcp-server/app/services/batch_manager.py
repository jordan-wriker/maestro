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
from app.services.log_storage import LogStorageService
import uuid

logger = get_logger(__name__)

class BatchManager:
    """
    Manages batch execution of agent tasks using asyncio TaskGroups.
    """
    
    def __init__(self, app_state: AppState, agent_runner: AgentRunner, log_storage: LogStorageService):
        """
        Initialize BatchManager with dependencies.
        
        Args:
            app_state: Application state container
            agent_runner: Service for running agent commands
            log_storage: Service for logging
        """
        self.app_state = app_state
        self.agent_runner = agent_runner
        self.log_storage = log_storage
        
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
        
        start_time = datetime.now()
        
        # 1. Update status to running in DB
        with Session(engine) as session:
            db_service = DBService(session)
            db_service.update_batch_task(batch_id, task.id, {"status": "running"})
        
        result_payload = {
            "text": "",
            "conversation_id": task.conversation_id,
            "error": None
        }
        
        parsed_events = []
        final_text = ""
        conversation_id = task.conversation_id
        exit_code = 0
        stderr = ""
        
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
            
            logger.debug(
                "Agent execution completed",
                batch_id=batch_id,
                task_id=task.id,
                agent=task.agent,
                exit_code=exit_code,
                stdout_len=len(stdout) if stdout else 0,
                stderr_len=len(stderr) if stderr else 0
            )
            
            # 3. Parse Output
            # 3. Parse Output using standardized parsers
            if task.agent == "claude":
                parsed_events, detected_conv_id = parse_claude_events(stdout, task.instruction)
                if detected_conv_id:
                    conversation_id = detected_conv_id
                    logger.debug(
                        "Conversation ID extracted from Claude output",
                        batch_id=batch_id,
                        task_id=task.id,
                        agent=task.agent,
                        conversation_id=conversation_id
                    )
                
                # Extract final text from the last result or response event
                final_text = ""
                for ev in reversed(parsed_events):
                    if ev["type"] in ["result", "response"]:
                        final_text = ev["content"]
                        break
                if not final_text and not parsed_events:
                     final_text = stdout # Fallback
            
            else: # codex
                parsed_events, detected_conv_id = parse_codex_events(stdout, task.instruction)
                if detected_conv_id:
                    conversation_id = detected_conv_id
                    logger.debug(
                        "Conversation ID extracted from Codex output",
                        batch_id=batch_id,
                        task_id=task.id,
                        agent=task.agent,
                        conversation_id=conversation_id
                    )
                
                # Extract final text
                final_text = ""
                for ev in reversed(parsed_events):
                    if ev["type"] in ["result", "response"]:
                        final_text = ev["content"]
                        break
                if not final_text and not parsed_events:
                     final_text = stdout # Fallback

            logger.debug(
                "Output parsing completed",
                batch_id=batch_id,
                task_id=task.id,
                agent=task.agent,
                event_count=len(parsed_events),
                has_final_text=bool(final_text),
                final_text_len=len(final_text) if final_text else 0
            )

            # Check logic for failure / determine status
            task_status = "completed" if exit_code == 0 else "failed"

            if exit_code != 0:
                logger.warning(
                    "Task finished with non-zero exit code - Task will continue processing despite non-zero exit code",
                    batch_id=batch_id,
                    task_id=task.id,
                    agent=task.agent,
                    exit_code=exit_code,
                    has_stdout=bool(stdout),
                    has_stderr=bool(stderr),
                    event_count=len(parsed_events),
                    has_final_text=bool(final_text)
                )
                # Improve Error Reporting:
                # If stderr is empty but stdout has content, likely the error is in stdout (especially for JSON output)
                error_msg = stderr
                if not error_msg and stdout:
                     # limit length just in case
                     error_msg = f"Check logs for details. Output: {stdout[:500]}..."
                
                result_payload["error"] = error_msg or f"Process exited with code {exit_code}"
                # Do NOT return early - continue to save any partial results/logs
            
            # Ensure we treat error output as content if no other content exists
            if exit_code != 0 and not final_text and result_payload.get("error"):
                final_text = result_payload["error"]

            # Generate UUID if missing but we have content to link results properly
            if not conversation_id and (final_text or parsed_events):
                conversation_id = str(uuid.uuid4())
                logger.debug(
                    "Generated new conversation ID for task results",
                    batch_id=batch_id,
                    task_id=task.id,
                    agent=task.agent,
                    conversation_id=conversation_id,
                    reason="Has content but no ID extracted"
                )

            # If success or partial success, proceed with processing
            result_payload["text"] = final_text
            result_payload["conversation_id"] = str(conversation_id) if conversation_id else None
            
            # 4. Handle DB updates in a single session
            with Session(engine) as session:
                db_service = DBService(session)
                
                # Handle Conversation DB record (Conditional on having ID and some content)
                has_conv_id = bool(conversation_id)
                has_content_db = bool(final_text or parsed_events)
                will_create_or_update = has_conv_id and has_content_db
                
                logger.debug(
                    "Evaluating conversation record creation/update",
                    batch_id=batch_id,
                    task_id=task.id,
                    agent=task.agent,
                    has_conversation_id=has_conv_id,
                    has_content=has_content_db,
                    will_create_or_update=will_create_or_update
                )

                if will_create_or_update:
                    existing = db_service.get_conversation(str(conversation_id))
                    conv_status = "completed" if exit_code == 0 else "failed"

                    if not existing:
                        logger.debug(
                            "Creating new conversation record",
                            batch_id=batch_id,
                            task_id=task.id,
                            agent=task.agent,
                            conversation_id=str(conversation_id),
                            status=conv_status
                        )
                        db_service.create_conversation({
                            "conversation_id": str(conversation_id),
                            "session_id": session_id,
                            "batch_id": batch_id,
                            "agent": task.agent,
                            "status": conv_status,
                            "prompt": task.instruction,
                            "response": final_text,
                            "created_at": datetime.utcnow(),
                            "last_activity": datetime.utcnow()
                        })
                    else:
                        logger.debug(
                            "Updating existing conversation record",
                            batch_id=batch_id,
                            task_id=task.id,
                            agent=task.agent,
                            conversation_id=str(conversation_id),
                            status=conv_status
                        )
                        db_service.link_conversation_to_batch(str(conversation_id), batch_id)
                        db_service.update_conversation(str(conversation_id), {
                            "status": conv_status,
                            "response": final_text,
                            "last_activity": datetime.utcnow()
                        })
                else:
                    logger.debug(
                        "Skipping conversation record (no ID or no content)",
                        batch_id=batch_id,
                        task_id=task.id,
                        agent=task.agent,
                        has_conversation_id=has_conv_id,
                        has_final_text=bool(final_text),
                        has_parsed_events=bool(parsed_events)
                    )

                # Update Task Status
                db_service.update_batch_task(batch_id, task.id, {"status": task_status, "result": result_payload})
                db_service.increment_batch_progress(batch_id)

            # 5. Save Log to File (Conditional on having content)
            has_content_log = bool(final_text or parsed_events)
            logger.debug(
                "Evaluating log file creation",
                batch_id=batch_id,
                task_id=task.id,
                agent=task.agent,
                has_final_text=bool(final_text),
                has_parsed_events=bool(parsed_events),
                will_save_log=has_content_log
            )

            if has_content_log:
                # We need to construct a log entry similar to what agent.py does
                duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                
                # If we don't have a conversation ID yet, generate one for the log filename
                log_conversation_id = conversation_id or str(uuid.uuid4())
                is_new = not bool(task.conversation_id) # roughly speaking

                logger.debug(
                    "Saving log file for task",
                    batch_id=batch_id,
                    task_id=task.id,
                    agent=task.agent,
                    conversation_id=str(log_conversation_id),
                    is_new=is_new,
                    duration_ms=duration_ms
                )

                log_entry = {
                    "id": int(datetime.now().timestamp() * 1000),
                    "timestamp": datetime.now().isoformat(),
                    "status": "Completed" if exit_code == 0 else "Failed",
                    "agent": task.agent,
                    "task": task.instruction,
                    "details": f"Batch execution. Exit code: {exit_code}." + (f" Error: {result_payload['error']}" if result_payload.get('error') else ""),
                    "events": parsed_events,
                    "conversation_id": log_conversation_id,
                    "final_response": final_text,
                    "session_id": session_id
                }
                
                await self.log_storage.save_log_to_file(
                    task.agent, 
                    str(log_conversation_id), 
                    log_entry, 
                    is_new
                )
                
                # Also log to DB via log_storage for consistency
                with Session(engine) as session:
                    db_service = DBService(session)
                    await self.log_storage.log_to_database(
                        task.agent, 
                        task.instruction, 
                        log_entry["status"], 
                        duration_ms, 
                        str(log_conversation_id), 
                        session_id, 
                        db_service
                    )
            else:
                logger.debug(
                    "Skipping log file creation (no content)",
                    batch_id=batch_id,
                    task_id=task.id,
                    agent=task.agent,
                    has_final_text=bool(final_text),
                    has_parsed_events=bool(parsed_events)
                )
            
            log_method = logger.info if exit_code == 0 else logger.warning
            log_method(
                f"Task finished with status: {task_status}",
                batch_id=batch_id,
                task_id=task.id,
                agent=task.agent,
                exit_code=exit_code,
                results_saved=bool(final_text or parsed_events),
                conversation_saved=will_create_or_update,
                log_file_saved=has_content_log
            )

        except Exception as e:
            # 6. Handle Catastrophic Failure (Crash in runner or parser)
            # 5. Handle Failure
            logger.error("Task failed", batch_id=batch_id, task_id=task.id, agent=task.agent, error=str(e))
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
