import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ConversationSummary, SessionEvent, ConversationDetail as ConversationDetailType } from "../types/models";
import { api } from "../api/endpoints";
import ConversationList from "@/components/logs/ConversationList";
import ConversationDetail from "@/components/logs/ConversationDetail";

export default function LogsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetailType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "claude" | "codex">("all");
  const [conversationsPanelCollapsed, setConversationsPanelCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [showTools, setShowTools] = useState(true);

  // WebSocket for real-time updates
  const { logs: liveLogs, currentSession } = useWebSocket();

  // Process incoming WebSocket logs
  useEffect(() => {
    if (liveLogs.length === 0) return;

    // Get the most recent log entry
    const latestLog = liveLogs[0];

    // Use conversation_id if available, otherwise use log id as temporary tracking id
    // This allows "running" conversations to appear before they complete
    const conversationId = latestLog.conversation_id || `temp_${latestLog.id}`;
    const agent = latestLog.agent as "claude" | "codex";
    const isRunning = latestLog.status === "Running..." ||
      latestLog.status === "Running (Batch)..." ||
      latestLog.status?.toLowerCase().includes("running");
    const status = isRunning ? "active" :
      latestLog.status === "Error" || latestLog.status === "Failed" ? "error" : "completed";

    // Update conversations list
    setConversations((prev) => {
      // Check if this is a real conversation_id (not temporary)
      const hasRealConversationId = latestLog.conversation_id && !latestLog.conversation_id.startsWith("temp_");

      // Also look for a temporary conversation that may need to be replaced
      // This happens when a task completes and we get the real conversation_id
      const tempConversationId = `temp_${latestLog.id}`;
      const tempIndex = hasRealConversationId ? prev.findIndex((s) => s.conversation_id === tempConversationId) : -1;

      let updated = [...prev];

      // Remove temporary conversation if we now have a real conversation_id
      if (tempIndex !== -1 && hasRealConversationId) {
        updated = updated.filter((s) => s.conversation_id !== tempConversationId);
      }

      // Recalculate existingIndex after potential removal
      const finalExistingIndex = updated.findIndex((s) => s.conversation_id === conversationId);

      if (finalExistingIndex !== -1) {
        // Update existing conversation
        updated[finalExistingIndex] = {
          ...updated[finalExistingIndex],
          status,
          last_activity: latestLog.timestamp,
          task: latestLog.task || updated[finalExistingIndex].task,
          final_response: latestLog.final_response || updated[finalExistingIndex].final_response,
        };
        return updated;
      } else {
        // Add new conversation at the top
        const newConversation: ConversationSummary = {
          conversation_id: conversationId,
          agent,
          created_at: latestLog.timestamp,
          status,
          task: latestLog.task || "",
          final_response: latestLog.final_response || "",
          last_activity: latestLog.timestamp,
        };
        return [newConversation, ...updated];
      }
    });

    // Update selectedConversation if it matches the incoming log
    setSelectedConversation((prev) => {
      if (!prev) return prev;

      // Match by conversation ID or by temporary ID (temp_<log.id>)
      const tempId = `temp_${latestLog.id}`;
      const matchesConversation = prev.conversation_id === conversationId || prev.conversation_id === tempId;

      if (!matchesConversation) return prev;

      // If we now have a real conversation_id, update the prev.id
      const newId = latestLog.conversation_id || prev.conversation_id;

      // Build new events from the live log
      const newEvents: SessionEvent[] = [];

      if (latestLog.events && Array.isArray(latestLog.events)) {
        // If the log has parsed events, use them
        for (const evt of latestLog.events as Array<{
          type?: string;
          content?: string;
          tool?: string;
          output?: string;
          timestamp?: string;
        }>) {
          newEvents.push({
            type: (evt.type || "response") as SessionEvent["type"],
            content: evt.content || "",
            tool: evt.tool,
            output: evt.output,
            timestamp: evt.timestamp,
          });
        }
      } else if (latestLog.final_response) {
        // Fallback: create a result event from the response
        newEvents.push({
          type: "result",
          content: latestLog.final_response,
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
        conversation_id: newId,
        status,
        events: mergedEvents,
      };
    });
  }, [liveLogs]);

  // Fetch conversations list
  useEffect(() => {
    async function fetchConversations() {
      if (!currentSession) {
        setConversations([]);
        setSelectedConversation(null);
        setLoading(false);
        return;
      }
      setSelectedConversation(null);
      setLoading(true);
      try {
        const data = await api.conversations.list(
          currentSession.session_id,
          filter === 'all' ? undefined : filter
        );
        setConversations(data);

        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
        setLoading(false);
      }
    }
    fetchConversations();
  }, [filter, currentSession]);

  // Fetch conversation detail when selected
  async function selectConversation(conversation: ConversationSummary) {
    if (!conversation.conversation_id) return;

    setLoadingDetail(true);

    try {
      if (!currentSession) return;

      const data = await api.conversations.get(conversation.conversation_id, currentSession.session_id);
      setSelectedConversation(data);
    } catch (error: any) {
      // Check for 404 status in the error object (normalized by client)
      if (error && error.status === 404) {
        console.warn(`Conversation ${conversation.conversation_id} not found (404).`);
        setSelectedConversation({
          conversation_id: conversation.conversation_id,
          agent: conversation.agent,
          created_at: conversation.created_at,
          status: conversation.status,
          task: conversation.task,
          events: [
            {
              type: "system",
              content: "Log file not found on server. The task may have failed to write logs or they were deleted.",
              timestamp: new Date().toISOString()
            }
          ]
        });
      } else {
        console.error("Failed to fetch conversation detail:", error);
      }
    } finally {
      setLoadingDetail(false);
    }
  }

  // Auto-select first conversation
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation) {
      selectConversation(conversations[0]);
    }
  }, [conversations]);

  const filteredConversations = conversations.filter((s) =>
    s.conversation_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden">
      <ConversationDetail
        conversation={selectedConversation}
        loading={loadingDetail}
        showThinking={showThinking}
        showTools={showTools}
        listLoading={loading}
      />

      <ConversationList
        conversations={filteredConversations}
        selectedId={selectedConversation?.conversation_id}
        onSelect={selectConversation}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filter={filter}
        onFilterChange={setFilter}
        collapsed={conversationsPanelCollapsed}
        onToggleCollapse={() => setConversationsPanelCollapsed(!conversationsPanelCollapsed)}
        showThinking={showThinking}
        showTools={showTools}
        onToggleThinking={() => setShowThinking(!showThinking)}
        onToggleTools={() => setShowTools(!showTools)}
      />
    </div>
  );
}
