import React, { createContext, useEffect, useMemo, useRef } from "react";
import type { WorkSession } from "../types/api";
import type { LogEntry } from "../types/api";
import { LogEntrySchema } from "../schemas/api";
import { z } from "zod";
import { useSocketConnection } from "../hooks/useSocketConnection";
import { useSessionState } from "../hooks/useSessionState";

export interface WebSocketContextType {
    logs: LogEntry[];
    isConnected: boolean;
    connectionError: string | null;
    currentSession: WorkSession | null;
    setCurrentSession: (session: WorkSession) => Promise<void>;
    refreshSessions: () => Promise<void>;
    retryConnection: () => void;
}

export const WebSocketContext = createContext<WebSocketContextType>({
    logs: [],
    isConnected: false,
    connectionError: null,
    currentSession: null,
    setCurrentSession: async () => { },
    refreshSessions: async () => { },
    retryConnection: async () => { },
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
    // Development-only render tracking
    const renderCountRef = useRef(0);
    useEffect(() => {
        if (import.meta.env.DEV) {
            renderCountRef.current++;
            if (renderCountRef.current > 10) {
                console.warn(
                    `[WebSocketProvider] Rendered ${renderCountRef.current} times. Possible infinite loop!`
                );
            }
        }
    });

    const wsUrl = useMemo(() => getWebSocketUrl(), []);
    const { socket, isConnected, connectionError, retry } = useSocketConnection(wsUrl);
    const { logs, currentSession, setCurrentSession, refreshSessions, addLog } = useSessionState();

    // Listen for WebSocket messages
    useEffect(() => {
        if (!socket) return;

        const handleMessage = (event: MessageEvent) => {
            try {
                const rawMessage = JSON.parse(event.data);

                // Simple validation for the message structure
                // We can expand this schema as needed
                const MessageSchema = z.object({
                    type: z.literal("log_update"),
                    log: LogEntrySchema
                });

                const result = MessageSchema.safeParse(rawMessage);

                if (result.success) {
                    const message = result.data;
                    if (message.type === "log_update") {
                        addLog(message.log);
                    }
                } else {
                    console.warn("[WebSocket] Received invalid message format:", result.error);
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
        refreshSessions,
        retryConnection: retry
    }), [logs, isConnected, connectionError, currentSession, setCurrentSession, refreshSessions, retry]);

    return (
        <WebSocketContext.Provider value={contextValue}>
            {children}
        </WebSocketContext.Provider>
    );
}
