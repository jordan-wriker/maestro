import { useContext } from "react";
import { WebSocketContext } from "@/providers/WebSocketProvider";
import type { LogEntry } from "../types/api";

// Re-export LogEntry type for compatibility
export type { LogEntry };

export function useWebSocket() {
    const context = useContext(WebSocketContext);

    if (context === undefined) {
        throw new Error("useWebSocket must be used within a WebSocketProvider");
    }

    return context;
}
