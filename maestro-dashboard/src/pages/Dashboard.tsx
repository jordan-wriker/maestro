import { useWebSocket } from "@/hooks/useWebSocket";
import CompactActiveTools from "@/components/dashboard/CompactActiveTools";
import RequestStream from "@/components/dashboard/RequestStream";
import CompactStatsCards from "@/components/dashboard/CompactStatsCards";

export default function OverviewPage() {
  const { logs, isConnected, connectionError } = useWebSocket();
  return (
    <div className="flex flex-col h-screen p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Server Status</h1>
          <p className="text-gray-400">
            Real-time monitoring of AI context bridges.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-[#0f0f12] px-4 py-2 rounded-xl border border-white/10 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
            </span>
            <span className="text-sm font-semibold text-green-400">
              Operational
            </span>
          </div>
          <div className="h-4 w-px bg-white/20"></div>
          <div className="text-sm font-mono text-gray-300">
            Uptime: <span className="text-white">99.9%</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="shrink-0">
        <CompactStatsCards />
      </div>

      <div className="shrink-0">
        <CompactActiveTools />
      </div>

      {/* Live Request Stream - fills remaining space with internal scrolling */}
      <div className="flex-1 min-h-0">
        <RequestStream
          logs={logs}
          isConnected={isConnected}
          connectionError={connectionError}
        />
      </div>
    </div>
  );
}
