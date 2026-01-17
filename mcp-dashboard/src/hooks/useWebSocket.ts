"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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
    events?: any[];
}

const RECONNECT_DELAY_MS = 3000;
const CONNECTION_TIMEOUT_MS = 5000;

export function useWebSocket(url: string) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isCleaningUpRef = useRef(false);
    const hasOpenedRef = useRef(false);

    const connect = useCallback(() => {
        // Prevent duplicate connections
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            return;
        }

        // Don't reconnect if we're cleaning up
        if (isCleaningUpRef.current) {
            return;
        }

        setConnectionError(null);
        hasOpenedRef.current = false;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
        }
        connectionTimeoutRef.current = setTimeout(() => {
            if (!hasOpenedRef.current && !isCleaningUpRef.current) {
                setConnectionError("Connection Failed");
            }
        }, CONNECTION_TIMEOUT_MS);

        ws.onopen = () => {
            console.log("WebSocket connected");
            setIsConnected(true);
            setConnectionError(null);
            hasOpenedRef.current = true;
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === "log_update" && message.log) {
                    setLogs((prev) => {
                        // Check if log with same ID exists, update it, otherwise prepend
                        const existingIndex = prev.findIndex((log) => log.id === message.log.id);
                        if (existingIndex !== -1) {
                            const updated = [...prev];
                            updated[existingIndex] = message.log;
                            return updated;
                        }
                        return [message.log, ...prev];
                    });
                }
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            setConnectionError("Connection Failed");
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setIsConnected(false);
            wsRef.current = null;
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }
            if (!hasOpenedRef.current && !isCleaningUpRef.current) {
                setConnectionError("Connection Failed");
            }

            // Schedule reconnection if not cleaning up
            if (!isCleaningUpRef.current) {
                console.log(`Reconnecting in ${RECONNECT_DELAY_MS / 1000} seconds...`);
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, RECONNECT_DELAY_MS);
            }
        };
    }, [url]);

    useEffect(() => {
        let isMounted = true;

        const fetchLogs = async () => {
            try {
                const response = await fetch("/api/logs");
                if (!response.ok) {
                    throw new Error(`Failed to fetch logs: ${response.status}`);
                }
                const data = (await response.json()) as LogEntry[];
                if (!isMounted) {
                    return;
                }
                setLogs((prev) => {
                    if (prev.length === 0) {
                        return data;
                    }
                    const merged = new Map<number, LogEntry>();
                    data.forEach((entry) => merged.set(entry.id, entry));
                    prev.forEach((entry) => merged.set(entry.id, entry));
                    return Array.from(merged.values());
                });
            } catch (err) {
                console.error("Failed to fetch logs:", err);
            }
        };

        fetchLogs();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        isCleaningUpRef.current = false;
        connect();

        return () => {
            isCleaningUpRef.current = true;

            // Clear any pending reconnection timeout
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }

            // Close the WebSocket connection
            if (wsRef.current) {
                if (wsRef.current.readyState === WebSocket.OPEN ||
                    wsRef.current.readyState === WebSocket.CONNECTING) {
                    wsRef.current.close();
                }
                wsRef.current = null;
            }
        };
    }, [connect]);

    return { logs, isConnected, connectionError };
}
