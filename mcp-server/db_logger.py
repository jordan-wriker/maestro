"""
Database logger module for logging agent requests to SQLite.

This module provides a function to log agent requests to a SQLite database
that is shared with the mcp-dashboard (Prisma).
"""

import sqlite3
from pathlib import Path
from datetime import datetime


def log_request_to_db(agent: str, prompt: str, status: str, duration: int, conversation_id: str) -> None:
    """
    Log a request to the SQLite database.

    Args:
        agent: The agent name (e.g., "claude", "codex")
        prompt: The prompt/instruction sent to the agent
        status: The status of the request (e.g., "success", "error")
        duration: The duration of the request in milliseconds
        conversation_id: The conversation ID for the agent conversation
    """
    # Resolve the path to dev.db relative to this file's location
    # db_logger.py is in mcp-server/, dev.db is in ../mcp-dashboard/prisma/dev.db
    db_path = Path(__file__).parent.parent / "mcp-dashboard" / "prisma" / "dev.db"

    # If the database doesn't exist yet, skip logging
    # (Database will be created when Prisma migration runs)
    if not db_path.exists():
        return

    conn = None
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Insert into TaskLog table
        # Fields: id (auto), agent, prompt, status, duration, conversationId, createdAt
        cursor.execute(
            """
            INSERT INTO TaskLog (agent, prompt, status, duration, conversationId, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (agent, prompt, status, duration, conversation_id, datetime.utcnow().isoformat())
        )

        conn.commit()
    except sqlite3.Error:
        # Silently fail if database operations fail
        # The main application should continue even if logging fails
        pass
    finally:
        if conn:
            conn.close()
