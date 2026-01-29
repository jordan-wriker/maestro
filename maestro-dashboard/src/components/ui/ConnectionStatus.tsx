import { useContext } from 'react';
import { WebSocketContext } from '@/providers/WebSocketProvider';

export function ConnectionStatus() {
    const { isConnected, connectionError, retryConnection } = useContext(WebSocketContext);

    if (isConnected && !connectionError) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-2 bg-red-900/80 backdrop-blur-sm border-b border-red-700">
            <div className="flex items-center gap-3">
                <span className="text-white text-sm font-medium">
                    {connectionError || "Connecting to server..."}
                </span>
                {connectionError && (
                    <button
                        onClick={retryConnection}
                        className="px-3 py-1 text-xs font-semibold bg-white text-red-900 rounded hover:bg-gray-100 transition-colors"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}

export default ConnectionStatus;
