// Re-export specific types from schemas/api
// We are transitioning to Zod for runtime validation, so we export the inferred types
// to ensure our static types match our runtime validation.

export type {
    APIError,
    // Session
    WorkSessionAgent,
    WorkSession,
    CreateSessionRequest,
    SessionResponse,
    // Batch
    BatchTaskResult,
    BatchTask,
    Batch,
    BatchResponse,
    // Conversation
    Conversation,
    ConversationResponse,
    // Stats
    StatsResponse,
    // Logs
    LogEntry,
    ConversationEvent, // Newly added
    LogsResponse,
    // Conversations
    ConversationSummary,
    ConversationDetail
} from '../schemas/api';

