import { useState, useCallback } from "react";
import type { WorkSession } from "../types/api";
import type { LogEntry } from "../types/models";
import { api } from "../api/endpoints";

const MAX_LOGS = 1000;

export function useSessionState() {
    const [currentSession, setCurrentSessionState] = useState<WorkSession | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const addLog = useCallback((log: LogEntry) => {
        setLogs(prevLogs => {
            const existingIndex = prevLogs.findIndex(l => l.id === log.id);
            if (existingIndex !== -1) {
                // Update existing log
                const newLogs = [...prevLogs];
                newLogs[existingIndex] = log;
                return newLogs;
            } else {
                // Add new log, maintaining max size
                const newLogs = [log, ...prevLogs];
                if (newLogs.length > MAX_LOGS) {
                    return newLogs.slice(0, MAX_LOGS);
                }
                return newLogs;
            }
        });
    }, []);

    const setCurrentSession = useCallback(async (session: WorkSession) => {
        const previousSessionId = currentSession?.session_id;

        // Optimistically update current session
        setCurrentSessionState(session);

        // If session changed, clear logs and fetch new ones
        if (previousSessionId !== session.session_id) {
            setLogs([]); // Clear logs immediately
            try {
                const data = await api.logs.list(session.session_id);
                if (Array.isArray(data)) {
                    // We assume the API returns logs in correct order (or we trust the setLogs logic if we needed to sort)
                    // But usually logs list is the full history.
                    // We also need to cap initial load if it's huge, though usually we want all context. 
                    // For now, let's respect the cap even on initial load to be safe.
                    const initialLogs = (data as LogEntry[]).slice(0, MAX_LOGS);
                    setLogs(initialLogs);
                }
            } catch (err) {
                console.error("Failed to fetch logs for session:", err);
            }
        }
    }, [currentSession]);

    const refreshSessions = useCallback(async () => {
        try {
            try {
                // Try to get current active session from server
                const session = await api.sessions.getCurrent();
                await setCurrentSession(session);
            } catch (err) {
                // If getCurrent fails (e.g. 404), switch to list
                const data = await api.sessions.list();
                if (data.sessions && data.sessions.length > 0) {
                    // Activate the first session found as fallback
                    const fallbackSession = data.sessions[0];
                    try {
                        const activatedSession = await api.sessions.activate(fallbackSession.session_id);
                        await setCurrentSession(activatedSession);
                    } catch (activateErr) {
                        // Fallback to just setting it locally if activation fails
                        await setCurrentSession(fallbackSession);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to refresh sessions:", error);
        }
    }, [setCurrentSession]);


    return {
        logs,
        currentSession,
        setCurrentSession,
        refreshSessions,
        addLog
    };
}
