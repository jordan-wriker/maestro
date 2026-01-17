import { getDailyUsageStats, getLatencyStats } from "@/lib/stats";

function formatNumber(num: number): string {
  if (num >= 1000) {
    return num.toLocaleString();
  }
  return num.toString();
}

function formatChange(percentageChange: number): string {
  const sign = percentageChange >= 0 ? "+" : "";
  return `${sign}${percentageChange}%`;
}

export default async function StatsCards() {
  const [usageStats, latencyStats] = await Promise.all([
    getDailyUsageStats(),
    getLatencyStats(),
  ]);

  const totalRequestsToday = usageStats.claude.today + usageStats.codex.today;
  const totalRequestsYesterday =
    usageStats.claude.yesterday + usageStats.codex.yesterday;
  const totalPercentageChange =
    totalRequestsYesterday === 0
      ? totalRequestsToday > 0
        ? 100
        : 0
      : Math.round(
          ((totalRequestsToday - totalRequestsYesterday) /
            totalRequestsYesterday) *
            100
        );

  const statsCards = [
    {
      title: "Total Requests",
      value: formatNumber(totalRequestsToday),
      change: formatChange(totalPercentageChange),
      changeType: totalPercentageChange >= 0 ? "positive" : "negative",
      icon: "analytics",
      iconColor: "text-purple-500",
      progress: Math.min(
        100,
        totalRequestsYesterday > 0
          ? Math.round((totalRequestsToday / totalRequestsYesterday) * 100)
          : totalRequestsToday > 0
            ? 100
            : 0
      ),
      progressColor: "bg-purple-500",
      subtitle: "Requests today vs yesterday",
    },
    {
      title: "Claude Usage",
      value: formatNumber(usageStats.claude.today),
      change: formatChange(usageStats.claude.percentageChange),
      changeType:
        usageStats.claude.percentageChange >= 0 ? "positive" : "negative",
      icon: "psychology",
      iconColor: "text-primary",
      progress: Math.min(
        100,
        usageStats.claude.yesterday > 0
          ? Math.round(
              (usageStats.claude.today / usageStats.claude.yesterday) * 100
            )
          : usageStats.claude.today > 0
            ? 100
            : 0
      ),
      progressColor: "bg-primary",
      subtitle: "Claude requests today",
    },
    {
      title: "Codex Usage",
      value: formatNumber(usageStats.codex.today),
      change: formatChange(usageStats.codex.percentageChange),
      changeType:
        usageStats.codex.percentageChange >= 0 ? "positive" : "negative",
      icon: "code",
      iconColor: "text-blue-500",
      progress: Math.min(
        100,
        usageStats.codex.yesterday > 0
          ? Math.round(
              (usageStats.codex.today / usageStats.codex.yesterday) * 100
            )
          : usageStats.codex.today > 0
            ? 100
            : 0
      ),
      progressColor: "bg-blue-500",
      subtitle: "Codex requests today",
    },
    {
      title: "Average Latency",
      value: formatNumber(latencyStats.averageLatency),
      valueSuffix: "ms",
      change: `${latencyStats.requestCount} samples`,
      changeType: "neutral",
      icon: "speed",
      iconColor: "text-orange-500",
      showChart: true,
      subtitle: "Last 60 requests",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsCards.map((card) => (
        <div
          key={card.title}
          className="bg-[#0f0f12] p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span
              className={`material-icons-round text-6xl ${card.iconColor}`}
            >
              {card.icon}
            </span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">
            {card.title}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {card.value}
              {card.valueSuffix && (
                <span className="text-lg text-gray-500 font-normal">
                  {card.valueSuffix}
                </span>
              )}
            </span>
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                card.changeType === "positive"
                  ? "text-green-500 bg-green-500/10"
                  : card.changeType === "negative"
                    ? "text-red-400 bg-red-500/10"
                    : "text-gray-400 bg-gray-500/10"
              }`}
            >
              {card.change}
            </span>
          </div>
          {card.progress !== undefined && (
            <div className="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${card.progressColor} rounded-full`}
                style={{ width: `${card.progress}%` }}
              ></div>
            </div>
          )}
          {card.showChart && (
            <div className="mt-4 flex items-end gap-1 h-8 w-full">
              {[40, 60, 50, 80, 45, 55].map((height, i) => (
                <div
                  key={i}
                  className={`w-1/6 rounded-t-sm ${i === 5 ? "bg-orange-500" : "bg-orange-500/20"}`}
                  style={{ height: `${height}%` }}
                ></div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
