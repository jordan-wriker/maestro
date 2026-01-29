import { useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { api } from "@/api/endpoints";

export default function CompactStatsCards() {
  const { currentSession } = useWebSocket();
  const [stats, setStats] = useState({
    claudeTasks: 0,
    codexTasks: 0,
    avgLatency: 0,
  });

  useEffect(() => {
    if (!currentSession) {
      setStats({
        claudeTasks: 0,
        codexTasks: 0,
        avgLatency: 0,
      });
      return;
    }

    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const loadStats = async () => {
      try {
        const data = await api.stats.get(currentSession.session_id);
        if (!isMounted) return;
        setStats({
          claudeTasks: data?.claudeTasks ?? 0,
          codexTasks: data?.codexTasks ?? 0,
          avgLatency: data?.avgLatency ?? 0,
        });
      } catch {
        // Ignore transient errors; keep defaults.
      }
    };

    loadStats();
    intervalId = setInterval(loadStats, 5000);
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentSession]);

  const statsCards = [
    {
      title: "Claude Tasks",
      value: stats.claudeTasks.toLocaleString(),
      change: "+12.5%",
      changeType: "positive",
      icon: "psychology",
      iconColor: "text-primary",
      progress: 75,
      progressColor: "bg-primary",
      subtitle: "Tokens processed today",
    },
    {
      title: "Codex Tasks",
      value: stats.codexTasks.toLocaleString(),
      change: "+4.2%",
      changeType: "positive",
      icon: "code",
      iconColor: "text-blue-500",
      progress: 45,
      progressColor: "bg-blue-500",
      subtitle: "Code generations today",
    },
    {
      title: "Avg Task Latency",
      value: stats.avgLatency.toLocaleString(),
      valueSuffix: "ms",
      change: "+2ms",
      changeType: "negative",
      icon: "speed",
      iconColor: "text-orange-500",
      showChart: true,
      subtitle: "Last 60 minutes",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statsCards.map((card) => (
        <div
          key={card.title}
          className="bg-[#0f0f12] p-4 rounded-xl border border-white/5 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className={`material-icons-round text-4xl ${card.iconColor}`}>
              {card.icon}
            </span>
          </div>
          <h3 className="text-gray-400 text-xs font-medium mb-1">{card.title}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {card.value}
              {card.valueSuffix && (
                <span className="text-sm text-gray-500 font-normal">
                  {card.valueSuffix}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${card.changeType === "positive"
                ? "text-green-500 bg-green-500/10"
                : "text-red-400 bg-red-500/10"
                }`}
            >
              {card.change}
            </span>
          </div>
          {card.progress !== undefined && (
            <div className="mt-3 h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${card.progressColor} rounded-full`}
                style={{ width: `${card.progress}%` }}
              ></div>
            </div>
          )}
          {card.showChart && (
            <div className="mt-3 flex items-end gap-1 h-6 w-full">
              {[40, 60, 50, 80, 45, 55].map((height, i) => (
                <div
                  key={i}
                  className={`w-1/6 rounded-t-sm ${i === 5 ? "bg-orange-500" : "bg-orange-500/20"}`}
                  style={{ height: `${height}%` }}
                ></div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-500 mt-2">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
