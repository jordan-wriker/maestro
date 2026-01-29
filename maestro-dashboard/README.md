# Maestro Dashboard

A comprehensive dashboard for managing and monitoring agent-based workflows, sessions, and batch tasks.

## Table of Contents
- [Setup](#setup)
- [Architecture](#architecture)
- [Development Guide](#development-guide)
- [Configuration](#configuration)

## Setup

### Prerequisites
- Node.js (v16+)
- npm or yarn

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

Start the development server:
```bash
npm run dev
```
Access the application at `http://localhost:5173`.

## Architecture

This project is built with:
- **Vite**: Fast build tool and dev server.
- **React**: UI library.
- **TypeScript**: Static typing.
- **Tailwind CSS**: Utility-first styling.

### Key Components

- **Sidebar (`src/components/Sidebar.tsx`)**: Main navigation. Configurable via `src/config/constants.ts`.
- **Sessions (`src/pages/Sessions.tsx`)**: Manages work sessions (workspaces).
- **Batch (`src/pages/Batch.tsx`)**: Monitors parallel batch tasks using WebSocket or polling.

### State Management
- **WebSocket Hook (`src/hooks/useWebSocket`)**: Manages real-time connection to the orchestration server.
- **Constants (`src/config/constants.ts`)**: Centralized configuration for UI elements.

## Development Guide

### Adding Navigation Items
Edit `src/config/constants.ts` and update `NAV_ITEMS` or `CONFIG_ITEMS`.

### Customizing Colors
Update `AGENT_COLORS` or `STATUS_CONFIG` in `src/config/constants.ts` to change the appearance of agents and status badges.

### Mock Data
Mock data for development (e.g., initial logs) is stored in `src/config/constants.ts`.

## Configuration

The dashboard connects to an backend API. Ensure the API server is running and accessible (defaulting to the same host via proxy or configured URL).
