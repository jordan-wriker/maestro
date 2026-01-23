import { useState } from "react";

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconGradient: string;
  iconColor: string;
  enabled: boolean;
  status: "active" | "inactive" | "setup_required";
  statusColor: string;
  accentColor: string;
  toggleColor: string;
}

const initialTools: Tool[] = [
  {
    id: "file-search",
    name: "File Search",
    description:
      "Semantic search over vectorized documentation and codebase assets.",
    icon: "search",
    iconGradient: "from-blue-500/20 to-indigo-600/20",
    iconColor: "text-indigo-400",
    enabled: true,
    status: "active",
    statusColor: "text-green-500",
    accentColor: "bg-green-500",
    toggleColor: "peer-checked:bg-green-500",
  },
  {
    id: "code-interpreter",
    name: "Code Interpreter",
    description:
      "Sandboxed Python execution environment for data analysis and complex logic.",
    icon: "data_object",
    iconGradient: "from-purple-500/20 to-pink-600/20",
    iconColor: "text-purple-400",
    enabled: true,
    status: "active",
    statusColor: "text-purple-400",
    accentColor: "bg-purple-500",
    toggleColor: "peer-checked:bg-primary",
  },
  {
    id: "dalle-generator",
    name: "DALL-E Generator",
    description:
      "Image generation module for visual assets creation from textual descriptions.",
    icon: "image",
    iconGradient: "from-orange-500/10 to-amber-600/10",
    iconColor: "text-orange-400",
    enabled: false,
    status: "inactive",
    statusColor: "text-gray-500",
    accentColor: "bg-gray-600",
    toggleColor: "peer-checked:bg-green-500",
  },
  {
    id: "weather-connect",
    name: "Weather Connect",
    description: "Real-time global weather data fetching and forecast analysis.",
    icon: "cloud",
    iconGradient: "from-cyan-500/20 to-blue-600/20",
    iconColor: "text-blue-400",
    enabled: true,
    status: "active",
    statusColor: "text-blue-400",
    accentColor: "bg-blue-400",
    toggleColor: "peer-checked:bg-blue-500",
  },
  {
    id: "github-integration",
    name: "GitHub Integration",
    description:
      "Direct access to repositories, issues, and pull requests for context awareness.",
    icon: "source",
    iconGradient: "from-gray-700/50 to-black/50",
    iconColor: "text-gray-200",
    enabled: false,
    status: "setup_required",
    statusColor: "text-yellow-500",
    accentColor: "bg-yellow-500",
    toggleColor: "peer-checked:bg-green-500",
  },
  {
    id: "slack-notifier",
    name: "Slack Notifier",
    description: "Send notifications and summaries to specified Slack channels.",
    icon: "chat",
    iconGradient: "from-red-500/20 to-yellow-500/20",
    iconColor: "text-pink-500",
    enabled: true,
    status: "active",
    statusColor: "text-green-500",
    accentColor: "bg-green-500",
    toggleColor: "peer-checked:bg-green-500",
  },
];

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>(initialTools);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleTool = (id: string) => {
    setTools((prev) =>
      prev.map((tool) =>
        tool.id === id ? { ...tool, enabled: !tool.enabled } : tool
      )
    );
  };

  const filteredTools = tools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Tools Inventory</h1>
          <p className="text-gray-400">
            Manage, configure, and monitor AI tool integrations.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-64 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm placeholder-gray-500"
            />
          </div>
          <button className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-primary/25 active:scale-95">
            <span className="material-icons-round text-sm">add</span>
            <span className="font-medium text-sm">Add New Tool</span>
          </button>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool) => (
          <div
            key={tool.id}
            className={`bg-[#151519] p-6 rounded-2xl border border-white/5 shadow-sm group hover:border-primary/40 transition-all duration-300 relative overflow-hidden flex flex-col ${
              !tool.enabled ? "opacity-75 hover:opacity-100" : ""
            }`}
          >
            {/* Accent bar */}
            <div
              className={`absolute top-0 left-0 w-1 h-full ${tool.accentColor} ${
                tool.status === "active"
                  ? "shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                  : ""
              }`}
            ></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-5 pl-3">
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.iconGradient} border border-white/10 flex items-center justify-center ${tool.iconColor} ${!tool.enabled ? "grayscale" : ""}`}
              >
                <span className="material-icons-round text-3xl">{tool.icon}</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={tool.enabled}
                  onChange={() => toggleTool(tool.id)}
                  className="sr-only peer"
                />
                <div
                  className={`w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${tool.toggleColor}`}
                ></div>
              </label>
            </div>

            {/* Content */}
            <div className="pl-3 flex-1">
              <h3
                className={`text-xl font-bold tracking-tight ${
                  tool.enabled ? "text-white" : "text-gray-400"
                }`}
              >
                {tool.name}
              </h3>
              <p
                className={`text-sm mt-2 leading-relaxed ${
                  tool.enabled ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {tool.description}
              </p>
            </div>

            {/* Footer */}
            <div className="pl-3 mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
              {tool.status === "setup_required" ? (
                <>
                  <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-semibold border border-yellow-500/20">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    Setup Required
                  </span>
                  <button className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg text-xs font-medium transition-colors border border-yellow-500/20">
                    Configure API Key
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      tool.enabled
                        ? `bg-green-500/10 ${tool.statusColor} border-green-500/20`
                        : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                    }`}
                  >
                    {tool.enabled && tool.status === "active" ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                    )}
                    {tool.enabled ? "Active" : "Inactive"}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className={`p-2 rounded-lg transition-colors ${
                        tool.enabled
                          ? "text-gray-400 hover:text-white hover:bg-white/5"
                          : "text-gray-500 cursor-not-allowed"
                      }`}
                      title="View Logs"
                      disabled={!tool.enabled}
                    >
                      <span className="material-icons-round text-xl">
                        description
                      </span>
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Configure"
                    >
                      <span className="material-icons-round text-xl">tune</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
