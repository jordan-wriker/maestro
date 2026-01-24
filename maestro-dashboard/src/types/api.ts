export interface WorkSessionAgent {
    name: string;
    color: string;
}

export interface WorkSession {
    session_id: string;
    title: string;
    status: string;
    root_directory: string;
    agents: WorkSessionAgent[];
    total_tokens: string;
    last_active: string;
    is_current_session: boolean;
    created_at: string;
    updated_at: string;
}

export interface BatchTask {
    task_id: string;
    batch_id: string;
    status: string;
    result?: any;
    created_at?: string;
    updated_at?: string;
}

export interface Batch {
    batch_id: string;
    session_id: string;
    status: string;
    total_tasks: number;
    completed_tasks: number;
    progress: number;
    tasks: BatchTask[];
    created_at: string;
    updated_at: string;
}

export interface Conversation {
    conversation_id: string;
    session_id: string;
    batch_id?: string;
    agent: string;
    status: string;
    prompt: string;
    response?: string;
    created_at: string;
    last_activity: string;
}
