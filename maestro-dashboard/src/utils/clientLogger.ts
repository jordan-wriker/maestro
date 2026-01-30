export type ClientLogPayload = {
    session_id?: string;
    level?: "debug" | "info" | "warn" | "error";
    source: string;
    message: string;
    data?: Record<string, unknown>;
    timestamp?: string;
};

const LOG_ENDPOINT = "/api/client-logs";

export async function logClientEvent(payload: ClientLogPayload): Promise<void> {
    if (!payload.session_id) {
        return;
    }

    const body = {
        level: "info",
        timestamp: new Date().toISOString(),
        ...payload,
    };

    try {
        await fetch(LOG_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            keepalive: true,
        });
    } catch {
        // Intentionally ignore logging failures
    }
}
