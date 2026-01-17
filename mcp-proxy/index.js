#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const PYTHON_SERVER = "http://127.0.0.1:8000";

const server = new Server({ name: "agent-orchestrator", version: "2.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "claude",
      description: "Start a NEW Claude session.",
      inputSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] }
    },
    {
      name: "claude-reply",
      description: "Resume a Claude session.",
      inputSchema: { type: "object", properties: { prompt: { type: "string" }, session_id: { type: "string" } }, required: ["prompt", "session_id"] }
    },
    {
      name: "codex",
      description: "Start a NEW Codex session.",
      inputSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] }
    },
    {
      name: "codex-reply",
      description: "Resume a Codex session.",
      inputSchema: { type: "object", properties: { prompt: { type: "string" }, session_id: { type: "string" } }, required: ["prompt", "session_id"] }
    },
    {
      name: "submit_batch",
      description: "Submit a list of tasks to run in parallel on the server.",
      inputSchema: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Unique ID for this task (e.g., 'task_1')" },
                agent: { type: "string", enum: ["claude", "codex"] },
                instruction: { type: "string", description: "The prompt for the agent" },
                session_id: { type: "string", description: "Optional session ID to resume" }
              },
              required: ["id", "agent", "instruction"]
            }
          }
        },
        required: ["tasks"]
      }
    },
    {
      name: "check_batch_status",
      description: "Poll for the status of a batch. Returns NEWLY completed tasks.",
      inputSchema: {
        type: "object",
        properties: {
          batch_id: { type: "string", description: "The Batch ID returned by submit_batch" },
          ack_task_ids: {
            type: "array",
            items: { type: "string" },
            description: "List of Task IDs you have successfully received/processed from the PREVIOUS poll. This prevents re-sending."
          }
        },
        required: ["batch_id"]
      }
    }
  ]
}));

async function callBackend(endpoint, body) {
  try {
    const res = await fetch(`${PYTHON_SERVER}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch (error) {
    throw error;
  }
}

async function handleSingleAgent(agent, prompt, sessionId = null) {
  try {
    const data = await callBackend(`/agent/${agent}`, { prompt, session_id: sessionId });
    
    // Formatting for visibility
    const prefix = agent.toUpperCase(); 
    const visibleOutput = `${prefix}_SESSION_ID: ${data.session_id}\n===================================\n${data.text}`;
    
    return { content: [{ type: "text", text: visibleOutput }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Backend Error: ${error.message}` }], isError: true };
  }
}

async function handleSubmitBatch(tasks) {
  try {
    const data = await callBackend("/batch/submit", { tasks });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Batch Submit Error: ${error.message}` }], isError: true };
  }
}

async function handleCheckBatch(batchId, ackTaskIds = []) {
  try {
    const data = await callBackend("/batch/status", { batch_id: batchId, ack_task_ids: ackTaskIds });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Batch Status Error: ${error.message}` }], isError: true };
  }
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === "claude") return handleSingleAgent("claude", args.prompt);
  if (name === "claude-reply") return handleSingleAgent("claude", args.prompt, args.session_id);
  if (name === "codex") return handleSingleAgent("codex", args.prompt);
  if (name === "codex-reply") return handleSingleAgent("codex", args.prompt, args.session_id);
  
  if (name === "submit_batch") return handleSubmitBatch(args.tasks);
  if (name === "check_batch_status") return handleCheckBatch(args.batch_id, args.ack_task_ids);

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);