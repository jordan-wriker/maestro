# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Agent Orchestrator** system that provides a unified MCP (Model Context Protocol) interface for multiple AI coding agents. It allows Claude Desktop (or other MCP clients) to invoke both Claude Code CLI and Codex CLI agents with session persistence.

### Architecture

**Three-Layer System:**

1. **MCP Server Layer** (`../claude-mcp/index.js`)
   - Node.js MCP server exposing 4 tools: `claude`, `claude-reply`, `codex`, `codex-reply`
   - Forwards requests to Python backend via HTTP
   - Returns responses with session IDs prefixed for visibility

2. **Backend API Layer** (`server.py`)
   - FastAPI server running on port 8000
   - Two endpoints: `/agent/claude` and `/agent/codex`
   - Executes CLI commands via subprocess with proper output parsing
   - Maintains in-memory flight recorder (last 50 calls)

3. **Dashboard UI** (`templates/index.html`)
   - Web interface at `http://localhost:8000`
   - Real-time updates via WebSocket (endpoint: `/ws`)
   - Shows live logs of all agent invocations with raw debug output
   - Auto-reconnects on disconnect

### Session Management

- **Claude CLI**: Returns JSON with `session_id` field, resumed via `--resume=<ID>`
- **Codex CLI**: Returns NDJSON stream with `thread_id`, resumed via `resume <ID> "prompt"`
- Session IDs are returned to MCP client for multi-turn conversations

### Log File Storage

Session logs are persisted to JSON files:
- **Claude logs**: `logs/claude/{session_id}.json`
- **Codex logs**: `logs/codex/{session_id}.json`

Each file contains:
```json
{
  "session_id": "...",
  "agent": "claude|codex",
  "created_at": "HH:MM:SS",
  "logs": [{ ... log entries ... }]
}
```

New sessions create new files; replies append to existing session files.

### Output Parsing

- **Claude**: Expects single JSON object with `{"result": "...", "session_id": "..."}`
- **Codex**: Parses NDJSON events, extracts `thread_id` from `thread.started` and text from `item.completed` events where `item.type == "agent_message"`

## Development Commands

### Start the Backend Server

```bash
python3 server.py
# Or with uvicorn:
uvicorn server:app --reload --port 8000
```

### Install Python Dependencies

```bash
pip install fastapi pydantic jinja2 uvicorn[standard]
```

Note: `uvicorn[standard]` includes WebSocket support.

### Start the MCP Server (for Claude Desktop)

```bash
cd ../claude-mcp
node index.js
```

The MCP server configuration (from `../OLD`) shows it expects:
- Claude CLI at: default PATH
- Codex CLI at: `/home/jaydub/Tools/codex/codex-rs/target/release/codex`

### View Dashboard

```bash
# After starting server.py:
# Navigate to http://localhost:8000
```

## Key Implementation Details

### CLI Command Execution (server.py:26-65)

The `run_cli_command()` function:
- Runs subprocesses with `CI=true` environment variable
- Captures both stdout and stderr
- Updates flight recorder in real-time
- Stores full raw output for debugging

### Error Handling

- Non-zero exit codes trigger Exception with stderr content
- Parse errors are caught separately and logged with raw output
- All errors are visible in dashboard's "Raw Output" dropdown

### Path Configuration

Update `server.py:50` if CLI paths differ:
```python
env={"CI": "true", "PATH": "/usr/local/bin:/usr/bin:/bin"}
```

## Modifying Agent Behavior

To add new agents:
1. Add new tool definitions in `../claude-mcp/index.js` (lines 10-28)
2. Add new route in `server.py` (follow `/agent/claude` pattern)
3. Implement output parser for that agent's format
4. Add handler in MCP server's `CallToolRequestSchema` (lines 50-57)
