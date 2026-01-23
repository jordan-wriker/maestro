# Agent Orchestrator Refactor Proposal

## Executive Summary
The current backend implementation (`mcp-server/server.py`) functions as a prototype but suffers from critical architectural issues that limit particular scalability, reliability, and testability. After a deep analysis and consultation with Senior Technical Leads (Maestro Claude & Maestro Codex), we propose a comprehensive refactor to transition the codebase to a production-ready state.

## Current State Analysis
- **Professionalism (4/10)**: The codebase relies on global mutable state and "script-like" patterns rather than improper application architecture.
- **Readability (3/10)**: A single 740-line "God Object" file mixes HTTP routing, complex text parsing, thread management, and business logic, creating high cognitive load.
- **Manageability (2/10)**: The system cannot be unit tested effectively. Critical race conditions exist that will cause data corruption under load.

## Critical Issues Identified
1.  **Data Corruption (Race Condition)**:
    -   *Issue*: The server blindly updates `call_history[0]` (the most recent log) when a task finishes.
    -   *Impact*: If two requests occur simultaneously, the first request's completion will overwrite the second request's log entry.
2.  **Server Blocking**:
    -   *Issue*: Uses `subprocess.run` which blocks the main thread.
    -   *Impact*: The server cannot handle concurrent requests effectively; long-running agent tasks freeze other operations.
3.  **Fragile State**:
    -   *Issue*: Global variables (`call_history`, `batches`) are used for state.
    -   *Impact*: Makes testing impossible and prevents future scaling (e.g., moving to a database).

## Refactoring Recommendations

We have validated these recommendations with multiple architectural reviews. They are necessary to achieve a Professionalism score of >8/10.

### 1. Architectural Restructuring
Move from a single file to a standard Python package structure (`app/`).
-   **`app/api/`**: strict separation of HTTP routes.
-   **`app/services/`**: isolated logic for running agents and parsing output.
-   **`app/core/`**: configuration and global state management.

### 2. Concurrency Model Update
-   **Adopt AsyncIO**: Replace blocking `subprocess.run` with `asyncio.create_subprocess_exec`.
-   **Thread Safety**: Implement proper locking or async-safe data structures for in-memory state.

### 3. Reliability & Observability Improvements
-   **Structured Logging**: Implement `structlog` for machine-readable JSON logs (crucial for debugging agent interactions).
-   **Resilience**: Use `tenacity` library to add retries and timeouts to brittle CLI calls.

## Implementation Plan

### Phase 1: Foundation
1.  Initialize `app` package structure.
2.  Create `AppState` class to encapsulate global variables.
3.  Implement `structlog` configuration.

### Phase 2: Core Services
1.  Implement `AgentRunner` protocol and concrete `AsyncSubprocessRunner`.
2.  Move parsing logic (`parse_claude_events`, etc.) to pure functions in `services/parsers.py`.
3.  Refactor Batch processing to usage `BatchManager` class.

### Phase 3: API & Migration
1.  Re-implement FastAPI routes in `api/routes/` using the new services.
2.  Ensure backward compatibility or update frontend API calls if necessary.
3.  Verify fix of race conditions by testing concurrent requests.

## Conclusion
This refactor is not merely cosmetic. It addresses fundamental correctness issues (data corruption) and lays the groundwork for any future feature development. Without these changes, the system remains a fragile prototype unsuitable for reliable agent orchestration.
