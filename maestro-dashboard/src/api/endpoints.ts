
import { apiClient } from './client';
import {
    WorkSession,
    SessionResponse,
    CreateSessionRequest,
    BatchResponse,
    StatsResponse,
    LogsResponse,
    ConversationResponse
} from '../types/api';

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
        list: (sessionId: string) =>
            apiClient.get<ConversationResponse>('/conversations', { session_id: sessionId }),
    }
};
