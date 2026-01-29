import { useState, useEffect, useCallback, useRef } from "react";

interface SocketConnectionState {
    isConnected: boolean;
    connectionError: string | null;
    socket: WebSocket | null;
}

export function useSocketConnection(url: string) {
    const [state, setState] = useState<SocketConnectionState>({
        isConnected: false,
        connectionError: null,
        socket: null,
    });

    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const isMountedRef = useRef(true);

    const connect = useCallback(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        console.log(`[WebSocket] Connecting to ${url}...`);
        const ws = new WebSocket(url);
        socketRef.current = ws;

        ws.onopen = () => {
            if (!isMountedRef.current) {
                ws.close();
                return;
            }
            console.log("[WebSocket] Connected");
            reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
            setState(prev => ({ ...prev, isConnected: true, connectionError: null, socket: ws }));
        };

        ws.onclose = (event) => {
            if (!isMountedRef.current) return;
            console.log(`[WebSocket] Disconnected (code: ${event.code})`);

            socketRef.current = null;
            setState(prev => ({ ...prev, isConnected: false, socket: null }));

            // exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current += 1;

            console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
            reconnectTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    connect();
                }
            }, delay);
        };

        ws.onerror = (error) => {
            if (!isMountedRef.current) return;
            console.error("[WebSocket] Error:", error);
            setState(prev => ({ ...prev, connectionError: "Connection Failed" }));
        };

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
    }, []);

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
        connect, // Expose manually if needed, though useEffect handles it
        disconnect,
    };
}
