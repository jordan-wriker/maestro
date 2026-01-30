/**
 * Contract Tests for API Schema Validation
 *
 * These tests verify that Zod schemas correctly validate API response structures.
 * They use mock data that matches what the REAL backend returns to detect mismatches.
 */
import { describe, it, expect } from 'vitest';
import {
  SessionResponseSchema,
  WorkSessionSchema,
  ConversationSummarySchema,
  ConversationDetailSchema,
  BatchResponseSchema,
  BatchSchema,
  BatchTaskSchema,
  BatchStatusResponseSchema,
  StatsResponseSchema,
  LogsResponseSchema,
  LogEntrySchema,
  ConversationEventSchema,
} from '@/schemas/api';

/**
 * INTEGRATION CONTRACT TESTS
 *
 * These tests simulate what happens when the frontend receives ACTUAL backend responses.
 * They will FAIL if there's a mismatch between frontend schemas and backend responses.
 *
 * The mock data here represents what the backend ACTUALLY returns (per responses.py).
 */
describe('Integration Contract Tests - Backend Response Validation', () => {
  it('SessionResponseSchema should accept actual backend response without pagination', () => {
    // This is EXACTLY what GET /api/sessions returns from the backend
    // Backend: SessionListResponse in responses.py only has { sessions: [...] }
    const actualBackendResponse = {
      sessions: [
        {
          session_id: 'abc12345',
          title: 'Test Session',
          status: 'active',
          root_directory: '/home/user/project',
          agents: [{ name: 'Claude', color: 'blue' }],
          total_tokens: '1000',
          last_active: '2024-01-15T10:30:00Z',
          is_current_session: true,
          created_at: '2024-01-15T09:00:00Z',
          updated_at: '2024-01-15T10:30:00Z',
        },
      ],
    };

    const result = SessionResponseSchema.safeParse(actualBackendResponse);

    // Schema now correctly accepts responses without pagination fields
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Schema mismatch detected:', result.error.format());
    }
  });

  it('LogEntrySchema should accept actual backend status values', () => {
    // Backend returns capitalized status like "Completed", "Running...", "Error"
    const actualBackendLogEntry = {
      id: 123,
      timestamp: '2024-01-15T10:30:00Z',
      agent: 'claude',
      task: 'Test task',
      status: 'Completed', // Backend uses capital C
      final_response: 'Done',
      conversation_id: 'conv-123',
    };

    const result = LogEntrySchema.safeParse(actualBackendLogEntry);

    // This test will FAIL if status enum is case-sensitive
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Status case mismatch:', result.error.format());
    }
  });

  it('BatchTaskSchema result should match actual backend structure', () => {
    // Backend returns result with { text, conversation_id, error }
    // Frontend schema expects { output, success }
    const actualBackendBatchTask = {
      task_id: 'task-123',
      batch_id: 'BCH-1234-A',
      status: 'completed',
      result: {
        text: 'Task completed successfully',
        conversation_id: 'conv-456',
        error: null,
      },
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:30:00Z',
    };

    const result = BatchTaskSchema.safeParse(actualBackendBatchTask);

    // This should pass because BatchTaskResultSchema uses passthrough()
    // But if code accesses result.output it will be undefined
    expect(result.success).toBe(true);
    if (result.success && result.data.result) {
      // Verify the actual fields exist
      expect(result.data.result).toHaveProperty('text');
    }
  });
});

describe('API Contract Tests', () => {
  describe('SessionResponseSchema', () => {
    it('should accept valid paginated session response', () => {
      const validResponse = {
        sessions: [
          {
            session_id: 'abc12345',
            title: 'Test Session',
            status: 'active',
            root_directory: '/home/user/project',
            agents: [{ name: 'Claude', color: 'blue' }],
            total_tokens: '1000',
            last_active: '2024-01-15T10:30:00Z',
            is_current_session: true,
            created_at: '2024-01-15T09:00:00Z',
            updated_at: '2024-01-15T10:30:00Z',
          },
        ],
        total: 1,
        page: 1,
        size: 10,
      };
      const result = SessionResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should accept backend response without pagination fields (pagination is optional)', () => {
      // This is what the REAL backend returns (SessionListResponse in responses.py)
      // It only has { sessions: [...] } without total/page/size
      // Schema now correctly accepts this since pagination fields are optional
      const backendResponse = {
        sessions: [
          {
            session_id: 'abc12345',
            title: 'Test Session',
            status: 'active',
            root_directory: '/home/user/project',
            agents: [{ name: 'Claude', color: 'blue' }],
            total_tokens: '1000',
            last_active: '2024-01-15T10:30:00Z',
            is_current_session: true,
            created_at: '2024-01-15T09:00:00Z',
            updated_at: '2024-01-15T10:30:00Z',
          },
        ],
      };
      const result = SessionResponseSchema.safeParse(backendResponse);
      expect(result.success).toBe(true);
    });

    it('should fail with empty object', () => {
      const result = SessionResponseSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('WorkSessionSchema', () => {
    it('should validate a complete work session', () => {
      const session = {
        session_id: 'abc12345',
        title: 'Development Session',
        status: 'active',
        root_directory: '/home/user/project',
        agents: [
          { name: 'Claude', color: 'blue' },
          { name: 'Codex', color: 'green' },
        ],
        total_tokens: '5000',
        last_active: '2024-01-15T10:30:00Z',
        is_current_session: true,
        created_at: '2024-01-15T09:00:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      };
      expect(WorkSessionSchema.safeParse(session).success).toBe(true);
    });

    it('should fail when required fields are missing', () => {
      const incomplete = {
        session_id: 'abc12345',
        title: 'Test',
      };
      expect(WorkSessionSchema.safeParse(incomplete).success).toBe(false);
    });
  });

  describe('ConversationSummarySchema', () => {
    it('should accept valid conversation summary with task/final_response', () => {
      const validSummary = {
        conversation_id: 'conv-123',
        agent: 'claude',
        created_at: '2024-01-15T10:00:00Z',
        status: 'completed',
        task: 'Implement feature X',
        final_response: 'Feature X has been implemented successfully.',
      };
      expect(ConversationSummarySchema.safeParse(validSummary).success).toBe(true);
    });

    it('should accept valid conversation summary with optional last_activity', () => {
      const validSummary = {
        conversation_id: 'conv-123',
        agent: 'codex',
        created_at: '2024-01-15T10:00:00Z',
        status: 'active',
        task: 'Implement feature X',
        final_response: 'In progress...',
        last_activity: '2024-01-15T10:30:00Z',
      };
      expect(ConversationSummarySchema.safeParse(validSummary).success).toBe(true);
    });

    it('should REJECT data using prompt/response fields (old backend format)', () => {
      // Some backends might use prompt/response instead of task/final_response
      const wrongFieldNames = {
        conversation_id: 'conv-123',
        agent: 'claude',
        created_at: '2024-01-15T10:00:00Z',
        status: 'completed',
        prompt: 'Implement feature X',
        response: 'Feature X has been implemented successfully.',
      };
      expect(ConversationSummarySchema.safeParse(wrongFieldNames).success).toBe(false);
    });

    it('should reject invalid agent type', () => {
      const invalidAgent = {
        conversation_id: 'conv-123',
        agent: 'gpt-4', // Not claude or codex
        created_at: '2024-01-15T10:00:00Z',
        status: 'completed',
        task: 'Test',
        final_response: 'Done',
      };
      expect(ConversationSummarySchema.safeParse(invalidAgent).success).toBe(false);
    });

    it('should reject invalid status', () => {
      const invalidStatus = {
        conversation_id: 'conv-123',
        agent: 'claude',
        created_at: '2024-01-15T10:00:00Z',
        status: 'pending', // Not in enum
        task: 'Test',
        final_response: 'Done',
      };
      expect(ConversationSummarySchema.safeParse(invalidStatus).success).toBe(false);
    });
  });

  describe('ConversationDetailSchema', () => {
    it('should accept valid conversation detail', () => {
      const validDetail = {
        conversation_id: 'conv-123',
        agent: 'claude',
        created_at: '2024-01-15T10:00:00Z',
        status: 'completed',
        task: 'Implement feature X',
        events: [
          { type: 'prompt', content: 'Please implement feature X' },
          { type: 'thinking', content: 'Analyzing requirements...' },
          { type: 'response', content: 'Here is the implementation' },
        ],
      };
      expect(ConversationDetailSchema.safeParse(validDetail).success).toBe(true);
    });

    it('should accept conversation with tool calls', () => {
      const withToolCalls = {
        conversation_id: 'conv-123',
        agent: 'codex',
        created_at: '2024-01-15T10:00:00Z',
        status: 'running',
        task: 'Create a file',
        events: [
          { type: 'prompt', content: 'Create test.ts' },
          { type: 'tool_call', content: 'Writing file', tool: 'write_file' },
          { type: 'result', content: 'File created successfully', output: 'test.ts' },
        ],
      };
      expect(ConversationDetailSchema.safeParse(withToolCalls).success).toBe(true);
    });
  });

  describe('BatchSchema and BatchResponseSchema', () => {
    it('should validate a complete batch with tasks', () => {
      const validBatch = {
        batch_id: 'BCH-1234-A',
        session_id: 'abc12345',
        status: 'completed',
        total_tasks: 3,
        completed_tasks: 3,
        progress: 1.0,
        tasks: [
          { task_id: 'task-1', batch_id: 'BCH-1234-A', status: 'completed' },
          { task_id: 'task-2', batch_id: 'BCH-1234-A', status: 'completed', result: { output: 'Done', success: true } },
          { task_id: 'task-3', batch_id: 'BCH-1234-A', status: 'completed' },
        ],
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      };
      expect(BatchSchema.safeParse(validBatch).success).toBe(true);
    });

    it('should validate batch response as array', () => {
      const batchArray = [
        {
          batch_id: 'BCH-1234-A',
          session_id: 'abc12345',
          status: 'completed',
          total_tasks: 1,
          completed_tasks: 1,
          progress: 1.0,
          tasks: [{ task_id: 'task-1', batch_id: 'BCH-1234-A', status: 'completed' }],
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:30:00Z',
        },
      ];
      expect(BatchResponseSchema.safeParse(batchArray).success).toBe(true);
    });

    it('should fail when batch is missing required fields', () => {
      const incompleteBatch = {
        batch_id: 'BCH-1234-A',
        status: 'pending',
        // Missing session_id, total_tasks, etc.
      };
      expect(BatchSchema.safeParse(incompleteBatch).success).toBe(false);
    });
  });

  describe('BatchTaskSchema', () => {
    it('should accept task with result', () => {
      const taskWithResult = {
        task_id: 'task-123',
        batch_id: 'BCH-1234-A',
        status: 'completed',
        result: {
          output: 'Task completed successfully',
          success: true,
        },
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:30:00Z',
      };
      expect(BatchTaskSchema.safeParse(taskWithResult).success).toBe(true);
    });

    it('should accept task without result (pending/running)', () => {
      const pendingTask = {
        task_id: 'task-123',
        batch_id: 'BCH-1234-A',
        status: 'pending',
      };
      expect(BatchTaskSchema.safeParse(pendingTask).success).toBe(true);
    });

    it('should accept task with null result', () => {
      const taskWithNullResult = {
        task_id: 'task-123',
        batch_id: 'BCH-1234-A',
        status: 'failed',
        result: null,
      };
      expect(BatchTaskSchema.safeParse(taskWithNullResult).success).toBe(true);
    });
  });

  describe('StatsResponseSchema', () => {
    it('should validate stats response', () => {
      const stats = {
        claudeTasks: 10,
        codexTasks: 5,
        avgLatency: 1500,
      };
      expect(StatsResponseSchema.safeParse(stats).success).toBe(true);
    });

    it('should allow additional numeric fields', () => {
      const extendedStats = {
        claudeTasks: 10,
        codexTasks: 5,
        avgLatency: 1500,
        totalTokens: 50000,
        errorRate: 0.02,
      };
      expect(StatsResponseSchema.safeParse(extendedStats).success).toBe(true);
    });
  });

  describe('LogEntrySchema and LogsResponseSchema', () => {
    it('should validate a log entry', () => {
      const logEntry = {
        id: 1,
        timestamp: '2024-01-15T10:30:00Z',
        agent: 'claude',
        task: 'Implement feature',
        status: 'completed',
        final_response: 'Done',
        conversation_id: 'conv-123',
      };
      expect(LogEntrySchema.safeParse(logEntry).success).toBe(true);
    });

    it('should validate log entry with events', () => {
      const logWithEvents = {
        id: 2,
        timestamp: '2024-01-15T10:30:00Z',
        agent: 'codex',
        task: 'Create file',
        status: 'completed',
        events: [
          { type: 'prompt', content: 'Create test.ts' },
          { type: 'response', content: 'File created' },
        ],
      };
      expect(LogEntrySchema.safeParse(logWithEvents).success).toBe(true);
    });

    it('should validate logs response as array', () => {
      const logsArray = [
        {
          id: 1,
          timestamp: '2024-01-15T10:30:00Z',
          agent: 'claude',
          task: 'Task 1',
          status: 'completed',
        },
        {
          id: 2,
          timestamp: '2024-01-15T10:35:00Z',
          agent: 'codex',
          task: 'Task 2',
          status: 'active',
        },
      ];
      expect(LogsResponseSchema.safeParse(logsArray).success).toBe(true);
    });
  });

  describe('BatchStatusResponseSchema', () => {
    it('should validate batch status response from POST /batch/status', () => {
      // This is what the backend returns for batch status polling
      const statusResponse = {
        batch_id: 'BCH-1234-A',
        status: 'running',
        new_results: [
          { task_id: 'task-1', status: 'completed', result: { output: 'Done' } },
          { task_id: 'task-2', status: 'failed', result: { error: 'Timeout' } },
        ],
      };
      expect(BatchStatusResponseSchema.safeParse(statusResponse).success).toBe(true);
    });

    it('should accept empty new_results array', () => {
      const noNewResults = {
        batch_id: 'BCH-1234-A',
        status: 'pending',
        new_results: [],
      };
      expect(BatchStatusResponseSchema.safeParse(noNewResults).success).toBe(true);
    });

    it('should fail when missing required fields', () => {
      const incomplete = {
        batch_id: 'BCH-1234-A',
        // missing status and new_results
      };
      expect(BatchStatusResponseSchema.safeParse(incomplete).success).toBe(false);
    });
  });

  describe('ConversationEventSchema', () => {
    it('should accept all valid event types', () => {
      const eventTypes = ['prompt', 'system', 'response', 'tool_call', 'result', 'thinking', 'reasoning'];

      for (const type of eventTypes) {
        const event = { type, content: 'Test content' };
        const result = ConversationEventSchema.safeParse(event);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid event type', () => {
      const invalidEvent = { type: 'unknown', content: 'Test' };
      expect(ConversationEventSchema.safeParse(invalidEvent).success).toBe(false);
    });

    it('should accept tool_call with tool field', () => {
      const toolCall = {
        type: 'tool_call',
        content: 'Writing file',
        tool: 'write_file',
      };
      expect(ConversationEventSchema.safeParse(toolCall).success).toBe(true);
    });

    it('should accept result with output field', () => {
      const result = {
        type: 'result',
        content: 'Success',
        output: 'file.ts created',
      };
      expect(ConversationEventSchema.safeParse(result).success).toBe(true);
    });
  });
});
