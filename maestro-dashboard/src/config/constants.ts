export const NAV_ITEMS = [
    { href: "/", label: "Overview", icon: "dashboard" },
    { href: "/sessions", label: "Sessions", icon: "workspaces" },
    { href: "/batch", label: "Batch Tasks", icon: "account_tree" },
    { href: "/tools", label: "Tools", icon: "extension" },
    { href: "/logs", label: "Agents", icon: "smart_toy" },
];

export const CONFIG_ITEMS = [
    { href: "/settings", label: "Settings", icon: "settings" },
    { href: "#", label: "API Keys", icon: "key" },
];

export const USER_PROFILE = {
    initials: "AU",
    name: "Admin User",
    email: "admin@mcp.local",
};

export const AGENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
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

export const STATUS_CONFIG: Record<string, { dotClass: string; textClass: string; bgClass: string; borderClass: string; label: string }> = {
    active: {
        dotClass: "bg-green-500 shadow-[0_0_10px_rgba(74,222,128,0.5)]",
        textClass: "text-green-500",
        bgClass: "bg-green-500/10",
        borderClass: "border-green-500/20",
        label: "Active",
    },
    idle: {
        dotClass: "bg-amber-500",
        textClass: "text-amber-500",
        bgClass: "bg-amber-500/10",
        borderClass: "border-amber-500/20",
        label: "Idle",
    },
    archived: {
        dotClass: "bg-gray-500",
        textClass: "text-gray-500",
        bgClass: "bg-gray-500/10",
        borderClass: "border-gray-500/20",
        label: "Archived",
    },
};

export const BATCH_STATUS_COLORS = {
    running: {
        bgColor: "bg-primary/10",
        textColor: "text-primary",
        borderColor: "border-primary/20",
        idColor: "text-primary",
    },
    failed: {
        bgColor: "bg-yellow-500/10",
        textColor: "text-yellow-500",
        borderColor: "border-yellow-500/20",
        idColor: "text-yellow-500",
    },
    completed: {
        bgColor: "bg-green-500/10",
        textColor: "text-green-500",
        borderColor: "border-green-500/20",
        idColor: "text-green-500",
    },
    default: {
        bgColor: "bg-gray-500/10",
        textColor: "text-gray-500",
        borderColor: "border-gray-500/20",
        idColor: "text-gray-500",
    },
};

export const MOCK_BATCH_LOGS = [
    {
        time: "10:45:01",
        source: "MANAGER",
        sourceColor: "text-primary",
        message: "Spawning agent sub-process for task execution",
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
        message: "Warning: Latency spike detected on gateway (450ms)",
        isWarning: true,
    },
    {
        time: "10:45:12",
        source: "SUCCESS",
        sourceColor: "text-green-400",
        message: "Task completion verified and stored",
    },
];

export const MOCK_TOOLS = [
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
