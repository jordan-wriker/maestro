// Force rebuild: 2
import type { ConversationEvent } from "../../types/models";

interface EventBlockProps {
    event: ConversationEvent;
    agent: "claude" | "codex";
}

export default function EventBlock({
    event,
    agent,
}: EventBlockProps) {
    // Force Tailwind scan: hidden
    // Color scheme - consistent for both agents:
    // - Thinking: Purple
    // - Tool call/response: Blue
    // - Result: Green

    switch (event.type) {
        case "prompt":
            return (
                <div className="flex justify-end">
                    <div className="max-w-[80%] bg-[#1e1e24] text-white p-4 rounded-2xl rounded-tr-sm shadow-md border border-white/5">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                            <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                                Maestro Prompt
                            </span>
                            {event.timestamp && (
                                <span className="text-[10px] font-mono text-gray-500">
                                    {event.timestamp}
                                </span>
                            )}
                        </div>
                        <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                            {event.content}
                        </p>
                    </div>
                </div>
            );

        case "system":
            return (
                <div className="flex justify-center">
                    <div className="px-4 py-2 bg-white/5 rounded-full text-xs text-gray-400 border border-white/5">
                        {event.content}
                    </div>
                </div>
            );

        case "thinking":
        case "reasoning":
            return (
                <div className="flex justify-start w-full">
                    <div
                        className="w-full max-w-[85%] border p-4 rounded-xl relative group"
                        style={{
                            borderColor: "rgba(168,85,247,0.3)",
                            backgroundColor: "rgba(168,85,247,0.05)",
                        }}
                    >
                        <div
                            className="absolute -left-3 top-4 w-6 h-6 rounded-full flex items-center justify-center border z-10"
                            style={{
                                backgroundColor: "#581c87",
                                borderColor: "#a855f7",
                                boxShadow: "0 0 20px rgba(168,85,247,0.5)",
                            }}
                        >
                            <span className="material-icons-round text-white text-xs">
                                psychology
                            </span>
                        </div>
                        <div className="pl-5">
                            <div className="flex items-center gap-2 mb-2">
                                <span
                                    className="text-xs font-bold uppercase tracking-wider"
                                    style={{ color: "#c084fc" }}
                                >
                                    Thinking
                                </span>
                                <span
                                    className="h-px w-8"
                                    style={{ backgroundColor: "rgba(168,85,247,0.3)" }}
                                ></span>
                            </div>
                            <p
                                className="font-mono text-xs leading-relaxed"
                                style={{ color: "rgba(233,213,255,0.8)" }}
                            >
                                {event.content}
                            </p>
                        </div>
                    </div>
                </div>
            );

        case "response":
            if (agent === "claude") {
                return (
                    <div className="flex justify-start w-full">
                        <div
                            className="w-full max-w-[85%] border p-4 rounded-xl relative group"
                            style={{
                                borderColor: "rgba(168,85,247,0.3)",
                                backgroundColor: "rgba(168,85,247,0.05)",
                            }}
                        >
                            <div
                                className="absolute -left-3 top-4 w-6 h-6 rounded-full flex items-center justify-center border z-10"
                                style={{
                                    backgroundColor: "#581c87",
                                    borderColor: "#a855f7",
                                    boxShadow: "0 0 20px rgba(168,85,247,0.5)",
                                }}
                            >
                                <span className="material-icons-round text-white text-xs">
                                    psychology
                                </span>
                            </div>
                            <div className="pl-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <span
                                        className="text-xs font-bold uppercase tracking-wider"
                                        style={{ color: "#c084fc" }}
                                    >
                                        Thinking
                                    </span>
                                    <span
                                        className="h-px w-8"
                                        style={{ backgroundColor: "rgba(168,85,247,0.3)" }}
                                    ></span>
                                </div>
                                <p
                                    className="font-mono text-xs leading-relaxed"
                                    style={{ color: "rgba(233,213,255,0.8)" }}
                                >
                                    {event.content}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            }

            // Blue theme for agent responses (intermediate messages)
            return (
                <div className="flex justify-start w-full">
                    <div
                        className="w-full max-w-[85%] border p-4 rounded-xl relative group"
                        style={{
                            borderColor: "rgba(59,130,246,0.3)",
                            backgroundColor: "rgba(59,130,246,0.05)",
                        }}
                    >
                        <div
                            className="absolute -left-3 top-4 w-6 h-6 rounded-full flex items-center justify-center border z-10"
                            style={{
                                backgroundColor: "#1e3a5f",
                                borderColor: "#3b82f6",
                                boxShadow: "0 0 20px rgba(59,130,246,0.5)",
                            }}
                        >
                            <span className="material-icons-round text-white text-xs">
                                smart_toy
                            </span>
                        </div>
                        <div className="pl-5">
                            <div className="flex items-center gap-2 mb-2">
                                <span
                                    className="text-xs font-bold uppercase tracking-wider"
                                    style={{ color: "#60a5fa" }}
                                >
                                    Codex
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                                {event.content}
                            </p>
                        </div>
                    </div>
                </div>
            );

        case "tool_call":
            // Blue theme for tool calls - fixed height cards with scrollable content
            return (
                <div className="flex justify-start w-full">
                    <div className="w-full max-w-[85%] pl-8 space-y-2">
                        <div className="bg-[#0d1117] border-l-2 border-blue-500 p-3 rounded-r-lg font-mono text-xs shadow-sm">
                            <div className="flex justify-between items-center mb-1 text-blue-400">
                                <span className="font-bold">tool_call: {event.tool}</span>
                            </div>
                            {event.content && (
                                <pre className="text-gray-300 whitespace-pre-wrap text-xs overflow-x-auto max-h-32 overflow-y-auto">
                                    {event.content}
                                </pre>
                            )}
                        </div>
                        {event.output && (
                            <div className="bg-[#0d1117] border-l-2 border-sky-500 p-3 rounded-r-lg font-mono text-xs shadow-sm">
                                <div className="flex justify-between items-center mb-1 text-sky-400">
                                    <span className="font-bold">output</span>
                                </div>
                                <pre className="text-gray-400 whitespace-pre-wrap text-xs overflow-x-auto max-h-32 overflow-y-auto">
                                    {event.output}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            );

        case "result":
            // Green theme for final result
            return (
                <div className="flex justify-start">
                    <div
                        className="max-w-[80%] border text-gray-100 p-5 rounded-2xl rounded-tl-sm shadow-lg"
                        style={{
                            background: "linear-gradient(to bottom right, #14532d, #166534)",
                            borderColor: "rgba(34,197,94,0.3)",
                            boxShadow: "0 4px 6px -1px rgba(34,197,94,0.1)",
                        }}
                    >
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <span
                                    className="material-icons-round text-sm"
                                    style={{ color: "#22c55e" }}
                                >
                                    check_circle
                                </span>
                                <span
                                    className="text-xs font-bold tracking-wider uppercase"
                                    style={{ color: "#86efac" }}
                                >
                                    {agent === "claude" ? "Claude" : "Codex"} Result
                                </span>
                            </div>
                        </div>
                        <div className="prose prose-sm prose-invert max-w-none text-sm text-gray-200 whitespace-pre-wrap">
                            {event.content}
                        </div>
                    </div>
                </div>
            );

        default:
            return null;
    }
}
