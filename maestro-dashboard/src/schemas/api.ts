import { z } from 'zod';

// --- Shared/Common Schemas ---

export const ApiErrorSchema = z.object({
    detail: z.union([
        z.string(),
        z.record(z.string(), z.array(z.string())),
        z.unknown() // Fallback for complex error details, but try to be specific where possible
    ]),
    status: z.number().optional(),
});

export const SessionEventSchema = z.object({
    type: z.enum(["prompt", "system", "response", "tool_call", "result", "thinking", "reasoning"]),
    content: z.string(),
    tool: z.string().optional(),
    output: z.string().optional(),
    timestamp: z.string().optional(),
});

// --- Session Schemas ---

export const WorkSessionAgentSchema = z.object({
    name: z.string(),
    color: z.string(),
});

export const WorkSessionSchema = z.object({
    session_id: z.string(),
    title: z.string(),
    status: z.string(),
    root_directory: z.string(),
    agents: z.array(WorkSessionAgentSchema),
    total_tokens: z.string(),
    last_active: z.string(),
    is_current_session: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const CreateSessionRequestSchema = z.object({
    title: z.string(),
    root_directory: z.string().optional(),
    agents: z.array(WorkSessionAgentSchema).optional(),
});

export const SessionResponseSchema = z.object({
    sessions: z.array(WorkSessionSchema),
    total: z.number(),
    page: z.number(),
    size: z.number(),
});

// --- Batch Schemas ---

// Define result shape
export const BatchTaskResultSchema = z.object({
    output: z.string().optional(),
    success: z.boolean().optional(),
}).passthrough(); // Allow other properties if needed for now

export const BatchTaskSchema = z.object({
    task_id: z.string(),
    batch_id: z.string(),
    status: z.string(),
    result: BatchTaskResultSchema.optional().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

export const BatchSchema = z.object({
    batch_id: z.string(),
    session_id: z.string(),
    status: z.string(),
    total_tasks: z.number(),
    completed_tasks: z.number(),
    progress: z.number(),
    tasks: z.array(BatchTaskSchema),
    created_at: z.string(),
    updated_at: z.string(),
});

export const BatchResponseSchema = z.array(BatchSchema);

// --- Conversation Schemas ---

export const ConversationSummarySchema = z.object({
    conversation_id: z.string(),
    agent: z.enum(["claude", "codex"]),
    created_at: z.string(),
    status: z.enum(["completed", "error", "active", "running"]), // Added running as it's common
    task: z.string(),
    final_response: z.string(),
    last_activity: z.string().optional(),
});

export const ConversationDetailSchema = z.object({
    conversation_id: z.string(),
    agent: z.enum(["claude", "codex"]),
    created_at: z.string(),
    events: z.array(z.lazy(() => SessionEventSchema)), // Use lazy if circular, or just SessionEventSchema if defined above. SessionEventSchema is defined below, so might need to move or use lazy. defined below lines 107.
    status: z.enum(["completed", "error", "active", "running"]),
    task: z.string(),
});

export const ConversationSchema = z.object({
    conversation_id: z.string(),
    session_id: z.string(),
    batch_id: z.string().optional(),
    agent: z.string(),
    status: z.string(),
    prompt: z.string(),
    response: z.string().optional(),
    created_at: z.string(),
    last_activity: z.string(),
});

export const ConversationResponseSchema = z.array(ConversationSchema);

// --- Stats Schemas ---

export const StatsResponseSchema = z.object({
    claudeTasks: z.number(),
    codexTasks: z.number(),
    avgLatency: z.number(),
}).catchall(z.union([z.number(), z.string()]));

// --- Log Schemas ---

// Need to import SessionEvent from models or define it here if we want to change models to rely on schemas.
// For now, let's define a schema compatible with existing types.

// LogEntrySchema uses SessionEventSchema defined at the top
export const LogEntrySchema = z.object({
    id: z.number(),
    timestamp: z.string(),
    agent: z.string(),
    task: z.string(),
    final_response: z.string().optional(),
    conversation_id: z.string().optional(),
    status: z.string(),
    events: z.array(SessionEventSchema).optional(),
});

export const LogsResponseSchema = z.array(LogEntrySchema);

// --- Types inferred from Schemas ---
export type APIError = z.infer<typeof ApiErrorSchema>;
export type WorkSessionAgent = z.infer<typeof WorkSessionAgentSchema>;
export type WorkSession = z.infer<typeof WorkSessionSchema>;
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type BatchTaskResult = z.infer<typeof BatchTaskResultSchema>;
export type BatchTask = z.infer<typeof BatchTaskSchema>;
export type Batch = z.infer<typeof BatchSchema>;
export type BatchResponse = z.infer<typeof BatchResponseSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
export type SessionEvent = z.infer<typeof SessionEventSchema>;
export type LogsResponse = z.infer<typeof LogsResponseSchema>;
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;
