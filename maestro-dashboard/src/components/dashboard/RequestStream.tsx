import type { LogEntry } from "@/hooks/useWebSocket";

interface RequestStreamProps {
  logs: LogEntry[];
  isConnected: boolean;
  connectionError?: string | null;
}

export default function RequestStream({
  logs,
  isConnected,
  connectionError,
}: RequestStreamProps) {
  return (
    <div className="flex flex-col h-full bg-[#0c0c0e] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <span className="material-icons-round text-gray-400 text-lg">
            monitor_heart
          </span>
          <h2 className="font-mono text-sm font-semibold text-gray-300">
            LIVE REQUEST STREAM
          </h2>
        </div>

      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs md:text-sm space-y-1">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            {connectionError ? (
              <p className="text-red-400">Connection Failed</p>
            ) : (
              <p className="text-gray-500">
                {isConnected ? "Waiting for logs..." : "Connecting to server..."}
              </p>
            )}
          </div>
        ) : (
          logs.slice(0, 15).map((log) => {
            const formatTimestamp = (timestamp: string) => {
              const parsed = new Date(timestamp);
              if (Number.isNaN(parsed.getTime())) return timestamp;
              const month = parsed.toLocaleString("en-US", { month: "short" });
              const day = parsed.getDate();
              const time = parsed.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
              return `${month} ${day} ${time}`;
            };
            const getAgentColor = (agent: string) => {
              return agent === "claude"
                ? "text-purple-400"
                : agent === "codex"
                  ? "text-green-400"
                  : "text-gray-400";
            };
            const getStatusColor = (status: string) => {
              const normalized = status.trim().toLowerCase();
              if (normalized === "success") return "text-green-400";
              if (normalized.includes("error") || normalized.includes("failed")) {
                return "text-red-400";
              }
              if (normalized.includes("running")) return "text-yellow-400";
              return "text-gray-400";
            };

            return (
              <div
                key={log.id}
                className="grid grid-cols-12 gap-2 hover:bg-white/5 p-1 rounded transition-colors"
              >
                <span className="col-span-2 text-gray-500 whitespace-nowrap tabular-nums">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className="col-span-2 text-blue-400 truncate font-mono">
                  {log.conversation_id
                    ? `${log.conversation_id.slice(0, 3)}...${log.conversation_id.slice(-4)}`
                    : "---"}
                </span>
                <span className={`col-span-2 ${getAgentColor(log.agent)}`}>
                  {log.agent}
                </span>
                <span
                  className="col-span-4 text-gray-300 truncate"
                  title={log.task}
                >
                  {(log.task || "").substring(0, 40)}...
                </span>
                <span
                  className={`col-span-2 text-right pr-4 whitespace-nowrap ${getStatusColor(
                    log.status,
                  )}`}
                >
                  {log.status}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
