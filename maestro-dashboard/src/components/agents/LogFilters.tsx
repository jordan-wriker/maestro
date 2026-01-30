

interface LogFiltersProps {
    filter: "all" | "claude" | "codex";
    onFilterChange: (filter: "all" | "claude" | "codex") => void;
}

export default function LogFilters({ filter, onFilterChange }: LogFiltersProps) {
    return (
        <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
            {(["all", "claude", "codex"] as const).map((f) => (
                <button
                    key={f}
                    onClick={() => onFilterChange(f)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-all capitalize ${filter === f
                        ? "bg-primary text-white shadow-sm ring-1 ring-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                >
                    {f === "all" ? "All" : f === "claude" ? "Claude" : "Codex"}
                </button>
            ))}
        </div>
    );
}
