
export interface LogEntry {
    id: number;
    timestamp: string;
    agent: string;
    task: string;
    final_response?: string;
    conversation_id?: string;
    status: string;
    events?: unknown[];
}

export interface SessionEvent {
    type: "prompt" | "system" | "response" | "tool_call" | "result" | "thinking" | "reasoning";
    content: string;
    tool?: string;
    output?: string;
    timestamp?: string;
}

export interface ConversationSummary {
    conversation_id: string;
    agent: "claude" | "codex";
    created_at: string;
    status: "completed" | "error" | "active";
    task: string;
    final_response: string;
    last_activity?: string;
}

export interface ConversationDetail {
    conversation_id: string;
    agent: "claude" | "codex";
    created_at: string;
    events: SessionEvent[];
    status: "completed" | "error" | "active";
    task: string;
}
