import React, { createContext, useEffect, useState } from "react";

export interface LogEntry {
    id: number;
    timestamp: string;
    agent: string;
    command: string;
    prompt: string;
    session_id?: string;
    status: string;
    response: string;
    raw_output?: string;
    events?: unknown[];
}

interface WebSocketContextType {
    logs: LogEntry[];
    isConnected: boolean;
    connectionError: string | null;
}

export const WebSocketContext = createContext<WebSocketContextType>({
    logs: [],
    isConnected: false,
    connectionError: null,
});

// --- Singleton WebSocket State (stored on window to survive HMR) ---

interface WebSocketState {
    ws: WebSocket | null;
    logs: LogEntry[];
    isConnected: boolean;
    connectionError: string | null;
    subscribers: Set<() => void>;
    url: string;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
}

declare global {
    interface Window {
        __WS_STATE__?: WebSocketState;
    }
}

// Determine WebSocket URL based on environment
function getWebSocketUrl(): string {
    // In development (Vite dev server), connect to the backend on port 8000
    // In production (served by Python backend), use the same host
    const isDev = import.meta.env.DEV;
    if (isDev) {
        return `ws://localhost:8000/ws`;
    }
    // In production, use the current host (dashboard is served from Python backend)
    return `ws://${window.location.host}/ws`;
}

function getState(): WebSocketState {
    if (!window.__WS_STATE__) {
        window.__WS_STATE__ = {
            ws: null,
            logs: [],
            isConnected: false,
            connectionError: null,
            subscribers: new Set(),
            url: getWebSocketUrl(),
            reconnectTimer: null,
        };
    }
    return window.__WS_STATE__;
}

function notifySubscribers() {
    const state = getState();
    state.subscribers.forEach(sub => sub());
}

function connect() {
    const state = getState();
    if (!state.url) return;

    // Don't connect if already open, connecting, or closing
    if (state.ws) {
        const readyState = state.ws.readyState;
        if (readyState !== WebSocket.CLOSED) {
            console.log(`[WebSocket] Connection exists (state: ${readyState}), skipping`);
            return;
        }
    }

    // Clear any pending reconnect
    if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
    }

    console.log(`[WebSocket] Connecting to ${state.url}...`);
    const ws = new WebSocket(state.url);
    state.ws = ws;

    ws.onopen = () => {
        // Verify this is still our active WebSocket
        if (state.ws !== ws) {
            console.log("[WebSocket] Stale connection opened, closing");
            ws.close();
            return;
        }
        console.log("[WebSocket] Connected");
        state.isConnected = true;
        state.connectionError = null;
        notifySubscribers();
    };

    ws.onmessage = (event) => {
        // Verify this is still our active WebSocket
        if (state.ws !== ws) return;

        try {
            const message = JSON.parse(event.data);
            if (message.type === "log_update" && message.log) {
                const log = message.log;
                const existingIndex = state.logs.findIndex((l) => l.id === log.id);
                if (existingIndex !== -1) {
                    state.logs[existingIndex] = log;
                } else {
                    state.logs = [log, ...state.logs];
                }
                notifySubscribers();
            }
        } catch (err) {
            console.error("[WebSocket] Failed to parse message:", err);
        }
    };

    ws.onerror = (error) => {
        // Verify this is still our active WebSocket
        if (state.ws !== ws) return;
        console.error("[WebSocket] Error:", error);
        state.connectionError = "Connection Failed";
        notifySubscribers();
    };

    ws.onclose = (event) => {
        // Verify this is still our active WebSocket
        if (state.ws !== ws) {
            console.log("[WebSocket] Stale connection closed, ignoring");
            return;
        }

        console.log(`[WebSocket] Disconnected (code: ${event.code})`);
        state.isConnected = false;
        state.ws = null;
        notifySubscribers();

        // Schedule reconnect (if not already scheduled)
        if (!state.reconnectTimer) {
            state.reconnectTimer = setTimeout(() => {
                state.reconnectTimer = null;
                console.log("[WebSocket] Reconnecting...");
                connect();
            }, 3000);
        }
    };
}

// --- Provider Component (just subscribes to the pre-established connection) ---

function ensureConnection() {
    const wsState = getState();
    if (!wsState.ws || wsState.ws.readyState === WebSocket.CLOSED) {
        connect();
    }
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
    const wsState = getState();
    const [state, setState] = useState({
        logs: wsState.logs,
        isConnected: wsState.isConnected,
        connectionError: wsState.connectionError
    });

    useEffect(() => {
        const wsState = getState();

        // Subscribe to singleton updates
        const updateState = () => {
            const s = getState();
            setState({
                logs: [...s.logs],
                isConnected: s.isConnected,
                connectionError: s.connectionError
            });
        };
        wsState.subscribers.add(updateState);

        // Connect immediately (Vite is client-side only)
        ensureConnection();

        // Sync initial state (connection may already be established)
        updateState();

        // Fetch historical logs from DB if we don't have any yet
        if (wsState.logs.length === 0) {
            // API is proxied in development, same origin in production
            fetch("/api/logs")
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        const s = getState();
                        const merged = new Map<number, LogEntry>();
                        (data as LogEntry[]).forEach((entry) => merged.set(entry.id, entry));
                        s.logs.forEach((entry) => merged.set(entry.id, entry));
                        s.logs = Array.from(merged.values()).sort((a, b) => b.id - a.id);
                        updateState();
                    }
                })
                .catch(err => console.error("[WebSocketProvider] Fetch logs failed:", err));
        }

        return () => {
            wsState.subscribers.delete(updateState);
        };
    }, []);

    return (
        <WebSocketContext.Provider value={state}>
            {children}
        </WebSocketContext.Provider>
    );
}
