import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOGS_DIR = path.join(process.cwd(), "..", "logs");

export interface SessionEvent {
  type: "prompt" | "system" | "response" | "tool_call" | "result" | "thinking";
  content: string;
  tool?: string;
  output?: string;
  timestamp?: string;
}

export interface SessionDetail {
  id: string;
  agent: "claude" | "codex";
  created_at: string;
  events: SessionEvent[];
  status: "completed" | "error" | "active";
  prompt: string;
}

interface ClaudeLogEntry {
  prompt?: string;
  raw_output?: string;
  events?: SessionEvent[];
}

function parseClaudeEvents(data: { logs?: ClaudeLogEntry[] }): SessionEvent[] {
  const events: SessionEvent[] = [];
  const logs = data.logs || [];

  for (const log of logs) {
    // Check if this log entry has pre-parsed events
    if (log.events && Array.isArray(log.events)) {
      // Convert "response" events to "thinking" for Claude
      for (const evt of log.events) {
        if (evt.type === "response") {
          events.push({ ...evt, type: "thinking" });
        } else {
          events.push(evt);
        }
      }
      continue;
    }

    // Otherwise, add the initial prompt
    if (log.prompt) {
      events.push({
        type: "prompt",
        content: log.prompt,
      });
    }

    // Parse raw_output - Claude uses a JSON array, not NDJSON
    if (log.raw_output) {
      try {
        // Claude's raw_output is a JSON array
        const rawEvents = JSON.parse(log.raw_output);

        if (Array.isArray(rawEvents)) {
          for (const event of rawEvents) {
            if (event.type === "system" && event.subtype === "init") {
              events.push({
                type: "system",
                content: `Session initialized (model: ${event.model})`,
              });
            } else if (event.type === "assistant" && event.message?.content) {
              for (const content of event.message.content) {
                if (content.type === "text") {
                  // Claude's intermediate text responses are treated as thinking
                  events.push({
                    type: "thinking",
                    content: content.text,
                  });
                } else if (content.type === "tool_use") {
                  events.push({
                    type: "tool_call",
                    tool: content.name,
                    content: JSON.stringify(content.input, null, 2),
                  });
                }
              }
            } else if (event.type === "user" && event.tool_use_result) {
              // This is a tool result
              const result = event.tool_use_result;
              let output = "";
              if (result.type === "text" && result.file) {
                output = result.file.content?.substring(0, 500) || "";
                if (result.file.content?.length > 500) {
                  output += "\n... (truncated)";
                }
              } else if (event.message?.content) {
                // Try to get output from message content
                for (const c of event.message.content) {
                  if (c.type === "tool_result" && c.content) {
                    output = typeof c.content === "string"
                      ? c.content.substring(0, 500)
                      : JSON.stringify(c.content).substring(0, 500);
                    if (output.length >= 500) {
                      output += "\n... (truncated)";
                    }
                  }
                }
              }
              if (output) {
                events.push({
                  type: "tool_call",
                  tool: "Result",
                  content: "",
                  output,
                });
              }
            } else if (event.type === "result") {
              events.push({
                type: "result",
                content: event.result || "",
              });
            }
          }
        }
      } catch {
        // Couldn't parse raw output as JSON array
      }
    }
  }

  return events;
}

function parseCodexEvents(data: { logs?: unknown[] }): SessionEvent[] {
  const events: SessionEvent[] = [];
  const logs = data.logs || [];

  for (const log of logs as Array<{ prompt?: string; raw_output?: string }>) {
    // Add the initial prompt
    if (log.prompt) {
      events.push({
        type: "prompt",
        content: log.prompt,
      });
    }

    // Parse raw_output NDJSON for Codex
    if (log.raw_output) {
      try {
        const lines = log.raw_output.split("\n").filter((l: string) => l.trim());
        for (const line of lines) {
          try {
            const event = JSON.parse(line);

            if (event.type === "thread.started") {
              events.push({
                type: "system",
                content: `Thread started: ${event.thread_id}`,
              });
            } else if (event.type === "item.completed") {
              const item = event.item;
              if (item?.type === "reasoning") {
                events.push({
                  type: "thinking",
                  content: item.text || "",
                });
              } else if (item?.type === "command_execution") {
                events.push({
                  type: "tool_call",
                  tool: "Bash",
                  content: item.command || "",
                  output: item.aggregated_output || "",
                });
              } else if (item?.type === "agent_message") {
                events.push({
                  type: "result",
                  content: item.text || "",
                });
              }
            }
          } catch {
            // Not JSON, skip
          }
        }
      } catch {
        // Couldn't parse raw output
      }
    }
  }

  return events;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Search in both claude and codex directories
    const agents = ["claude", "codex"];

    for (const agent of agents) {
      const filePath = path.join(LOGS_DIR, agent, `${id}.json`);

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);

        const events =
          agent === "claude" ? parseClaudeEvents(data) : parseCodexEvents(data);

        const lastLog = data.logs?.[data.logs.length - 1];
        const status =
          lastLog?.status === "Success"
            ? "completed"
            : lastLog?.status === "Error" || lastLog?.status === "Failed"
            ? "error"
            : "completed";

        const session: SessionDetail = {
          id: data.session_id,
          agent: agent as "claude" | "codex",
          created_at: data.created_at,
          events,
          status,
          prompt: lastLog?.prompt || "",
        };

        return NextResponse.json(session);
      }
    }

    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  } catch (error) {
    console.error("Error reading session:", error);
    return NextResponse.json({ error: "Failed to read session" }, { status: 500 });
  }
}
