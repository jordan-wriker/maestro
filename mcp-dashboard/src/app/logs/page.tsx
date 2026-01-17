"use client";

import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import ToggleBar from "@/components/ToggleBar";

interface SessionSummary {
  id: string;
  agent: "claude" | "codex";
  created_at: string;
  status: "completed" | "error" | "active";
  prompt: string;
  response: string;
  last_activity?: string;
}

interface SessionEvent {
  type: "prompt" | "system" | "response" | "tool_call" | "result" | "thinking";
  content: string;
  tool?: string;
  output?: string;
  timestamp?: string;
}

interface SessionDetail {
  id: string;
  agent: "claude" | "codex";
  created_at: string;
  events: SessionEvent[];
  status: "completed" | "error" | "active";
  prompt: string;
}

export default function LogsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "claude" | "codex">("all");
  const [sessionsPanelCollapsed, setSessionsPanelCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [showTools, setShowTools] = useState(true);

  // WebSocket for real-time updates
  const { logs: liveLogs } = useWebSocket("ws://127.0.0.1:8000/ws");

  // Process incoming WebSocket logs
  useEffect(() => {
    if (liveLogs.length === 0) return;

    // Get the most recent log entry
    const latestLog = liveLogs[0];
    if (!latestLog.session_id) return;

    const sessionId = latestLog.session_id;
    const agent = latestLog.agent as "claude" | "codex";
    const status = latestLog.status === "running" ? "active" :
                   latestLog.status === "error" ? "error" : "completed";

    // Update sessions list
    setSessions((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === sessionId);

      if (existingIndex !== -1) {
        // Update existing session
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          status,
          last_activity: latestLog.timestamp,
          prompt: latestLog.prompt || updated[existingIndex].prompt,
          response: latestLog.response || updated[existingIndex].response,
        };
        return updated;
      } else {
        // Add new session at the top
        const newSession: SessionSummary = {
          id: sessionId,
          agent,
          created_at: latestLog.timestamp,
          status,
          prompt: latestLog.prompt || "",
          response: latestLog.response || "",
          last_activity: latestLog.timestamp,
        };
        return [newSession, ...prev];
      }
    });

    // Update selectedSession if it matches the incoming log
    setSelectedSession((prev) => {
      if (!prev || prev.id !== sessionId) return prev;

      // Build new events from the live log
      const newEvents: SessionEvent[] = [];

      if (latestLog.events && Array.isArray(latestLog.events)) {
        // If the log has parsed events, use them
        for (const evt of latestLog.events) {
          newEvents.push({
            type: evt.type || "response",
            content: evt.content || "",
            tool: evt.tool,
            output: evt.output,
            timestamp: evt.timestamp,
          });
        }
      } else if (latestLog.response) {
        // Fallback: create a result event from the response
        newEvents.push({
          type: "result",
          content: latestLog.response,
          timestamp: latestLog.timestamp,
        });
      }

      // Merge events - avoid duplicates by checking content
      const mergedEvents = [...prev.events];
      for (const newEvt of newEvents) {
        const exists = mergedEvents.some(
          (e) => e.type === newEvt.type && e.content === newEvt.content
        );
        if (!exists) {
          mergedEvents.push(newEvt);
        }
      }

      return {
        ...prev,
        status,
        events: mergedEvents,
      };
    });
  }, [liveLogs]);

  // Fetch sessions list
  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch(`/api/sessions?agent=${filter}`);
        const data = await res.json();
        setSessions(data);
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
        setLoading(false);
      }
    }
    fetchSessions();
  }, [filter]);

  // Fetch session detail when selected
  async function selectSession(session: SessionSummary) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`);
      const data = await res.json();
      setSelectedSession(data);
    } catch (error) {
      console.error("Failed to fetch session detail:", error);
    }
    setLoadingDetail(false);
  }

  // Auto-select first session
  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      selectSession(sessions[0]);
    }
  }, [sessions]);

  const filteredSessions = sessions.filter((s) =>
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAgentColor = (agent: string) => {
    return agent === "claude"
      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
      : "bg-green-500/10 text-green-400 border-green-500/20";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-primary";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-[#050505] relative min-w-0">
        {/* Header */}
        <div className="h-16 border-b border-white/5 flex justify-between items-center px-6 bg-[#0c0c0e]/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4 min-w-0">
            {selectedSession ? (
              <>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="font-mono text-primary truncate">
                    {selectedSession.id.slice(0, 12)}...
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium border ${getAgentColor(
                      selectedSession.agent
                    )}`}
                  >
                    {selectedSession.agent}
                  </span>
                  {selectedSession.status === "active" && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex-shrink-0">
                      LIVE
                    </span>
                  )}
                </h2>
                <span className="hidden md:inline text-sm text-gray-400 border-l border-white/10 pl-4 whitespace-nowrap">
                  Started {selectedSession.created_at}
                </span>
              </>
            ) : (
              <h2 className="text-xl font-bold text-white">Select a session</h2>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors whitespace-nowrap">
              <span className="material-icons-round text-sm mr-2">download</span>
              Export Log
            </button>
          </div>
        </div>

        {/* Chat Log */}
        <div className="flex-1 overflow-y-auto min-h-0 p-8 space-y-6">
          {loadingDetail ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400 flex items-center gap-2">
                <span className="material-icons-round animate-spin">refresh</span>
                Loading session...
              </div>
            </div>
          ) : selectedSession ? (
            selectedSession.events
              .filter((event) => {
                if (!showThinking && event.type === "thinking") return false;
                if (!showTools && event.type === "tool_call") return false;
                return true;
              })
              .map((event, i) => (
                <EventBlock key={i} event={event} agent={selectedSession.agent} />
              ))
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">
                {loading ? "Loading sessions..." : "No session selected"}
              </p>
            </div>
          )}
        </div>

        {/* Input (View Only) */}
        <div className="p-6 border-t border-white/5 bg-[#0c0c0e]">
          <div className="relative opacity-60">
            <input
              type="text"
              disabled
              value="Session is in view-only mode."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-12 text-sm text-gray-400 cursor-not-allowed"
            />
            <span className="absolute left-4 top-3 text-gray-500">
              <span className="material-icons-round text-lg">lock</span>
            </span>
          </div>
        </div>
      </div>

      {/* Sessions Sidebar */}
      <div
        className={`${
          sessionsPanelCollapsed ? "w-12" : "w-80"
        } h-full flex flex-col border-l border-white/5 bg-[#0c0c0e] flex-shrink-0 transition-all duration-300`}
      >
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          {!sessionsPanelCollapsed && (
            <h2 className="text-lg font-bold text-white">Sessions</h2>
          )}
          <button
            onClick={() => setSessionsPanelCollapsed(!sessionsPanelCollapsed)}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span className="material-icons-round">
              {sessionsPanelCollapsed ? "chevron_left" : "chevron_right"}
            </span>
          </button>
        </div>

        {!sessionsPanelCollapsed && (
          <>
            {/* Search and Filter */}
            <div className="p-4 pt-2 border-b border-white/5">
              <div className="relative mb-3">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-icons-round text-gray-500 text-lg">
                    search
                  </span>
                </span>
                <input
                  type="text"
                  placeholder="Search Session ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-lg leading-5 bg-[#151519] text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm"
                />
              </div>
              <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
                {(["all", "claude", "codex"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-all capitalize ${
                      filter === f
                        ? "bg-primary text-white shadow-sm ring-1 ring-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {f === "all" ? "All" : f === "claude" ? "Claude" : "Codex"}
                  </button>
                ))}
              </div>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : filteredSessions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No sessions found</div>
              ) : (
                filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => selectSession(session)}
                    className={`p-4 cursor-pointer border-b border-white/5 transition-colors ${
                      selectedSession?.id === session.id
                        ? "border-l-4 border-l-primary bg-primary/5"
                        : "border-l-4 border-l-transparent hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className={`font-mono text-sm ${
                          selectedSession?.id === session.id
                            ? "font-semibold text-white"
                            : "font-medium text-gray-300"
                        }`}
                      >
                        {session.id.slice(0, 12)}...
                      </span>
                      <span className={`text-xs ${getStatusColor(session.status)}`}>
                        {session.status === "active"
                          ? "Active"
                          : session.status === "error"
                          ? "Error"
                          : "Completed"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {session.created_at}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getAgentColor(
                          session.agent
                        )}`}
                      >
                        {session.agent}
                      </span>
                    </div>
                    {session.prompt && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                        {session.prompt.slice(0, 80)}...
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Toggle Bar */}
            <ToggleBar
              showThinking={showThinking}
              showTools={showTools}
              onToggleThinking={() => setShowThinking((prev) => !prev)}
              onToggleTools={() => setShowTools((prev) => !prev)}
            />
          </>
        )}
      </div>
    </div>
  );
}

function EventBlock({
  event,
  agent,
}: {
  event: SessionEvent;
  agent: "claude" | "codex";
}) {
  // Color scheme - consistent for both agents:
  // - Thinking: Purple
  // - Tool call/response: Blue
  // - Result: Green

  switch (event.type) {
    case "prompt":
      return (
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-[#1e1e24] text-white p-4 rounded-2xl rounded-tr-sm shadow-md border border-white/5">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
              <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                Maestro Prompt
              </span>
              {event.timestamp && (
                <span className="text-[10px] font-mono text-gray-500">
                  {event.timestamp}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
              {event.content}
            </p>
          </div>
        </div>
      );

    case "system":
      return (
        <div className="flex justify-center">
          <div className="px-4 py-2 bg-white/5 rounded-full text-xs text-gray-400 border border-white/5">
            {event.content}
          </div>
        </div>
      );

    case "thinking":
      // Purple theme for thinking
      return (
        <div className="flex justify-start w-full">
          <div
            className="w-full max-w-[85%] border p-4 rounded-xl relative group"
            style={{
              borderColor: "rgba(168,85,247,0.3)",
              backgroundColor: "rgba(168,85,247,0.05)",
            }}
          >
            <div
              className="absolute -left-3 top-4 w-6 h-6 rounded-full flex items-center justify-center border z-10"
              style={{
                backgroundColor: "#581c87",
                borderColor: "#a855f7",
                boxShadow: "0 0 20px rgba(168,85,247,0.5)",
              }}
            >
              <span className="material-icons-round text-white text-xs">
                psychology
              </span>
            </div>
            <div className="pl-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "#c084fc" }}
                >
                  Thinking
                </span>
                <span
                  className="h-px w-8"
                  style={{ backgroundColor: "rgba(168,85,247,0.3)" }}
                ></span>
              </div>
              <p
                className="font-mono text-xs leading-relaxed"
                style={{ color: "rgba(233,213,255,0.8)" }}
              >
                {event.content}
              </p>
            </div>
          </div>
        </div>
      );

    case "response":
      // Blue theme for agent responses (intermediate messages)
      return (
        <div className="flex justify-start w-full">
          <div
            className="w-full max-w-[85%] border p-4 rounded-xl relative group"
            style={{
              borderColor: "rgba(59,130,246,0.3)",
              backgroundColor: "rgba(59,130,246,0.05)",
            }}
          >
            <div
              className="absolute -left-3 top-4 w-6 h-6 rounded-full flex items-center justify-center border z-10"
              style={{
                backgroundColor: "#1e3a5f",
                borderColor: "#3b82f6",
                boxShadow: "0 0 20px rgba(59,130,246,0.5)",
              }}
            >
              <span className="material-icons-round text-white text-xs">
                smart_toy
              </span>
            </div>
            <div className="pl-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "#60a5fa" }}
                >
                  {agent === "claude" ? "Claude" : "Codex"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                {event.content}
              </p>
            </div>
          </div>
        </div>
      );

    case "tool_call":
      // Blue theme for tool calls - fixed height cards with scrollable content
      return (
        <div className="flex justify-start w-full">
          <div className="w-full max-w-[85%] pl-8 space-y-2">
            <div className="bg-[#0d1117] border-l-2 border-blue-500 p-3 rounded-r-lg font-mono text-xs shadow-sm">
              <div className="flex justify-between items-center mb-1 text-blue-400">
                <span className="font-bold">tool_call: {event.tool}</span>
              </div>
              {event.content && (
                <pre className="text-gray-300 whitespace-pre-wrap text-xs overflow-x-auto max-h-32 overflow-y-auto">
                  {event.content}
                </pre>
              )}
            </div>
            {event.output && (
              <div className="bg-[#0d1117] border-l-2 border-sky-500 p-3 rounded-r-lg font-mono text-xs shadow-sm">
                <div className="flex justify-between items-center mb-1 text-sky-400">
                  <span className="font-bold">output</span>
                </div>
                <pre className="text-gray-400 whitespace-pre-wrap text-xs overflow-x-auto max-h-32 overflow-y-auto">
                  {event.output}
                </pre>
              </div>
            )}
          </div>
        </div>
      );

    case "result":
      // Green theme for final result
      return (
        <div className="flex justify-start">
          <div
            className="max-w-[80%] border text-gray-100 p-5 rounded-2xl rounded-tl-sm shadow-lg"
            style={{
              background: "linear-gradient(to bottom right, #14532d, #166534)",
              borderColor: "rgba(34,197,94,0.3)",
              boxShadow: "0 4px 6px -1px rgba(34,197,94,0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span
                  className="material-icons-round text-sm"
                  style={{ color: "#22c55e" }}
                >
                  check_circle
                </span>
                <span
                  className="text-xs font-bold tracking-wider uppercase"
                  style={{ color: "#86efac" }}
                >
                  {agent === "claude" ? "Claude" : "Codex"} Result
                </span>
              </div>
            </div>
            <div className="prose prose-sm prose-invert max-w-none text-sm text-gray-200 whitespace-pre-wrap">
              {event.content}
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}
