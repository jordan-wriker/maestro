from typing import Protocol, List, Tuple, Optional
import asyncio
import os
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

class AgentRunner(Protocol):
    """Protocol for agent execution services."""
    async def run_agent(self, agent: str, args: List[str], pwd: Optional[str]) -> Tuple[str, str, int]:
        """
        Run an agent command asynchronously.
        
        Args:
            agent: The agent identifier (e.g., 'claude', 'codex')
            args: List of command line arguments
            pwd: Working directory for the command
            
        Returns:
            Tuple of (stdout, stderr, exit_code)
        """
        ...

class AsyncSubprocessRunner:
    """Implementation of AgentRunner using asyncio subprocesses."""
    
    @retry(
        stop=stop_after_attempt(3), 
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((ConnectionError, IOError, OSError)),
        reraise=True
    )
    async def run_agent(self, agent: str, args: List[str], pwd: Optional[str]) -> Tuple[str, str, int]:
        """
        Execute agent command with retry logic for transient errors.
        """
        cmd_path = settings.claude_cmd if agent == "claude" else settings.codex_cmd
        full_cmd = [cmd_path] + args
        
        logger.info("Executing agent command", agent=agent, command=" ".join(full_cmd), pwd=pwd)
        
        try:
            env = os.environ.copy()
            env["CI"] = "true"
            # Use line buffering for better streaming if we were streaming, 
            # but communicate() handles it all at once here.
            
            process = await asyncio.create_subprocess_exec(
                *full_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=pwd,
                env=env,
                limit=1024 * 1024 * 10 # 10MB buffer limit to prevent deadlocks on large output
            )
            
            try:
                # Wait for process with timeout from settings
                stdout_data, stderr_data = await asyncio.wait_for(
                    process.communicate(), 
                    timeout=settings.batch_timeout
                )
                
                stdout = stdout_data.decode().strip()
                stderr = stderr_data.decode().strip()
                
                if process.returncode != 0:
                    logger.warning(
                        "Agent execution returned non-zero exit code", 
                        agent=agent, 
                        exit_code=process.returncode,
                        stderr=stderr[:200]
                    )
                    # We don't raise here because the caller might handle non-zero exits (e.g. parser errors)
                    # However, if it's a transient OS error, tenacity won't retry unless we raise.
                    # The prompt says: "Do not retry on validation errors or explicit agent failures (exit code != 0)"
                    # So we return result as is.
                
                return stdout, stderr, process.returncode
                
            except asyncio.TimeoutError:
                logger.error("Agent execution timed out", agent=agent, timeout=settings.batch_timeout)
                try:
                    process.kill()
                    await process.wait()
                except ProcessLookupError:
                    pass
                raise
                
        except FileNotFoundError:
            logger.error("Agent binary not found", agent=agent, cmd=cmd_path)
            raise FileNotFoundError(f"Agent binary not found at {cmd_path}. Please check configuration.")
            
        except PermissionError:
            logger.error("Permission denied executing agent", agent=agent, cmd=cmd_path)
            raise PermissionError(f"Permission denied for {cmd_path}. Check file permissions.")
            
        except Exception as e:
            logger.error("Unexpected error in agent execution", agent=agent, error=str(e))
            raise
