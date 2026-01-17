import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOGS_DIR = path.join(process.cwd(), "..", "logs");

export interface SessionSummary {
  id: string;
  agent: "claude" | "codex";
  created_at: string;
  status: "completed" | "error" | "active";
  prompt: string;
  response: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentFilter = searchParams.get("agent");

  try {
    const sessions: SessionSummary[] = [];
    const agents = ["claude", "codex"];

    for (const agent of agents) {
      if (agentFilter && agentFilter !== "all" && agentFilter !== agent) {
        continue;
      }

      const agentDir = path.join(LOGS_DIR, agent);

      if (!fs.existsSync(agentDir)) {
        continue;
      }

      const files = fs.readdirSync(agentDir).filter((f) => f.endsWith(".json"));

      for (const file of files) {
        try {
          const filePath = path.join(agentDir, file);
          const content = fs.readFileSync(filePath, "utf-8");
          const data = JSON.parse(content);

          const lastLog = data.logs?.[data.logs.length - 1];
          const status =
            lastLog?.status === "Success"
              ? "completed"
              : lastLog?.status === "Error" || lastLog?.status === "Failed"
              ? "error"
              : "completed";

          sessions.push({
            id: data.session_id,
            agent: data.agent as "claude" | "codex",
            created_at: data.created_at,
            status,
            prompt: lastLog?.prompt || "",
            response: lastLog?.response || "",
          });
        } catch (e) {
          console.error(`Error parsing ${file}:`, e);
        }
      }
    }

    // Sort by created_at descending (most recent first)
    sessions.sort((a, b) => {
      // Try to parse as time strings (HH:MM:SS format)
      return b.created_at.localeCompare(a.created_at);
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error reading sessions:", error);
    return NextResponse.json({ error: "Failed to read sessions" }, { status: 500 });
  }
}
