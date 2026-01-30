import type { ConversationDetail as ConversationDetailType } from "../../types/models";
import EventBlock from "./EventBlock";
import AutoSizer from "@/components/ui/AutoSizer";

interface ConversationDetailProps {
    conversation: ConversationDetailType | null;
    loading: boolean;
    showThinking: boolean;
    showTools: boolean;
    listLoading: boolean; // Loading state of the list (when no convo selected)
}

export default function ConversationDetail({
    conversation,
    loading,
    showThinking,
    showTools,
    listLoading,
}: ConversationDetailProps) {
    const getAgentColor = (agent: string) => {
        return agent === "claude"
            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
            : "bg-green-500/10 text-green-400 border-green-500/20";
    };

    return (
        <div className="flex-1 flex flex-col bg-[#050505] relative min-w-0">
            {/* Header */}
            <div className="h-16 border-b border-white/5 flex justify-between items-center px-6 bg-[#0c0c0e]/50 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-4 min-w-0">
                    {conversation ? (
                        <>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <span className="font-mono text-primary truncate">
                                    {conversation.conversation_id.slice(0, 12)}...
                                </span>
                                <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium border ${getAgentColor(
                                        conversation.agent
                                    )}`}
                                >
                                    {conversation.agent}
                                </span>
                                {conversation.status === "active" && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 flex-shrink-0">
                                        LIVE
                                    </span>
                                )}
                            </h2>
                            <span className="hidden md:inline text-sm text-gray-400 border-l border-white/10 pl-4 whitespace-nowrap">
                                Started {conversation.created_at}
                            </span>
                        </>
                    ) : (
                        <h2 className="text-xl font-bold text-white">Select a conversation</h2>
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
            <div className="flex-1 min-h-0 bg-[#050505]">
                <AutoSizer>
                    {({ height, width }) => (
                        <div
                            style={{ height, width }}
                            className="overflow-y-auto min-h-0 p-8 space-y-6"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-gray-400 flex items-center gap-2">
                                        <span className="material-icons-round animate-spin">refresh</span>
                                        Loading conversation...
                                    </div>
                                </div>
                            ) : conversation ? (
                                (conversation.events || [])
                                    .filter((event) => {
                                        if (!showThinking) {
                                            if (event.type === "thinking" || event.type === "reasoning") return false;
                                            // Treat Claude responses as thinking
                                            if (conversation.agent === "claude" && event.type === "response") return false;
                                        }
                                        if (!showTools && event.type === "tool_call") return false;
                                        return true;
                                    })
                                    .map((event, index) => (
                                        <EventBlock
                                            key={`${event.type}-${event.timestamp ?? index}`}
                                            event={event}
                                            agent={conversation.agent}
                                        />
                                    ))
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-gray-500">
                                        {listLoading ? "Loading conversations..." : "No conversation selected"}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </AutoSizer>
            </div>

            {/* Input (View Only) */}
            <div className="p-6 border-t border-white/5 bg-[#0c0c0e]">
                <div className="relative opacity-60">
                    <input
                        type="text"
                        disabled
                        value="Conversation is in view-only mode."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-12 text-sm text-gray-400 cursor-not-allowed"
                    />
                    <span className="absolute left-4 top-3 text-gray-500">
                        <span className="material-icons-round text-lg">lock</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
