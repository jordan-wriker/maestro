const statsCards = [
  {
    title: "Claude API Usage",
    value: "48,201",
    change: "+12.5%",
    changeType: "positive",
    icon: "psychology",
    iconColor: "text-primary",
    progress: 75,
    progressColor: "bg-primary",
    subtitle: "Tokens processed today",
  },
  {
    title: "ChatGPT Codex Requests",
    value: "12,405",
    change: "+4.2%",
    changeType: "positive",
    icon: "code",
    iconColor: "text-blue-500",
    progress: 45,
    progressColor: "bg-blue-500",
    subtitle: "Code generations today",
  },
  {
    title: "Average Latency",
    value: "142",
    valueSuffix: "ms",
    change: "+2ms",
    changeType: "negative",
    icon: "speed",
    iconColor: "text-orange-500",
    showChart: true,
    subtitle: "Last 60 minutes",
  },
];

export default function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {statsCards.map((card) => (
        <div
          key={card.title}
          className="bg-[#0f0f12] p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className={`material-icons-round text-6xl ${card.iconColor}`}>
              {card.icon}
            </span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">{card.title}</h3>
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
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${card.changeType === "positive"
                ? "text-green-500 bg-green-500/10"
                : "text-red-400 bg-red-500/10"
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
