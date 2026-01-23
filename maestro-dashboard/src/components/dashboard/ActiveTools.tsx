import { Link } from "react-router-dom";

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

export default function ActiveTools() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Active Tools</h2>
        <Link
          to="/tools"
          className="text-sm text-primary hover:text-primary-hover font-medium"
        >
          Manage Tools →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activeTools.map((tool) => (
          <div
            key={tool.name}
            className="bg-[#151519] p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-primary/50 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg`}
              >
                <span className="material-icons-round text-white">
                  {tool.icon}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {tool.dotPing ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
                  </span>
                ) : (
                  <span className={`h-2 w-2 rounded-full ${tool.dotColor}`}></span>
                )}
                <span className={`text-xs font-mono ${tool.statusColor}`}>
                  {tool.status}
                </span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">{tool.name}</h3>
              <p className="text-sm text-gray-400 mt-1 mb-4">
                {tool.description}
              </p>
              <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors text-white">
                {tool.button}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
