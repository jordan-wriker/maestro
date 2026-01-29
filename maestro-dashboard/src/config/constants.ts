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

export const STATUS_CONFIG: Record<string, { dotClass: string; textClass: string; label: string }> = {
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
