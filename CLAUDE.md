# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maestro is an MCP (Model Context Protocol) server that orchestrates multiple AI coding agents (Claude Code CLI and Codex CLI) with session persistence and parallel batch processing support.

## Architecture

**Three-Layer MCP System:**

```
Claude Desktop (MCP Client) ──> mcp-proxy (Node.js) ──> mcp-server (Python/FastAPI)
                                                           |
                                         maestro-dashboard (React) ──> WebSocket
```

1. **`mcp-proxy/` (Node.js)**: Entry point for MCP clients. Exposes 6 tools that proxy to the Python backend via HTTP.
2. **`mcp-server/` (Python/FastAPI)**: Core orchestration backend on port 8000. Runs agent CLI commands via subprocess, manages sessions, handles batch processing with `asyncio.TaskGroup`, and provides WebSocket for real-time updates.
3. **`maestro-dashboard/` (React/Vite)**: Monitoring UI with pages for Dashboard, Sessions, Logs, Tools, Batch, and Settings. Real-time updates via WebSocket.

## Development Commands

### Python Backend (mcp-server)

```bash
# Install dependencies
pip install -r requirements.txt

# Start server (auto-creates SQLite DB on first run)
python3 -m app.main
# Or with uvicorn for hot reload:
uvicorn app.main:app --reload --port 8000

# Environment variables (prefix APP_)
APP_HOST=0.0.0.0 APP_PORT=8000 python3 -m app.main
```

### MCP Proxy (Node.js)

```bash
# Start MCP server (connects to localhost:8000)
node index.js
```

### Dashboard (React)

```bash
cd maestro-dashboard
npm install
npm run dev        # Dev server at http://localhost:5173 (proxies to :8000)
npm run build      # TypeScript build + Vite build
npm run lint       # ESLint
npm run preview    # Preview production build
```

## MCP Tools

The `mcp-proxy/index.js` exposes these tools:

| Tool | Purpose |
|------|---------|
| `claude` | Start NEW Claude session (input: `prompt`) |
| `claude-reply` | Resume Claude session (inputs: `prompt`, `session_id`) |
| `codex` | Start NEW Codex session (input: `prompt`) |
| `codex-reply` | Resume Codex session (inputs: `prompt`, `session_id`) |
| `submit_batch` | Submit parallel tasks (input: `tasks[]` with `id`, `agent`, `instruction`, optional `session_id`) |
| `check_batch_status` | Poll batch status (inputs: `batch_id`, `ack_task_ids[]`) |

## Data Models (SQLModel)

Core models in `mcp-server/app/models/`:
- `WorkSession`: session_id, title, status, agents (JSON), is_current_session
- `Batch`: batch_id, session_id, status, total_tasks, completed_tasks, progress
- `Conversation`: conversation_id, session_id, batch_id, agent, status, prompt, response
- `BatchTaskEntity`: task_id, batch_id, status, result (JSON)

## Session Management

- **Claude CLI**: Returns JSON with `session_id`, resume via `--resume=<ID>`
- **Codex CLI**: Returns NDJSON with `thread_id`, resume via `resume <ID> "prompt"`
- Logs persisted to `logs/claude/{session_id}.json` and `logs/codex/{session_id}.json`

## Key Backend Services

Located in `mcp-server/app/services/`:
- `BatchManager`: Uses `asyncio.TaskGroup` for parallel task execution
- `AgentRunner`: Executes CLI commands with `tenacity` retry logic
- `WebSocketManager`: Broadcasts log updates to connected dashboard clients
- `LogStorageService`: Persists to both files and SQLite DB
- `DBService`: SQLModel ORM operations

## Frontend Type Safety

- TypeScript strict mode enabled
- Zod schemas in `maestro-dashboard/src/schemas/api.ts` are the source of truth for API types
- Virtualization (`react-window`) used for large log lists
