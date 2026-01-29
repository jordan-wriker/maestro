import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Batch as APIBatch } from "../types/api";
import type { LogEntry } from "../types/api";
import { api } from "../api/endpoints";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatsCard } from "@/components/ui/StatsCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AGENT_COLORS } from "@/config/constants";

export default function BatchPage() {
  const { currentSession } = useWebSocket();
  const [batches, setBatches] = useState<APIBatch[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh] = useState(true);

  const fetchData = async (isInitial = false) => {
    if (!currentSession) {
      setBatches([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    if (isInitial) {
      setLoading(true);
      setBatches([]);
      setLogs([]);
    }
    try {
      const [batchesData, logsData] = await Promise.all([
        api.batches.list(currentSession.session_id),
        api.logs.list(currentSession.session_id)
      ]);
      setBatches(batchesData);
      setLogs(logsData);
    } catch (error) {
      console.error('Failed to fetch batch data:', error);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);

    let interval: number | undefined;
    if (autoRefresh) {
      interval = window.setInterval(() => fetchData(false), 5000);
    }
    return () => clearInterval(interval);
  }, [currentSession, autoRefresh]);

  // Derived metrics
  const activeBatches = batches.filter(b => ["pending", "running", "processing"].includes(b.status.toLowerCase())).length;
  const completedBatches = batches.filter(b => ["completed", "success"].includes(b.status.toLowerCase())).length;
  const successRate = batches.length > 0
    ? Math.round((completedBatches / batches.length) * 100)
    : 0;

  return (
    <div className="p-4 h-full overflow-y-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Batch Monitor</h1>
          <p className="text-gray-400">
            Monitoring parallel task orchestration and agent execution for <span className="text-primary font-semibold">{currentSession?.title || "selected session"}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            <span className="material-icons-round text-lg">refresh</span>
            Refresh Data
          </button>
        </div>
      </div>

      {!currentSession ? (
        <div className="bg-surface-dark border border-white/5 rounded-2xl p-12 text-center">
          <span className="material-icons-round text-4xl text-gray-600 mb-4">folder_off</span>
          <h2 className="text-xl font-bold text-white mb-2">No Active Session</h2>
          <p className="text-gray-400 mb-6">Please select or create a work session to monitor batches.</p>
          <a href="/sessions" className="inline-flex py-2.5 px-6 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-all">
            Go to Sessions
          </a>
        </div>
      ) : loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard
              title="Active Batches"
              value={activeBatches}
              subValue="Current"
              subValueColor="text-primary bg-primary/10"
            />
            <StatsCard
              title="Completed"
              value={completedBatches}
              subValue="Total"
              subValueColor="text-green-500 bg-green-500/10"
            />
            <StatsCard
              title="Success Rate"
              value={`${successRate}%`}
              subValue="Global"
              subValueColor="text-blue-400 bg-blue-500/10"
            />
          </div>

          {/* Recent Batch Operations */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Batch Operations</h2>
              <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                <span>AUTO-REFRESH: {autoRefresh ? "ON" : "OFF"}</span>
                <div className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}></div>
              </div>
            </div>

            {batches.length === 0 ? (
              <div className="bg-surface-dark border border-white/5 rounded-2xl p-8 text-center text-gray-500 italic">
                No batches found for this session.
              </div>
            ) : (
              batches.map((batch) => {
                const progress = Math.round(batch.progress);
                const isSuccess = ["completed", "success"].includes(batch.status.toLowerCase());
                const isError = ["failed", "error", "partial_failure"].includes(batch.status.toLowerCase());

                return (
                  <div
                    key={batch.batch_id}
                    className={`bg-surface-dark border border-white/5 rounded-2xl overflow-hidden hover:border-primary/50 transition-all ${isSuccess ? "opacity-90 hover:opacity-100" : ""
                      }`}
                  >
                    <div className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className={`font-mono text-sm font-bold ${isSuccess ? "text-green-500" : isError ? "text-yellow-500" : "text-primary"}`}>
                              #{batch.batch_id}
                            </span>
                            <span className="text-xs text-gray-500">
                              Updated: {new Date(batch.updated_at).toLocaleTimeString()}
                            </span>
                            <StatusBadge status={batch.status} type="batch" />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">
                                Overall Progress ({batch.completed_tasks}/{batch.total_tasks} tasks)
                              </span>
                              <span className="text-white font-medium">{progress}%</span>
                            </div>
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${isSuccess ? "bg-green-500" : isError ? "bg-red-500" : "bg-primary"
                                  } transition-all duration-1000 shadow-[0_0_10px_rgba(124,58,237,0.4)]`}
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors">
                            View Details
                          </button>
                          {!isSuccess && !isError && (
                            <button className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-400 transition-colors">
                              Stop
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sub-agent Workflow - Only for processing/running batches */}
                    {(batch.status.toLowerCase() === "running" || batch.status.toLowerCase() === "processing") && (
                      <div className="mt-6 pt-6 border-t border-white/5 px-6">
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <span className="material-icons-round text-sm">hub</span>
                          Sub-agent Workflow
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {batch.tasks && batch.tasks.map((task) => {
                            // Status Mapping for tasks - handled manually here for specific visual style desired for tasks
                            const isTaskCompleted = ["completed", "success"].includes(task.status.toLowerCase());
                            const isTaskRunning = ["running", "processing"].includes(task.status.toLowerCase());
                            const isTaskFailed = ["failed", "error"].includes(task.status.toLowerCase());

                            let cardClass = "bg-white/[0.02] border-white/5 opacity-50";
                            let dotClass = "bg-gray-600";
                            let statusText = "QUEUED";
                            let statusColor = "text-gray-500";

                            if (isTaskCompleted) {
                              cardClass = "bg-white/[0.02] border-white/5";
                              dotClass = "bg-green-500 shadow-[0_0_10px_rgba(74,222,128,0.4)]";
                              statusText = "COMPLETED";
                              statusColor = "text-gray-500";
                            } else if (isTaskRunning) {
                              cardClass = "bg-white/[0.05] border-primary/30";
                              dotClass = "bg-primary animate-pulse shadow-[0_0_20px_rgba(124,58,237,0.4)]";
                              statusText = "RUNNING";
                              statusColor = "text-primary font-bold";
                            } else if (isTaskFailed) {
                              cardClass = "bg-red-500/5 border-red-500/20";
                              dotClass = "bg-red-500";
                              statusText = "FAILED";
                              statusColor = "text-red-400 font-bold";
                            }

                            return (
                              <div key={task.task_id} className={`p-3 border rounded-xl flex items-center gap-3 ${cardClass}`}>
                                <div className={`w-2 h-2 rounded-full ${dotClass}`}></div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-white truncate">Task: {task.task_id}</p>
                                  <p className={`text-[10px] uppercase ${statusColor}`}>{statusText}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Agent Execution Logs */}
      <div className="flex flex-col h-[280px] bg-[#0c0c0e] rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="material-icons-round text-gray-400 text-lg">terminal</span>
            <h2 className="font-mono text-xs font-semibold text-gray-400">AGENT EXECUTION LOGS</h2>
          </div>
          <div className="flex gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-white/10"></div>
            <div className="h-2.5 w-2.5 rounded-full bg-white/10"></div>
            <div className="h-2.5 w-2.5 rounded-full bg-white/10"></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 scrollbar-hide">
          {logs.length === 0 ? (
            <div className="text-gray-600 italic px-2">No execution logs available.</div>
          ) : (
            logs.map((log, index) => {
              // Simple color mapping if AGENT_COLORS has keys matching
              // If not, fall back to gray/white
              // AGENT_COLORS keys: blue, green, purple, orange.
              // Agents usually: Claude (purple?), GPT (green?) - need to check constants.
              // Assuming agents might be random strings, we might just default or try to match.

              const isWarning = log.status === 'error'; // simplified assumption
              let sourceColor = "text-gray-400";
              const agentLower = log.agent.toLowerCase();
              if (agentLower.includes('claude')) sourceColor = AGENT_COLORS.purple?.text || "text-purple-400";
              else if (agentLower.includes('gpt')) sourceColor = AGENT_COLORS.green?.text || "text-green-400";
              else if (agentLower.includes('manager')) sourceColor = AGENT_COLORS.blue?.text || "text-blue-400";

              return (
                <div key={index} className="flex gap-4 text-gray-500">
                  <span className="w-20 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={sourceColor}>[{log.agent.toUpperCase()}]</span>
                  <span className={isWarning ? "text-yellow-400/80" : "text-gray-300"}>
                    {log.task || log.final_response || "Processing..."}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
