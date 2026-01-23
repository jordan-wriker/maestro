import { useState } from "react";

interface SubTask {
  name: string;
  model: string;
  status: "completed" | "running" | "queued";
}

interface BatchOperation {
  id: string;
  startTime: string;
  status: "processing" | "partial_failure" | "success";
  completedTasks: number;
  totalTasks: number;
  subTasks?: SubTask[];
}

interface LogEntry {
  time: string;
  source: string;
  sourceColor: string;
  message: string;
  isWarning?: boolean;
}

const batchOperations: BatchOperation[] = [
  {
    id: "BCH-8842-X",
    startTime: "10:42:05 AM",
    status: "processing",
    completedTasks: 6,
    totalTasks: 10,
    subTasks: [
      { name: "Task 1", model: "Claude-3-Sonnet", status: "completed" },
      { name: "Task 2", model: "GPT-4o", status: "running" },
      { name: "Task 3", model: "Llama-3-70B", status: "queued" },
      { name: "Task 4", model: "Gemini Pro", status: "queued" },
    ],
  },
  {
    id: "BCH-8841-A",
    startTime: "10:15:22 AM",
    status: "partial_failure",
    completedTasks: 22,
    totalTasks: 24,
  },
  {
    id: "BCH-8839-Q",
    startTime: "09:30:11 AM",
    status: "success",
    completedTasks: 48,
    totalTasks: 48,
  },
];

const logEntries: LogEntry[] = [
  {
    time: "10:45:01",
    source: "MANAGER",
    sourceColor: "text-primary",
    message: "Spawning agent sub-process for BCH-8842-X task-7",
  },
  {
    time: "10:45:02",
    source: "CLAUDE",
    sourceColor: "text-blue-400",
    message: "Context window initialized (200k tokens available)",
  },
  {
    time: "10:45:05",
    source: "GPT-4O",
    sourceColor: "text-purple-400",
    message: 'Tool calling requested: "file_system_search"',
  },
  {
    time: "10:45:10",
    source: "SYSTEM",
    sourceColor: "text-yellow-500",
    message: "Warning: Latency spike detected on OpenAI gateway (450ms)",
    isWarning: true,
  },
  {
    time: "10:45:12",
    source: "SUCCESS",
    sourceColor: "text-green-400",
    message: "Task 1 completion verified and stored in vector DB",
  },
];

function getStatusConfig(status: BatchOperation["status"]) {
  switch (status) {
    case "processing":
      return {
        label: "PROCESSING",
        bgColor: "bg-primary/10",
        textColor: "text-primary",
        borderColor: "border-primary/20",
        idColor: "text-primary",
      };
    case "partial_failure":
      return {
        label: "PARTIAL FAILURE",
        bgColor: "bg-yellow-500/10",
        textColor: "text-yellow-500",
        borderColor: "border-yellow-500/20",
        idColor: "text-yellow-500",
      };
    case "success":
      return {
        label: "SUCCESS",
        bgColor: "bg-green-500/10",
        textColor: "text-green-500",
        borderColor: "border-green-500/20",
        idColor: "text-green-500",
      };
  }
}

function getSubTaskStatusConfig(status: SubTask["status"]) {
  switch (status) {
    case "completed":
      return {
        dotColor: "bg-green-500",
        dotShadow: "shadow-[0_0_10px_rgba(74,222,128,0.4)]",
        statusText: "COMPLETED",
        statusColor: "text-gray-500",
        bgColor: "bg-white/[0.02]",
        borderColor: "border-white/5",
        opacity: "",
      };
    case "running":
      return {
        dotColor: "bg-primary",
        dotShadow: "shadow-[0_0_15px_rgba(124,58,237,0.3)]",
        statusText: "RUNNING",
        statusColor: "text-primary font-bold",
        bgColor: "bg-white/[0.05]",
        borderColor: "border-primary/30",
        opacity: "",
        animate: true,
      };
    case "queued":
      return {
        dotColor: "bg-gray-600",
        dotShadow: "",
        statusText: "QUEUED",
        statusColor: "text-gray-500",
        bgColor: "bg-white/[0.02]",
        borderColor: "border-white/5",
        opacity: "opacity-50",
      };
  }
}

export default function BatchPage() {
  const [autoRefresh] = useState(true);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Batch Monitor</h1>
          <p className="text-gray-400">
            Monitoring parallel task orchestration and agent execution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2">
            <span className="material-icons-round text-lg">refresh</span>
            Refresh Data
          </button>
          <button className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.4)]">
            <span className="material-icons-round text-lg">add</span>
            New Batch
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Batches */}
        <div className="bg-surface-dark p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group">
          <h3 className="text-gray-400 text-sm font-medium mb-2">
            Active Batches
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">12</span>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              Current
            </span>
          </div>
          <div className="mt-4 flex gap-1">
            <div className="h-1.5 w-1/4 bg-primary rounded-full shadow-[0_0_20px_rgba(124,58,237,0.4)]"></div>
            <div className="h-1.5 w-1/4 bg-primary/40 rounded-full"></div>
            <div className="h-1.5 w-1/4 bg-primary/20 rounded-full"></div>
            <div className="h-1.5 w-1/4 bg-white/5 rounded-full"></div>
          </div>
        </div>

        {/* Completed Today */}
        <div className="bg-surface-dark p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group">
          <h3 className="text-gray-400 text-sm font-medium mb-2">
            Completed Today
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">142</span>
            <span className="text-xs font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded">
              +18%
            </span>
          </div>
          <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-[85%] shadow-[0_0_10px_rgba(74,222,128,0.4)]"></div>
          </div>
        </div>

        {/* Failed Tasks */}
        <div className="bg-surface-dark p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group">
          <h3 className="text-gray-400 text-sm font-medium mb-2">
            Failed Tasks
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">3</span>
            <span className="text-xs font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
              Alert
            </span>
          </div>
          <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 w-[15%]"></div>
          </div>
        </div>
      </div>

      {/* Recent Batch Operations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Recent Batch Operations
          </h2>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
            <span>AUTO-REFRESH: {autoRefresh ? "ON" : "OFF"}</span>
            <div
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-500"
              }`}
            ></div>
          </div>
        </div>

        {/* Batch Cards */}
        {batchOperations.map((batch) => {
          const statusConfig = getStatusConfig(batch.status);
          const progress = Math.round(
            (batch.completedTasks / batch.totalTasks) * 100
          );
          const isSuccess = batch.status === "success";
          const isPartialFailure = batch.status === "partial_failure";

          return (
            <div
              key={batch.id}
              className={`bg-surface-dark border border-white/5 rounded-2xl overflow-hidden hover:border-primary/50 transition-all ${
                isSuccess ? "opacity-80 hover:opacity-100" : ""
              }`}
            >
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    {/* Batch Header */}
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span
                        className={`font-mono text-sm font-bold ${statusConfig.idColor}`}
                      >
                        #{batch.id}
                      </span>
                      <span className="text-xs text-gray-500">
                        Started: {batch.startTime}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusConfig.bgColor} ${statusConfig.textColor} border ${statusConfig.borderColor} tracking-wider`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">
                          Overall Progress ({batch.completedTasks}/
                          {batch.totalTasks} tasks)
                        </span>
                        <span className="text-white font-medium">
                          {progress}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                        {isPartialFailure ? (
                          <>
                            <div
                              className="h-full bg-green-500"
                              style={{ width: "85%" }}
                            ></div>
                            <div
                              className="h-full bg-red-500"
                              style={{ width: "10%" }}
                            ></div>
                          </>
                        ) : (
                          <div
                            className={`h-full ${
                              isSuccess ? "bg-green-500" : "bg-primary"
                            } ${
                              !isSuccess
                                ? "shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                                : "shadow-[0_0_10px_rgba(74,222,128,0.4)]"
                            } transition-all duration-1000`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    {batch.status === "processing" && (
                      <>
                        <button className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors">
                          View Details
                        </button>
                        <button className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-400 transition-colors">
                          Stop Batch
                        </button>
                      </>
                    )}
                    {batch.status === "partial_failure" && (
                      <>
                        <button className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors">
                          View Details
                        </button>
                        <button className="px-4 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-xs font-semibold text-primary transition-colors">
                          Retry Failed
                        </button>
                      </>
                    )}
                    {batch.status === "success" && (
                      <>
                        <button className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors">
                          View Logs
                        </button>
                        <button className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors">
                          Download Results
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Sub-agent Workflow (only for first batch) */}
                {batch.subTasks && (
                  <div className="mt-6 pt-6 border-t border-white/5">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="material-icons-round text-sm">hub</span>
                      Sub-agent Workflow
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {batch.subTasks.map((task, taskIndex) => {
                        const taskConfig = getSubTaskStatusConfig(task.status);
                        return (
                          <div
                            key={taskIndex}
                            className={`p-3 ${taskConfig.bgColor} border ${taskConfig.borderColor} rounded-xl flex items-center gap-3 ${taskConfig.opacity}`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full ${taskConfig.dotColor} ${taskConfig.dotShadow} ${
                                taskConfig.animate ? "animate-pulse" : ""
                              }`}
                            ></div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">
                                {task.name}: {task.model}
                              </p>
                              <p
                                className={`text-[10px] uppercase ${taskConfig.statusColor}`}
                              >
                                {taskConfig.statusText}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent Execution Logs */}
      <div className="flex flex-col h-[280px] bg-[#0c0c0e] rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="material-icons-round text-gray-400 text-lg">
              terminal
            </span>
            <h2 className="font-mono text-xs font-semibold text-gray-400">
              AGENT EXECUTION LOGS
            </h2>
          </div>
          <div className="flex gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-white/10"></div>
            <div className="h-2.5 w-2.5 rounded-full bg-white/10"></div>
            <div className="h-2.5 w-2.5 rounded-full bg-white/10"></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5">
          {logEntries.map((log, index) => (
            <div key={index} className="flex gap-4 text-gray-500">
              <span className="w-20 shrink-0">{log.time}</span>
              <span className={log.sourceColor}>[{log.source}]</span>
              <span className={log.isWarning ? "text-yellow-400/80" : "text-gray-300"}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="fixed bottom-8 right-8 z-50 md:hidden">
        <button className="bg-primary hover:bg-primary-hover text-white rounded-full p-4 shadow-lg shadow-primary/40 transition-all active:scale-95">
          <span className="material-icons-round">add</span>
        </button>
      </div>
    </div>
  );
}
