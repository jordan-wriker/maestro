import React, { createContext, useEffect, useMemo } from "react";
import type { WorkSession } from "../types/api";
import type { LogEntry } from "../types/models";
import { useSocketConnection } from "../hooks/useSocketConnection";
import { useSessionState } from "../hooks/useSessionState";

interface WebSocketContextType {
    logs: LogEntry[];
    isConnected: boolean;
    connectionError: string | null;
    currentSession: WorkSession | null;
    setCurrentSession: (session: WorkSession) => Promise<void>;
    refreshSessions: () => Promise<void>;
}

export const WebSocketContext = createContext<WebSocketContextType>({
    logs: [],
    isConnected: false,
    connectionError: null,
    currentSession: null,
    setCurrentSession: async () => { },
    refreshSessions: async () => { },
});

// Determine WebSocket URL based on environment
function getWebSocketUrl(): string {
    const isDev = import.meta.env.DEV;
    if (isDev) {
        return `ws://localhost:8000/ws`;
    }
    return `ws://${window.location.host}/ws`;
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
    const wsUrl = useMemo(() => getWebSocketUrl(), []);
    const { socket, isConnected, connectionError } = useSocketConnection(wsUrl);
    const { logs, currentSession, setCurrentSession, refreshSessions, addLog } = useSessionState();

    // Listen for WebSocket messages
    useEffect(() => {
        if (!socket) return;

        const handleMessage = (event: MessageEvent) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === "log_update" && message.log) {
                    addLog(message.log as LogEntry);
                }
            } catch (err) {
                console.error("[WebSocket] Failed to parse message:", err);
            }
        };

        socket.addEventListener('message', handleMessage);
        return () => {
            socket.removeEventListener('message', handleMessage);
        };
    }, [socket, addLog]);

    // Initial session load
    useEffect(() => {
        refreshSessions();
    }, [refreshSessions]);

    // Memoize the context value to prevent unnecessary re-renders
    const contextValue = useMemo(() => ({
        logs,
        isConnected,
        connectionError,
        currentSession,
        setCurrentSession,
        refreshSessions
    }), [logs, isConnected, connectionError, currentSession, setCurrentSession, refreshSessions]);

    return (
        <WebSocketContext.Provider value={contextValue}>
            {children}
        </WebSocketContext.Provider>
    );
}
