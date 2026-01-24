import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { WorkSession } from "../types/api";

const agentColorClasses: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  blue: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  green: {
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

function StatusBadge({ status, isCurrent }: { status: string; isCurrent: boolean }) {
  const config: Record<string, { dotClass: string; textClass: string; label: string }> = {
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

  const currentConfig = config[status.toLowerCase()] || config.idle;

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${isCurrent ? config.active.dotClass : currentConfig.dotClass}`}></span>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${isCurrent ? config.active.textClass : currentConfig.textClass}`}>
        {isCurrent ? "Current Session" : currentConfig.label}
      </span>
    </div>
  );
}

function SessionCard({ session, onActivate }: { session: WorkSession; onActivate: (id: string) => void }) {
  const isArchived = session.status === "archived";

  return (
    <div
      className={`bg-[#0f0f12] border ${session.is_current_session ? 'border-primary shadow-[0_0_20px_rgba(124,58,237,0.1)]' : 'border-white/5'} rounded-2xl p-6 hover:border-primary/40 transition-all group flex flex-col h-full ${isArchived ? "opacity-60 hover:opacity-100" : ""
        }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <StatusBadge status={session.status} isCurrent={session.is_current_session} />
          <h3 className={`text-xl font-bold ${session.is_current_session ? 'text-primary' : 'text-white'} group-hover:text-primary transition-colors`}>
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
            {session.total_tokens || "0"}
            {session.is_current_session && <span className="text-green-500 text-xs ml-1">↑</span>}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Last Active</p>
          <p className="text-sm font-mono font-semibold text-white">
            {new Date(session.updated_at).toLocaleDateString()}
          </p>
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
            <button
              onClick={() => onActivate(session.session_id)}
              disabled={session.is_current_session}
              className={`flex-1 py-2.5 ${session.is_current_session ? 'bg-primary/20 text-primary cursor-default' : 'bg-primary/10 hover:bg-primary text-primary hover:text-white cursor-pointer'} rounded-xl text-sm font-semibold transition-all`}
            >
              {session.is_current_session ? 'Active Now' : 'Open Session'}
            </button>
            <button
              className="p-2.5 bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all"
              title="Archive"
            >
              <span className="material-icons-round text-lg">archive</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, rootDir: string) => Promise<void>;
}

function CreateSessionModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [title, setTitle] = useState("");
  const [rootDir, setRootDir] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(title, rootDir);
      setTitle("");
      setRootDir("");
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f12] border border-white/10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create New Workspace</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
            <span className="material-icons-round">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Workspace Title</label>
            <input
              autoFocus
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary outline-none text-white transition-all"
              placeholder="e.g. Website Redesign"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Root Directory (Optional)</label>
            <input
              type="text"
              value={rootDir}
              onChange={(e) => setRootDir(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary outline-none text-white transition-all"
              placeholder="/abs/path/to/project"
            />
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title}
              className="flex-1 py-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {loading ? "Creating..." : "Create Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Sessions() {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { setCurrentSession } = useWebSocket();

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/sessions");
      const data = await response.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleActivateSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/activate`, {
        method: 'PUT'
      });
      if (response.ok) {
        const updatedSession = await response.json();
        setCurrentSession(updatedSession);
        fetchSessions(); // Refresh list to show active state
      }
    } catch (error) {
      console.error('Failed to activate session:', error);
    }
  };

  const handleCreateSession = async (title: string, rootDirectory?: string) => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          root_directory: rootDirectory || undefined,
          agents: [
            { name: "Claude", color: "blue" },
            { name: "Codex", color: "green" }
          ]
        })
      });
      if (response.ok) {
        const newSession = await response.json();
        await handleActivateSession(newSession.session_id);
      }
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  };

  const filteredSessions = sessions.filter((session) => {
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
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all active:scale-95"
          >
            <span className="material-icons-round text-lg">add</span>
            Create New Session
          </button>
        </div>

        {/* Search */}
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
        </div>

        {/* Session Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((session) => (
              <SessionCard key={session.session_id} session={session} onActivate={handleActivateSession} />
            ))}
            <div
              onClick={() => setIsModalOpen(true)}
              className="border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center group hover:border-primary/50 cursor-pointer transition-all min-h-[300px]"
            >
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
          </div>
        )}
      </div>

      <CreateSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSession}
      />

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary-hover text-white rounded-full p-4 shadow-lg shadow-primary/40 transition-all active:scale-95 flex items-center gap-2 group"
        >
          <span className="material-icons-round">add</span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 font-medium">
            Create Session
          </span>
        </button>
      </div>
    </div>
  );
}
