# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Orchestrator (Maestro) is a three-tier system for orchestrating multiple AI coding agents (Claude and Codex) with session persistence, batch processing, and real-time monitoring.

## Architecture

```
MCP Client (Claude Desktop/IDE)
         │ MCP Protocol
         ▼
┌─────────────────────────────┐
│  mcp-proxy (Node.js)        │  ← MCP server exposing 6 tools
│  index.js                   │
└─────────────────────────────┘
         │ HTTP (port 8000)
         ▼
┌─────────────────────────────┐
│  mcp-server (Python/FastAPI)│  ← CLI orchestration, session management
│  server.py                  │
│  - Subprocess execution     │
│  - WebSocket broadcasting   │
│  - SQLite logging           │
└─────────────────────────────┘
         │ WebSocket + SQLite
         ▼
┌─────────────────────────────┐
│  mcp-dashboard (Next.js)    │  ← Real-time monitoring UI (port 3000)
│  Prisma + LibSQL            │
└─────────────────────────────┘
```

### Component Responsibilities

**mcp-proxy**: Exposes MCP tools (`claude`, `claude-reply`, `codex`, `codex-reply`, `submit_batch`, `check_batch_status`) and forwards requests to the Python backend.

**mcp-server**: Executes CLI commands via subprocess with `CI=true`, parses agent output (JSON for Claude, NDJSON for Codex), persists session logs to JSON files, and broadcasts updates via WebSocket.

**mcp-dashboard**: Next.js App Router application displaying session logs, batch status, and real-time updates from the WebSocket.

## Development Commands

### Start All Services

```bash
# Terminal 1: Python Backend (required)
cd mcp-server
python3 server.py

# Terminal 2: MCP Proxy (for Claude Desktop integration)
cd mcp-proxy
node index.js

# Terminal 3: Dashboard
cd mcp-dashboard
npm run dev
```

### Dashboard Commands

```bash
cd mcp-dashboard
npm run dev      # Development server (port 3000)
npm run build    # Production build
npm run start    # Run production build
npm run lint     # ESLint
```

### Database (Prisma)

```bash
cd mcp-dashboard
npx prisma migrate dev    # Run migrations
npx prisma studio         # Database GUI
```

### Python Backend

```bash
cd mcp-server
pip install -r requirements.txt
python3 server.py
# Or: uvicorn server:app --reload --port 8000
```

## Key Files

| Path | Purpose |
|------|---------|
| `mcp-proxy/index.js` | MCP tool definitions and HTTP forwarding |
| `mcp-server/server.py` | FastAPI routes, CLI execution, WebSocket |
| `mcp-server/db_logger.py` | SQLite logging to shared database |
| `mcp-dashboard/prisma/schema.prisma` | TaskLog model definition |
| `mcp-dashboard/src/providers/WebSocketProvider.tsx` | Global WebSocket singleton |
| `mcp-dashboard/src/lib/db.ts` | Prisma client initialization |

## Session Management

- **Claude CLI**: Returns JSON with `session_id`, resumed via `--resume=<ID>`
- **Codex CLI**: Returns NDJSON with `thread_id`, resumed via `resume <ID> "prompt"`
- Session logs stored at: `mcp-server/logs/{claude,codex}/{session_id}.json`

## API Endpoints (Python Backend)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/agent/claude` | Execute Claude CLI |
| POST | `/agent/codex` | Execute Codex CLI |
| POST | `/batch/submit` | Start parallel batch |
| POST | `/batch/status` | Poll batch results |
| GET | `/api/sessions/{agent}` | List sessions |
| GET | `/api/sessions/{agent}/{id}` | Get session logs |
| WS | `/ws` | Real-time log updates |

## Database Schema

```prisma
model TaskLog {
  id        Int      @id @default(autoincrement())
  agent     String   // "claude" or "codex"
  prompt    String
  status    String   // "Success", "Error", "Running"
  duration  Int      // milliseconds
  sessionId String
  createdAt DateTime @default(now())
}
```

## Adding a New Agent

1. Add tool definition in `mcp-proxy/index.js`
2. Add route in `mcp-server/server.py` (follow `/agent/claude` pattern)
3. Implement output parser for the agent's format
4. Add handler in MCP server's `CallToolRequestSchema`

## Configuration Notes

- Codex CLI path is hardcoded in `server.py`: `/home/jaydub/Tools/codex/codex-rs/target/release/codex`
- Python backend runs on `http://127.0.0.1:8000`
- Dashboard WebSocket connects to `ws://localhost:8000/ws`
- SQLite database shared at `mcp-dashboard/prisma/dev.db`
