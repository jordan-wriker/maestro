"use client";

import { useEffect, useState, useRef } from "react";

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

export function useWebSocket(url: string) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        // Prevent duplicate connections
        if (wsRef.current) return;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setIsConnected(true);
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
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setIsConnected(false);
            wsRef.current = null;
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
            wsRef.current = null;
        };
    }, [url]);

    return { logs, isConnected };
}
