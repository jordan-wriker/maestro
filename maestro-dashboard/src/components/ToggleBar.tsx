type ToggleBarProps = {
  showThinking: boolean;
  showTools: boolean;
  onToggleThinking: () => void;
  onToggleTools: () => void;
};

export default function ToggleBar({
  showThinking,
  showTools,
  onToggleThinking,
  onToggleTools,
}: ToggleBarProps) {
  return (
    <div className="border-t border-white/5 bg-[#0c0c0e] p-3">
      <div className="flex w-full min-w-0 gap-2 rounded-lg border border-white/5 bg-white/5 p-1">
        <button
          type="button"
          onClick={onToggleThinking}
          aria-pressed={showThinking}
          className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all ${
            showThinking
              ? "bg-primary/15 text-white ring-1 ring-white/10"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="material-icons-round text-[15px]">psychology</span>
            Thoughts
          </span>
          <span
            className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
              showThinking ? "bg-primary" : "bg-white/10"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                showThinking ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleTools}
          aria-pressed={showTools}
          className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all ${
            showTools
              ? "bg-primary/15 text-white ring-1 ring-white/10"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="material-icons-round text-[15px]">build</span>
            Tools
          </span>
          <span
            className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
              showTools ? "bg-primary" : "bg-white/10"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                showTools ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
