"""
Main application entry point for MCP Server.
Initializes FastAPI app with middleware, CORS, state management, and routing.
"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.core.state import app_state

from app.db import create_db_and_tables, engine
from app.db.models import WorkSession

from app.services.agent_runner import AsyncSubprocessRunner
from app.services.log_storage import LogStorageService
from app.services.websocket_manager import WebSocketManager
from app.services.batch_manager import BatchManager

from app.api.routes import agent, batch, dashboard, websocket

# Configure logging on module import
configure_logging(
    log_level=settings.log_level,
    json_logs=(settings.log_format == "json")
)

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting MCP Server application", 
                host=settings.host, 
                port=settings.port)
    
    # Initialize logs directory
    logs_dir = Path(settings.logs_dir)
    logs_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize Database
    logger.info("Initializing database tables")
    create_db_and_tables()
    
    # Manage active session
    with Session(engine) as session:
        # Get all sessions ordered by updated_at descending
        statement = select(WorkSession).order_by(WorkSession.updated_at.desc())
        all_sessions = session.exec(statement).all()
        
        if not all_sessions:
            # Create default session
            logger.info("No sessions found, creating default session")
            session_id = uuid.uuid4().hex[:8]
            current_session = WorkSession(
                session_id=session_id,
                title="Default Session",
                status="active",
                root_directory=str(Path.cwd()),
                agents=json.dumps([
                    {"name": "Claude", "color": "blue"},
                    {"name": "Codex", "color": "green"}
                ]),
                total_tokens="0",
                last_active=datetime.utcnow().isoformat(),
                is_current_session=True,
                updated_at=datetime.utcnow()
            )
            session.add(current_session)
            session.commit()
            session.refresh(current_session)
            logger.info("Created default session", 
                      session_id=current_session.session_id, 
                      title=current_session.title)
        else:
            # Set most recent as current, clear others
            current_session = all_sessions[0]
            for s in all_sessions:
                s.is_current_session = (s.session_id == current_session.session_id)
            
            session.add_all(all_sessions)
            session.commit()
            session.refresh(current_session)
            logger.info("Selected most recently active session as current", 
                      session_id=current_session.session_id)
        
        # Store in app state
        await app_state.set_current_session_id(current_session.session_id)
    
    # Initialize Services
    agent_runner = AsyncSubprocessRunner()
    log_storage = LogStorageService(app_state)
    websocket_manager = WebSocketManager(app_state)
    batch_manager = BatchManager(app_state, agent_runner)
    
    # Store in app.state for dependency injection
    app.state.agent_runner = agent_runner
    app.state.log_storage = log_storage
    app.state.websocket_manager = websocket_manager
    app.state.batch_manager = batch_manager
    
    # Load existing logs into memory
    await log_storage.load_logs_from_files()
    
    logger.info("Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down MCP Server application")
    # Cleanup tasks here if needed
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application.
    
    Returns:
        Configured FastAPI application instance
    """
    app = FastAPI(
        title="Agent Orchestrator MCP Server",
        description="Production-ready MCP server for orchestrating Claude and Codex agents",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )
    
    # Configure CORS
    origins = [origin.strip() for origin in settings.cors_origins.split(",")]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add application state to app
    app.state.app_state = app_state
    
    # Include Routers
    app.include_router(agent.router)
    app.include_router(batch.router)
    app.include_router(dashboard.router)
    app.include_router(websocket.router)
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "version": "1.0.0",
            "service": "mcp-server"
        }


    
    # Mount static files for dashboard if available
    dashboard_dir = Path(settings.dashboard_dir)
    if dashboard_dir.exists() and (dashboard_dir / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(dashboard_dir / "assets")), name="static")
        logger.info("Dashboard static files mounted", path=str(dashboard_dir))
    
    # SPA Catch-all Route (must be last)
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Catch-all route to serve the SPA for any non-API routes."""
        # Skip API and WebSocket routes
        if full_path.startswith("api/") or full_path.startswith("agent/") or full_path.startswith("batch/") or full_path == "ws":
            return {"error": "Not found"}, 404

        # Serve index.html for SPA routing
        index_file = dashboard_dir / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))

        # Fallback: if dashboard not built
        return {"message": "Dashboard not built. Run 'npm run build' in maestro-dashboard/"}

    logger.info("FastAPI application created and configured")
    
    return app


# Create the application instance
app = create_app()





if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
