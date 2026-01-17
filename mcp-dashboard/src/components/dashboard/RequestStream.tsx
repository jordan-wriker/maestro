import type { LogEntry } from "@/hooks/useWebSocket";

interface RequestStreamProps {
  logs: LogEntry[];
  isConnected: boolean;
}

export default function RequestStream({
  logs,
  isConnected,
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
            <p className="text-gray-500">
              {isConnected ? "Waiting for logs..." : "Connecting to server..."}
            </p>
          </div>
        ) : (
          [...logs].reverse().slice(0, 15).map((log) => {
            const getAgentColor = (agent: string) => {
              return agent === "claude"
                ? "text-purple-400"
                : agent === "codex"
                  ? "text-green-400"
                  : "text-gray-400";
            };
            const getStatusColor = (status: string) => {
              if (status.includes("Success")) return "text-green-400";
              if (status.includes("Error") || status.includes("Failed")) {
                return "text-red-400";
              }
              if (status.includes("Running")) return "text-yellow-400";
              return "text-gray-400";
            };

            return (
              <div
                key={log.id}
                className="grid grid-cols-12 gap-2 hover:bg-white/5 p-1 rounded transition-colors"
              >
                <span className="col-span-2 text-gray-500">{log.timestamp}</span>
                <span className="col-span-2 text-blue-400 truncate">
                  /agent/{log.agent}
                </span>
                <span className={`col-span-2 ${getAgentColor(log.agent)}`}>
                  {log.agent}
                </span>
                <span
                  className="col-span-4 text-gray-300 truncate"
                  title={log.prompt}
                >
                  {log.prompt.substring(0, 40)}...
                </span>
                <span
                  className={`col-span-2 text-right ${getStatusColor(log.status)}`}
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
