import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const taskLogs = await db.taskLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const logs = taskLogs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      agent: log.agent,
      command: log.agent, // Use agent as command (no separate command field in DB)
      prompt: log.prompt,
      session_id: log.sessionId,
      status: log.status,
      response: "", // DB lacks response field
      raw_output: "", // DB lacks raw_output field
    }));

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
