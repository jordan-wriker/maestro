import { useState } from "react";

export default function SettingsPage() {
    const [clearing, setClearing] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleClearDatabase = async () => {
        if (!window.confirm("Are you sure you want to delete ALL database records? This cannot be undone.")) {
            return;
        }

        setClearing(true);
        setMessage(null);

        try {
            const response = await fetch("/api/admin/clear-database", {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Failed to clear database");
            }

            setMessage({ text: "Database cleared successfully", type: "success" });
        } catch (error) {
            console.error(error);
            setMessage({ text: "Failed to clear database", type: "error" });
        } finally {
            setClearing(false);
        }
    };

    return (
        <div className="flex flex-col h-screen p-4 gap-4 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col gap-4 shrink-0">
                <h1 className="text-3xl font-bold text-white mb-1">Settings</h1>
                <p className="text-gray-400">Manage your orchestrator configuration.</p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-6 bg-[#0f0f12] rounded-xl border border-white/10 shadow-sm max-w-2xl">
                    <h2 className="text-xl font-semibold text-white mb-4">Data Management</h2>
                    <p className="text-gray-400 mb-6">
                        Manage your stored data. Clearing the database will remove all sessions, conversations, and task history.
                    </p>

                    {message && (
                        <div className={`p-4 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        onClick={handleClearDatabase}
                        disabled={clearing}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${clearing
                                ? 'bg-red-500/50 text-white/50 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]'
                            }`}
                    >
                        {clearing ? "Clearing..." : "Clear Database"}
                    </button>
                </div>
            </div>
        </div>
    );
}
