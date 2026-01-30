/** Schema Validation Tests for Zod schemas. */
import { describe, it, expect } from 'vitest';
import {
  ConversationSummarySchema,
  ConversationDetailSchema,
  BatchSchema,
} from '@/schemas/api';

describe('Zod Schemas - Field Names and Types', () => {
  describe('ConversationSummarySchema', () => {
    it('should accept valid data with task and final_response fields', () => {
      const validData = {
        conversation_id: 'conv-123',
        agent: 'claude',
        created_at: '2024-01-01T00:00:00Z',
        status: 'completed',
        task: 'Test task description',
        final_response: 'Test response content',
      };
      expect(ConversationSummarySchema.safeParse(validData).success).toBe(true);
    });

    it('should REJECT data with prompt/response fields (backend format)', () => {
      const backendData = {
        conversation_id: 'conv-123',
        agent: 'claude',
        created_at: '2024-01-01T00:00:00Z',
        status: 'completed',
        prompt: 'Test task description',
        response: 'Test response content',
      };
      expect(ConversationSummarySchema.safeParse(backendData).success).toBe(false);
    });
  });

  describe('ConversationDetailSchema', () => {
    it('should accept valid data with task field', () => {
      const validData = {
        conversation_id: 'conv-123',
        agent: 'claude',
        created_at: '2024-01-01T00:00:00Z',
        status: 'completed',
        task: 'Test task description',
        events: [],
      };
      expect(ConversationDetailSchema.safeParse(validData).success).toBe(true);
    });

    it('should REJECT data with prompt field (backend format)', () => {
      const backendData = {
        conversation_id: 'conv-123',
        agent: 'claude',
        created_at: '2024-01-01T00:00:00Z',
        status: 'completed',
        prompt: 'Test task description',
        events: [],
      };
      expect(ConversationDetailSchema.safeParse(backendData).success).toBe(false);
    });
  });

  describe('BatchSchema and BatchTaskSchema', () => {
    it('should validate properly typed batch tasks', () => {
      const validBatch = {
        batch_id: 'batch-123',
        session_id: 'session-123',
        status: 'completed',
        total_tasks: 1,
        completed_tasks: 1,
        progress: 1.0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tasks: [{ task_id: 'task-1', batch_id: 'batch-123', status: 'completed' }],
      };
      expect(BatchSchema.safeParse(validBatch).success).toBe(true);
    });
  });
});
