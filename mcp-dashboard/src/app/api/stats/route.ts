import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();

    // Start of today (midnight)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 60 minutes ago
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Count claude and codex tasks created today
    const [claudeTasks, codexTasks, recentLogs] = await Promise.all([
      db.taskLog.count({
        where: {
          agent: "claude",
          createdAt: { gte: todayStart },
        },
      }),
      db.taskLog.count({
        where: {
          agent: "codex",
          createdAt: { gte: todayStart },
        },
      }),
      db.taskLog.findMany({
        where: {
          createdAt: { gte: oneHourAgo },
        },
        select: { duration: true },
      }),
    ]);

    // Calculate average latency from logs in the last 60 minutes
    let avgLatency = 0;
    if (recentLogs.length > 0) {
      const totalDuration = recentLogs.reduce((sum, log) => sum + log.duration, 0);
      avgLatency = Math.round(totalDuration / recentLogs.length);
    }

    return NextResponse.json({
      claudeTasks,
      codexTasks,
      avgLatency,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
