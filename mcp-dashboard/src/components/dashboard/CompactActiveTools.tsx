"use client";

import Link from "next/link";

const activeTools = [
  {
    name: "File Search",
    description: "Semantic search over vectorized documentation and codebase.",
    icon: "search",
    gradient: "from-blue-500 to-indigo-600",
    status: "IDLE",
    statusColor: "text-gray-400",
    dotColor: "bg-green-500",
    button: "Configure",
  },
  {
    name: "Code Interpreter",
    description: "Sandboxed Python execution environment for data analysis.",
    icon: "data_object",
    gradient: "from-purple-500 to-pink-600",
    status: "ACTIVE",
    statusColor: "text-green-400",
    dotColor: "bg-green-500",
    dotPing: true,
    button: "Configure",
  },
  {
    name: "DALL-E Generator",
    description: "Image generation module for visual assets creation.",
    icon: "image",
    gradient: "from-orange-500 to-amber-600",
    status: "OFFLINE",
    statusColor: "text-gray-500",
    dotColor: "bg-gray-600",
    button: "Enable",
  },
];

export default function CompactActiveTools() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Active Tools</h2>
        <Link
          href="/tools"
          className="text-xs text-primary hover:text-primary-hover font-medium"
        >
          Manage Tools →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeTools.map((tool) => (
          <div
            key={tool.name}
            className="bg-[#151519] p-4 rounded-xl border border-white/5 flex items-center gap-3 hover:border-primary/50 transition-colors"
          >
            <div
              className={`w-9 h-9 rounded-lg bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-md`}
            >
              <span className="material-icons-round text-white text-lg">
                {tool.icon}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white text-sm truncate">
                {tool.name}
              </h3>
              <p className="text-xs text-gray-400 truncate">
                {tool.description}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center space-x-1.5">
                {tool.dotPing ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.45)]"></span>
                  </span>
                ) : (
                  <span className={`h-2 w-2 rounded-full ${tool.dotColor}`}></span>
                )}
                <span className={`text-[10px] font-mono ${tool.statusColor}`}>
                  {tool.status}
                </span>
              </div>
              <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs font-medium transition-colors text-white">
                {tool.button}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
