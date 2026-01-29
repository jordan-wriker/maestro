
import { apiClient } from './client';
import type {
    WorkSession,
    SessionResponse,
    CreateSessionRequest,
    BatchResponse,
    StatsResponse,
    LogsResponse,
} from '../types/api';
import type { ConversationSummary, ConversationDetail } from '../types/models';

export const api = {
    sessions: {
        list: () =>
            apiClient.get<SessionResponse>('/sessions'),

        get: (sessionId: string) =>
            apiClient.get<WorkSession>(`/sessions/${sessionId}`),

        create: (data: CreateSessionRequest) =>
            apiClient.post<WorkSession>('/sessions', data),

        activate: (sessionId: string) =>
            apiClient.put<WorkSession>(`/sessions/${sessionId}/activate`),

        getCurrent: () =>
            apiClient.get<WorkSession>('/sessions/current'),
    },

    batches: {
        list: (sessionId: string) =>
            apiClient.get<BatchResponse>('/batches', { session_id: sessionId }),
    },

    stats: {
        get: (sessionId: string) =>
            apiClient.get<StatsResponse>('/stats', { session_id: sessionId }),
    },

    logs: {
        list: (sessionId: string) =>
            apiClient.get<LogsResponse>('/logs', { session_id: sessionId }),
    },

    conversations: {
        list: (sessionId: string, agent?: string) =>
            apiClient.get<ConversationSummary[]>('/conversations', { session_id: sessionId, ...(agent ? { agent } : {}) }),

        get: (conversationId: string, sessionId?: string) =>
            apiClient.get<ConversationDetail>(`/conversations/${conversationId}`, sessionId ? { session_id: sessionId } : undefined),
    },

    admin: {
        clearDatabase: () =>
            apiClient.post<void>('/admin/clear-database'),
    }
};
