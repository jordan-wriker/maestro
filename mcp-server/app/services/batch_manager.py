import asyncio
from typing import List, Dict, Any, Optional
from server import BatchTask  # Importing from server.py as per plan
from app.core.state import AppState
from app.core.logging import get_logger
from app.services.agent_runner import AgentRunner
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
        
        try:
            # Create TaskGroup for concurrent execution
            # using new Python 3.11+ syntax 
            # (assuming Py3.11+, if older we'd use asyncio.gather)
            # The prompt mentions "Use `async with asyncio.TaskGroup() as tg:`"
            async with asyncio.TaskGroup() as tg:
                for task in tasks:
                    tg.create_task(self._execute_single_task(batch_id, task, pwd))
                    
        except ExceptionGroup as e:
            # TaskGroup raises ExceptionGroup if any task fails
            # We log it but individual tasks handle their own errors/status updates
            logger.error(
                "Batch execution completed with errors", 
                batch_id=batch_id, 
                error_count=len(e.exceptions)
            )

    async def _execute_single_task(self, batch_id: str, task: BatchTask, pwd: str) -> None:
        """
        Execute a single task and update state.
        """
        logger.debug("Starting task execution", batch_id=batch_id, task_id=task.id, agent=task.agent)
        
        # 1. Update status to running
        await self.app_state.update_batch_task(batch_id, task.id, {"status": "running"})
        
        result_payload = {
            "text": "",
            "session_id": task.session_id,
            "error": None
        }
        
        try:
            # 2. Run Agent
            args = []
            if task.agent == "claude":
                args = ["--print", "--output-format=json", "--dangerously-skip-permissions", "--verbose"]
                if task.session_id: args.append(f"--resume={task.session_id}")
                args.append(task.instruction)
            else: # codex
                args = ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check"]
                if task.session_id:
                    args.extend(["resume", task.session_id, task.instruction])
                else:
                    args.append(task.instruction)
            
            stdout, stderr, exit_code = await self.agent_runner.run_agent(task.agent, args, pwd)
            
            # 3. Parse Output
            final_text = ""
            session_id = task.session_id
            
            if exit_code != 0:
                # Handle non-zero exit: mark as failed
                logger.warning("Task execution failed with non-zero exit code", batch_id=batch_id, task_id=task.id, exit_code=exit_code)
                result_payload["error"] = stderr or f"Process exited with code {exit_code}"
                await self.app_state.update_batch_task(
                    batch_id, 
                    task.id, 
                    {
                        "status": "failed", 
                        "result": result_payload
                    }
                )
                return

            if task.agent == "claude":
                # Basic extraction from stdout for result text
                # Ideally parsers should handle this extraction too to keep DRY
                # but parsers.py functions return list of events.
                # We replicate logic from server.py briefly or enhance parsers if we could
                # but strictly following extraction plan:
                try:
                    import json
                    data = json.loads(stdout)
                    item = next((i for i in (data if isinstance(data, list) else [data]) 
                               if isinstance(i, dict) and "result" in i), {})
                    final_text = item.get("result", "")
                    session_id = item.get("session_id", session_id)
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
                            session_id = ev.get("thread_id")
                        if ev.get("type") == "item.completed" and ev.get("item", {}).get("type") == "agent_message":
                            full_text.append(ev.get("item", {}).get("text", ""))
                    final_text = "".join(full_text)
                except:
                    final_text = stdout

            result_payload["text"] = final_text
            result_payload["session_id"] = str(session_id) if session_id else None
            
            # 4. Update Success
            await self.app_state.update_batch_task(
                batch_id, 
                task.id, 
                {
                    "status": "completed", 
                    "result": result_payload
                }
            )
            logger.info("Task completed successfully", batch_id=batch_id, task_id=task.id)

        except Exception as e:
            # 5. Handle Failure
            logger.error("Task failed", batch_id=batch_id, task_id=task.id, error=str(e))
            result_payload["error"] = str(e)
            await self.app_state.update_batch_task(
                batch_id, 
                task.id, 
                {
                    "status": "failed", 
                    "result": result_payload
                }
            )

    async def get_batch_status(self, batch_id: str) -> Dict[str, Any]:
        """
        Retrieve status of a batch.
        """
        batch = await self.app_state.get_batch(batch_id)
        if not batch:
            return {"error": "Batch not found"}
            
        tasks = await self.app_state.get_batch_tasks(batch_id)
        total = len(tasks)
        completed = sum(1 for t in tasks.values() if t.get("status") in ["completed", "failed"])
        
        status = "pending"
        if completed > 0: status = "running"
        if completed == total and total > 0: status = "completed"
        
        progress = (completed / total * 100) if total > 0 else 0
        
        return {
            "batch_id": batch_id,
            "status": status,
            "progress": progress,
            "tasks": tasks
        }
