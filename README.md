# Maestro MCP Server

![Maestro Architecture](maestro.png)

Maestro is a specialized MCP server designed to orchestrate complex coding tasks by leveraging the Antigravity IDE and Gemini 3 Pro. It acts as a bridge between high-level planning and low-level execution, enabling efficient parallel processing of tasks.

## Architecture

The application consists of three main components:

1.  **Node.js Proxy (`mcp-proxy`)**: This component exposes the MCP tools to the client (e.g., the IDE or agent). It handles tool calls and proxies them to the Python backend.
2.  **Python Backend (`mcp-server`)**: A robust backend that handles the actual execution of sub-agents. It performs headless CLI calls to invoke agents (like Claude or Codex) and manages session persistence and batch processing.
3.  **Next.js Frontend (`mcp-dashboard`)**: A user interface for monitoring active sessions, viewing detailed logs, and tracking the progress of batch tasks.

## Purpose

The primary goal of Maestro is to enable advanced agentic workflows. We use Gemini 3 Pro's logic and large context capabilities to:
1.  **Plan**: Analyze feature requests or bug reports to create comprehensive implementation plans.
2.  **Batch**: Break down these plans into smaller, parallel-safe batches of tasks.
3.  **Orchestrate**: Execute these batches using Maestro, which manages the concurrent running of sub-agents to complete the work efficiently.

## MCP Tools

Maestro exposes 6 powerful tools for agent orchestration:

### Agent Session Management

These tools allow for direct interaction with specific sub-agents.

#### `claude`
*   **Description**: Starts a NEW session with the Claude agent.
*   **Inputs**:
    *   `prompt` (string): The initial instruction for the agent.

#### `claude-reply`
*   **Description**: Resumes an existing Claude session, maintaining context.
*   **Inputs**:
    *   `prompt` (string): The follow-up instruction.
    *   `session_id` (string): The ID of the session to resume.

#### `codex`
*   **Description**: Starts a NEW session with the Codex agent.
*   **Inputs**:
    *   `prompt` (string): The initial instruction for the agent.

#### `codex-reply`
*   **Description**: Resumes an existing Codex session.
*   **Inputs**:
    *   `prompt` (string): The follow-up instruction.
    *   `session_id` (string): The ID of the session to resume.

### Batch Processing

These tools enable the execution of multiple tasks in parallel, significantly speeding up complex workflows.

#### `submit_batch`
*   **Description**: Submits a list of tasks to be run in parallel on the server.
*   **Inputs**:
    *   `tasks` (array of objects):
        *   `id` (string): Unique identifier for the task (e.g., 'task_1').
        *   `agent` (string): The agent to use ('claude' or 'codex').
        *   `instruction` (string): The prompt for the agent.
        *   `session_id` (string, optional): Session ID to resume if applicable.

#### `check_batch_status`
*   **Description**: Polls for the status of a submitted batch. It uses an acknowledgment mechanism to ensure results are processed only once.
*   **Inputs**:
    *   `batch_id` (string): The ID returned by `submit_batch`.
    *   `ack_task_ids` (array of strings): List of task IDs successfully received in the previous poll (prevents re-sending completed results).
