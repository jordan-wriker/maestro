import React, { createContext, useEffect, useState } from "react";
import type { WorkSession } from "../types/api";
import type { LogEntry } from "../types/models";
import { api } from "../api/endpoints";

interface WebSocketContextType {
    logs: LogEntry[];
    isConnected: boolean;
    connectionError: string | null;
    currentSession: WorkSession | null;
    setCurrentSession: (session: WorkSession) => void;
    refreshSessions: () => Promise<void>;
}

export const WebSocketContext = createContext<WebSocketContextType>({
    logs: [],
    isConnected: false,
    connectionError: null,
    currentSession: null,
    setCurrentSession: () => { },
    refreshSessions: async () => { },
});

// --- Singleton WebSocket State (stored on window to survive HMR) ---

interface WebSocketState {
    ws: WebSocket | null;
    logs: LogEntry[];
    isConnected: boolean;
    connectionError: string | null;
    currentSession: WorkSession | null;
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
            currentSession: null,
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
                const log = message.log as LogEntry;
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
        connectionError: wsState.connectionError,
        currentSession: wsState.currentSession
    });

    const refreshSessions = async () => {
        try {
            try {
                const session = await api.sessions.getCurrent();
                setCurrentSession(session);
            } catch (err) {
                // If getCurrent fails (e.g. 404), switch to list
                const data = await api.sessions.list();
                if (data.sessions && data.sessions.length > 0) {
                    // Activate the first session found as fallback
                    const fallbackSession = data.sessions[0];
                    try {
                        const activatedSession = await api.sessions.activate(fallbackSession.session_id);
                        setCurrentSession(activatedSession);
                    } catch (activateErr) {
                        // Fallback to just setting it locally if activation fails
                        setCurrentSession(fallbackSession);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to refresh sessions:", error);
        }
    };

    const setCurrentSession = (session: WorkSession) => {
        const wsState = getState();
        const sessionChanged = wsState.currentSession?.session_id !== session.session_id;

        wsState.currentSession = session;

        if (sessionChanged) {
            wsState.logs = [];
            api.logs.list(session.session_id)
                .then(data => {
                    if (Array.isArray(data)) {
                        wsState.logs = data as LogEntry[];
                        notifySubscribers();
                    }
                })
                .catch(err => console.error("Failed to fetch logs for session:", err));
        }

        notifySubscribers();
    };

    useEffect(() => {
        const wsState = getState();

        const updateState = () => {
            const s = getState();
            setState({
                logs: [...s.logs],
                isConnected: s.isConnected,
                connectionError: s.connectionError,
                currentSession: s.currentSession
            });
        };
        wsState.subscribers.add(updateState);

        ensureConnection();
        updateState();

        if (wsState.logs.length === 0 && !wsState.currentSession) {
            refreshSessions();
        } else if (wsState.logs.length === 0 && wsState.currentSession) {
            api.logs.list(wsState.currentSession.session_id)
                .then(data => {
                    if (Array.isArray(data)) {
                        wsState.logs = data as LogEntry[];
                        notifySubscribers();
                    }
                })
                .catch(err => console.error("[WebSocketProvider] Fetch session logs failed:", err));
        }

        return () => {
            wsState.subscribers.delete(updateState);
        };
    }, []);

    return (
        <WebSocketContext.Provider value={{
            ...state,
            setCurrentSession,
            refreshSessions
        }}>
            {children}
        </WebSocketContext.Provider>
    );
}
