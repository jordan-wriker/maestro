"""
Main application entry point for MCP Server.
Initializes FastAPI app with middleware, CORS, state management, and routing.
"""
import os
from pathlib import Path
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.core.state import app_state


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
    
    # Load existing logs into memory (optional)
    # await load_logs_from_files()
    
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
    
    # Import and include routers (when implemented)
    # from app.api.routes import router as api_router
    # app.include_router(api_router, prefix="/api")
    
    # Mount static files for dashboard if available
    dashboard_dir = Path(settings.dashboard_dir)
    if dashboard_dir.exists() and (dashboard_dir / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(dashboard_dir / "assets")), name="static")
        logger.info("Dashboard static files mounted", path=str(dashboard_dir))
    
    logger.info("FastAPI application created and configured")
    
    return app


# Create the application instance
app = create_app()


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "mcp-server"
    }


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "service": "Agent Orchestrator MCP Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "docs": "/docs" if settings.debug else "disabled",
            "api": "/api"
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
