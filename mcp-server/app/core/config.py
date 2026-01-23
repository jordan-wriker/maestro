"""
Configuration module for MCP Server application.
Handles environment-based configuration using Pydantic BaseSettings.
"""
import os
from typing import Optional
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Server Configuration
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")
    debug: bool = Field(default=False, description="Debug mode")
    
    # CORS Configuration
    cors_origins: str = Field(default="*", description="Comma-separated CORS origins")
    
    # Logging Configuration
    log_level: str = Field(default="INFO", description="Logging level")
    log_format: str = Field(default="json", description="Log format (json or console)")
    
    # Application Paths
    logs_dir: str = Field(default="logs", description="Directory for storing logs")
    
    @field_validator("logs_dir")
    @classmethod
    def normalize_logs_dir(cls, v: str) -> str:
        """
        Normalize logs_dir to be relative to the repository root if it's a relative path.
        This handles legacy log location compatibility.
        """
        path = Path(v)
        if not path.is_absolute():
            # Get repo root: config.py -> core -> app -> mcp-server -> agent-orchestrator (repo root)
            # config.py is in app/core/config.py
            # __file__ = .../mcp-server/app/core/config.py
            # parents[0] = app/core
            # parents[1] = app
            # parents[2] = mcp-server
            # parents[3] = agent-orchestrator
            repo_root = Path(__file__).resolve().parents[3]
            path = repo_root / path
        return str(path.resolve())

    dashboard_dir: str = Field(default="../maestro-dashboard/dist", description="Dashboard static files directory")
    
    # Agent Configuration
    claude_cmd: str = Field(default="claude", description="Claude CLI command")
    codex_cmd: str = Field(default="codex", description="Codex CLI command")
    
    # Batch Configuration
    max_batch_size: int = Field(default=100, description="Maximum tasks per batch")
    batch_timeout: int = Field(default=3600, description="Batch timeout in seconds")
    
    # WebSocket Configuration
    ws_heartbeat_interval: int = Field(default=30, description="WebSocket heartbeat interval in seconds")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_prefix="APP_"
    )


# Global settings instance
settings = Settings()
