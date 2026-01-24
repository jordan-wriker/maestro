import { useState } from "react";

interface Session {
  id: string;
  title: string;
  status: "active" | "idle" | "archived";
  agents: { name: string; color: string }[];
  totalTokens: string;
  lastActive: string;
}

const mockSessions: Session[] = [
  {
    id: "1",
    title: "Website Redesign",
    status: "active",
    agents: [
      { name: "Claude-3.5", color: "blue" },
      { name: "ChatGPT-4o", color: "emerald" },
    ],
    totalTokens: "1.2M",
    lastActive: "2 mins ago",
  },
  {
    id: "2",
    title: "Data Analysis Q3",
    status: "idle",
    agents: [{ name: "OpenAI Codex", color: "purple" }],
    totalTokens: "450k",
    lastActive: "2 days ago",
  },
  {
    id: "3",
    title: "Logo Concepting",
    status: "archived",
    agents: [{ name: "DALL-E 3", color: "orange" }],
    totalTokens: "12.4k",
    lastActive: "1 week ago",
  },
];

const agentColorClasses: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
    dot: "bg-purple-400",
  },
  orange: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    text: "text-orange-400",
    dot: "bg-orange-400",
  },
};

function StatusBadge({ status }: { status: Session["status"] }) {
  const config = {
    active: {
      dotClass: "bg-green-500 shadow-[0_0_10px_rgba(74,222,128,0.5)]",
      textClass: "text-green-500",
      label: "Active",
    },
    idle: {
      dotClass: "bg-amber-500",
      textClass: "text-amber-500",
      label: "Idle",
    },
    archived: {
      dotClass: "bg-gray-500",
      textClass: "text-gray-500",
      label: "Archived",
    },
  };

  const { dotClass, textClass, label } = config[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotClass}`}></span>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${textClass}`}>
        {label}
      </span>
    </div>
  );
}

function SessionCard({ session }: { session: Session }) {
  const isArchived = session.status === "archived";

  return (
    <div
      className={`bg-[#0f0f12] border border-white/5 rounded-2xl p-6 hover:border-primary/40 transition-all group flex flex-col h-full ${isArchived ? "opacity-60 hover:opacity-100" : ""
        }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <StatusBadge status={session.status} />
          <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
            {session.title}
          </h3>
        </div>
        <button className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white cursor-pointer transition-colors">
          <span className="material-icons-round text-sm">more_vert</span>
        </button>
      </div>

      {/* Agent Tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        {session.agents.map((agent) => {
          const colors = agentColorClasses[agent.color] || agentColorClasses.blue;
          return (
            <div
              key={agent.name}
              className={`flex items-center gap-1.5 px-2.5 py-1 ${colors.bg} border ${colors.border} rounded-full`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></span>
              <span className={`text-xs font-medium ${colors.text}`}>{agent.name}</span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5 mb-6">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Tokens</p>
          <p className="text-sm font-mono font-semibold text-white">
            {session.totalTokens}
            {session.status === "active" && <span className="text-green-500 text-xs ml-1">↑</span>}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Last Active</p>
          <p className="text-sm font-mono font-semibold text-white">{session.lastActive}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-2">
        {isArchived ? (
          <>
            <button className="flex-1 py-2.5 bg-white/10 hover:bg-primary text-gray-400 hover:text-white rounded-xl text-sm font-semibold transition-all">
              Restore
            </button>
            <button
              className="p-2.5 bg-white/5 text-gray-400 hover:text-red-400 rounded-xl transition-all"
              title="Delete"
            >
              <span className="material-icons-round text-lg">delete</span>
            </button>
          </>
        ) : (
          <>
            <button className="flex-1 py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-sm font-semibold transition-all">
              Open Session
            </button>
            <button
              className="p-2.5 bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all"
              title="Archive"
            >
              <span className="material-icons-round text-lg">archive</span>
            </button>
            <button
              className="p-2.5 bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all"
              title="Settings"
            >
              <span className="material-icons-round text-lg">settings</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NewSessionCard() {
  return (
    <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center group hover:border-primary/50 cursor-pointer transition-all min-h-[300px]">
      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
        <span className="material-icons-round text-3xl text-gray-400 group-hover:text-primary">
          add
        </span>
      </div>
      <h3 className="text-lg font-bold text-white mb-1">New Workspace</h3>
      <p className="text-sm text-gray-400 max-w-[180px]">
        Start a fresh session with custom AI agents.
      </p>
    </div>
  );
}

export default function Sessions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const filteredSessions = mockSessions.filter((session) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = session.title.toLowerCase().includes(query);
      const matchesAgent = session.agents.some((a) =>
        a.name.toLowerCase().includes(query)
      );
      if (!matchesTitle && !matchesAgent) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-screen overflow-y-auto scrollbar-hide">
      <div className="p-8 max-w-7xl mx-auto space-y-8 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Work Sessions</h1>
            <p className="text-gray-400">
              Manage and organize your project-based AI workspaces.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all active:scale-95">
            <span className="material-icons-round text-lg">add</span>
            Create New Session
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#0f0f12] border border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-white placeholder:text-gray-500"
              placeholder="Search sessions by title or agent..."
            />
          </div>
          <div className="w-full md:w-64">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f0f12] border border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-white appearance-none cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="development">Development</option>
              <option value="analytics">Data Analytics</option>
              <option value="content">Content Creation</option>
              <option value="research">Research</option>
            </select>
          </div>
        </div>

        {/* Session Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
          <NewSessionCard />
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <button className="bg-primary hover:bg-primary-hover text-white rounded-full p-4 shadow-lg shadow-primary/40 transition-all active:scale-95 flex items-center gap-2 group">
          <span className="material-icons-round">add</span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 font-medium">
            Create Session
          </span>
        </button>
      </div>
    </div>
  );
}
