import { useState, useCallback, useRef, useEffect } from "react";
import type { WorkSession } from "../types/api";
import type { LogEntry } from "../types/api";
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

    const currentSessionRef = useRef<string | null>(null);

    // Add useEffect to keep ref in sync
    useEffect(() => {
        currentSessionRef.current = currentSession?.session_id ?? null;
    }, [currentSession]);

    const setCurrentSession = useCallback(async (session: WorkSession) => {
        console.log('[useSessionState] setCurrentSession called', session.session_id);
        const previousSessionId = currentSessionRef.current;
        currentSessionRef.current = session.session_id;

        // Optimistically update current session
        setCurrentSessionState(session);

        // If session changed, clear logs and fetch new ones
        if (previousSessionId !== session.session_id) {
            setLogs([]); // Clear logs immediately
            try {
                const data = await api.logs.list(session.session_id);
                // Check if session ID is still the same before applying logs
                if (currentSessionRef.current !== session.session_id) {
                    return;
                }
                if (Array.isArray(data)) {
                    const initialLogs = (data as LogEntry[]).slice(0, MAX_LOGS);
                    setLogs(initialLogs);
                }
            } catch (err) {
                console.error("Failed to fetch logs for session:", err);
            }
        }
    }, []); // Empty dependency array - no dependencies needed

    const refreshSessions = useCallback(async () => {
        console.log('[useSessionState] refreshSessions called');
        try {
            try {
                const session = await api.sessions.getCurrent();
                await setCurrentSession(session);
            } catch (err) {
                const data = await api.sessions.list();
                if (data.sessions && data.sessions.length > 0) {
                    const fallbackSession = data.sessions[0];
                    try {
                        const activatedSession = await api.sessions.activate(fallbackSession.session_id);
                        await setCurrentSession(activatedSession);
                    } catch (activateErr) {
                        await setCurrentSession(fallbackSession);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to refresh sessions:", error);
        }
    }, [setCurrentSession]); // Now setCurrentSession is stable


    return {
        logs,
        currentSession,
        setCurrentSession,
        refreshSessions,
        addLog
    };
}
