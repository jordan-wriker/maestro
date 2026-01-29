import { apiClient } from './client';
import { MOCK_TOOLS } from '@/config/constants';
import { z } from 'zod';
import type { CreateSessionRequest } from '../types/api';
import {
    SessionResponseSchema,
    WorkSessionSchema,
    BatchResponseSchema,
    StatsResponseSchema,
    LogsResponseSchema,
    ConversationSummarySchema,
    ConversationDetailSchema,
} from '../schemas/api';

export const api = {
    sessions: {
        list: () =>
            apiClient.getValidated('/sessions', SessionResponseSchema),

        get: (sessionId: string) =>
            apiClient.getValidated(`/sessions/${sessionId}`, WorkSessionSchema),

        create: (data: CreateSessionRequest) =>
            apiClient.postValidated('/sessions', WorkSessionSchema, data),

        activate: (sessionId: string) =>
            apiClient.putValidated(`/sessions/${sessionId}/activate`, WorkSessionSchema),

        getCurrent: () =>
            apiClient.getValidated('/sessions/current', WorkSessionSchema),
    },

    batches: {
        list: (sessionId: string) =>
            apiClient.getValidated('/batches', BatchResponseSchema, { session_id: sessionId }),
    },

    stats: {
        get: (sessionId: string) =>
            apiClient.getValidated('/stats', StatsResponseSchema, { session_id: sessionId }),
    },

    logs: {
        list: (sessionId: string) =>
            apiClient.getValidated('/logs', LogsResponseSchema, { session_id: sessionId }),
    },

    conversations: {
        list: (sessionId: string, agent?: string) =>
            apiClient.getValidated('/conversations', z.array(ConversationSummarySchema), { session_id: sessionId, ...(agent ? { agent } : {}) }),

        get: (conversationId: string, sessionId?: string) =>
            apiClient.getValidated(`/conversations/${conversationId}`, ConversationDetailSchema, sessionId ? { session_id: sessionId } : undefined),
    },

    admin: {
        clearDatabase: () =>
            apiClient.postValidated<void>('/admin/clear-database', z.void()),
    },

    tools: {
        list: () => Promise.resolve(MOCK_TOOLS),
    }
};
