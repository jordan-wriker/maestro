"use client";

import { useContext } from "react";
import { WebSocketContext, LogEntry } from "@/providers/WebSocketProvider";

// Re-export LogEntry type for compatibility
export type { LogEntry };

export function useWebSocket(url?: string) {
    // We ignore the URL argument as the connection is now managed globally by WebSocketProvider
    const context = useContext(WebSocketContext);

    if (context === undefined) {
        throw new Error("useWebSocket must be used within a WebSocketProvider");
    }

    return context;
}
