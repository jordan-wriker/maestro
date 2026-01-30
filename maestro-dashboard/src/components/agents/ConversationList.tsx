
import type { ConversationSummary } from "../../types/models";
import LogFilters from "./LogFilters";
import ToggleBar from "../ToggleBar";

interface ConversationListProps {
    conversations: ConversationSummary[];
    selectedId: string | undefined;
    onSelect: (conversation: ConversationSummary) => void;
    loading: boolean;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    filter: "all" | "claude" | "codex";
    onFilterChange: (filter: "all" | "claude" | "codex") => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    showThinking: boolean;
    showTools: boolean;
    onToggleThinking: () => void;
    onToggleTools: () => void;
}

export default function ConversationList({
    conversations,
    selectedId,
    onSelect,
    loading,
    searchQuery,
    onSearchChange,
    filter,
    onFilterChange,
    collapsed,
    onToggleCollapse,
    showThinking,
    showTools,
    onToggleThinking,
    onToggleTools,
}: ConversationListProps) {

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
        <div
            className={`${collapsed ? "w-12" : "w-80"
                } h-full flex flex-col border-l border-white/5 bg-[#0c0c0e] flex-shrink-0 transition-all duration-300`}
        >
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
                {!collapsed && (
                    <h2 className="text-lg font-bold text-white">Conversations</h2>
                )}
                <button
                    onClick={onToggleCollapse}
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                    <span className="material-icons-round">
                        {collapsed ? "chevron_left" : "chevron_right"}
                    </span>
                </button>
            </div>

            {!collapsed && (
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
                                placeholder="Search Conversation ID..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-lg leading-5 bg-[#151519] text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm"
                            />
                        </div>
                        <LogFilters filter={filter} onFilterChange={onFilterChange} />
                    </div>

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {loading ? (
                            <div className="p-4 text-center text-gray-500">Loading...</div>
                        ) : conversations.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">No conversations found</div>
                        ) : (
                            conversations.map((conversation) => (
                                <div
                                    key={conversation.conversation_id}
                                    onClick={() => onSelect(conversation)}
                                    className={`p-4 cursor-pointer border-b border-white/5 transition-colors ${selectedId === conversation.conversation_id
                                        ? "border-l-4 border-l-primary bg-primary/5"
                                        : "border-l-4 border-l-transparent hover:bg-white/[0.02]"
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span
                                            className={`font-mono text-sm ${selectedId === conversation.conversation_id
                                                ? "font-semibold text-white"
                                                : "font-medium text-gray-300"
                                                }`}
                                        >
                                            {conversation.conversation_id.slice(0, 12)}...
                                        </span>
                                        <span className={`text-xs ${getStatusColor(conversation.status)}`}>
                                            {conversation.status === "active"
                                                ? "Active"
                                                : conversation.status === "error"
                                                    ? "Error"
                                                    : "Completed"}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 mb-2">
                                        {conversation.created_at}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getAgentColor(
                                                conversation.agent
                                            )}`}
                                        >
                                            {conversation.agent}
                                        </span>
                                    </div>
                                    {conversation.task && (
                                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                            {conversation.task.slice(0, 80)}...
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
                        onToggleThinking={onToggleThinking}
                        onToggleTools={onToggleTools}
                    />
                </>
            )}
        </div>
    );
}
