import { db } from "./db";

export interface DailyUsageStats {
  claude: {
    today: number;
    yesterday: number;
    percentageChange: number;
  };
  codex: {
    today: number;
    yesterday: number;
    percentageChange: number;
  };
}

export interface LatencyStats {
  averageLatency: number;
  requestCount: number;
}

function getStartOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function calculatePercentageChange(today: number, yesterday: number): number {
  if (yesterday === 0) {
    return today > 0 ? 100 : 0;
  }
  return Math.round(((today - yesterday) / yesterday) * 100);
}

export async function getDailyUsageStats(): Promise<DailyUsageStats> {
  const now = new Date();
  const todayStart = getStartOfDay(now);
  const todayEnd = getEndOfDay(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = getStartOfDay(yesterday);
  const yesterdayEnd = getEndOfDay(yesterday);

  const [claudeToday, claudeYesterday, codexToday, codexYesterday] =
    await Promise.all([
      db.taskLog.count({
        where: {
          agent: "claude",
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      db.taskLog.count({
        where: {
          agent: "claude",
          createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
      }),
      db.taskLog.count({
        where: {
          agent: "codex",
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      db.taskLog.count({
        where: {
          agent: "codex",
          createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
      }),
    ]);

  return {
    claude: {
      today: claudeToday,
      yesterday: claudeYesterday,
      percentageChange: calculatePercentageChange(claudeToday, claudeYesterday),
    },
    codex: {
      today: codexToday,
      yesterday: codexYesterday,
      percentageChange: calculatePercentageChange(codexToday, codexYesterday),
    },
  };
}

export async function getLatencyStats(): Promise<LatencyStats> {
  const recentRequests = await db.taskLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { duration: true },
  });

  if (recentRequests.length === 0) {
    return {
      averageLatency: 0,
      requestCount: 0,
    };
  }

  const totalLatency = recentRequests.reduce(
    (sum: number, req: { duration: number }) => sum + req.duration,
    0
  );
  const averageLatency = Math.round(totalLatency / recentRequests.length);

  return {
    averageLatency,
    requestCount: recentRequests.length,
  };
}
