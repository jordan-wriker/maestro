import { useState, useEffect, useCallback, useRef } from "react";

interface SocketConnectionState {
    isConnected: boolean;
    connectionError: string | null;
    socket: WebSocket | null;
    isRetrying: boolean;
}

const MAX_RETRIES = 5;

export function useSocketConnection(url: string) {
    const [state, setState] = useState<SocketConnectionState>({
        isConnected: false,
        connectionError: null,
        socket: null,
        isRetrying: false,
    });

    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const isMountedRef = useRef(true);
    const isConnectingRef = useRef(false);

    const connect = useCallback(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN || isConnectingRef.current) {
            return;
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        isConnectingRef.current = true;
        console.log(`[WebSocket] Connecting to ${url}...`);

        try {
            const ws = new WebSocket(url);
            socketRef.current = ws;

            ws.onopen = () => {
                if (!isMountedRef.current) {
                    ws.close();
                    return;
                }
                console.log("[WebSocket] Connected");
                isConnectingRef.current = false;
                reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
                setState(prev => ({
                    ...prev,
                    isConnected: true,
                    connectionError: null,
                    socket: ws,
                    isRetrying: false
                }));
            };

            ws.onclose = (event) => {
                isConnectingRef.current = false;
                if (!isMountedRef.current) return;
                console.log(`[WebSocket] Disconnected (code: ${event.code})`);

                socketRef.current = null;
                setState(prev => ({ ...prev, isConnected: false, socket: null }));

                // Check max retries
                if (reconnectAttemptsRef.current >= MAX_RETRIES) {
                    console.error(`[WebSocket] Max retries (${MAX_RETRIES}) reached. Stopping reconnection.`);
                    setState(prev => ({
                        ...prev,
                        connectionError: "Connection failed after multiple attempts.",
                        isRetrying: false
                    }));
                    return;
                }

                // exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
                const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                reconnectAttemptsRef.current += 1;

                setState(prev => ({ ...prev, isRetrying: true }));
                console.log(`[WebSocket] Reconnecting in ${delay}ms... (Attempt ${reconnectAttemptsRef.current}/${MAX_RETRIES})`);

                reconnectTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        connect();
                    }
                }, delay);
            };

            ws.onerror = (error) => {
                if (!isMountedRef.current) return;
                // Don't set error state immediately here, let onclose handle the flow + retry logic
                // But we can log it
                console.error("[WebSocket] Error event:", error);
            };
        } catch (e) {
            isConnectingRef.current = false;
            console.error("[WebSocket] Connection creation error:", e);
            setState(prev => ({ ...prev, connectionError: "Failed to create WebSocket connection" }));
        }

    }, [url]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
        isConnectingRef.current = false;
    }, []);

    const retry = useCallback(() => {
        reconnectAttemptsRef.current = 0;
        setState(prev => ({ ...prev, connectionError: null }));
        connect();
    }, [connect]);

    useEffect(() => {
        isMountedRef.current = true;
        connect();
        return () => {
            isMountedRef.current = false;
            disconnect();
        };
    }, [connect, disconnect]);

    return {
        ...state,
        connect,
        disconnect,
        retry
    };
}
