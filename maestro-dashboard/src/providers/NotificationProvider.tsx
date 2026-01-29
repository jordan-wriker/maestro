import { createContext, useContext, useState, useCallback, type ReactNode, useEffect } from 'react';
import { Toast, type ToastType } from '../components/ui/Toast';
import { apiState } from '../api/client';
import type { APIError } from '../types/api';

interface NotificationContextValue {
    showNotification: (type: ToastType, message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

interface ToastItem {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showNotification = useCallback((type: ToastType, message: string, duration = 5000) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, type, message, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    // Listen for global API errors
    useEffect(() => {
        const handleApiError = (error: APIError) => {
            let message = 'An unexpected error occurred';

            if (typeof error.detail === 'string') {
                message = error.detail;
            } else if (error.detail && typeof error.detail === 'object') {
                // Determine how to format object errors
                // For now, JSON stringify or just take the first error if it's a map
                try {
                    message = JSON.stringify(error.detail);
                } catch {
                    message = 'An error occurred (details invalid)';
                }
            }

            showNotification('error', message);
        };

        const unsubscribe = apiState.subscribeError(handleApiError);
        return () => {
            unsubscribe();
        };
    }, [showNotification]);

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex flex-col items-end pointer-events-none">
                {toasts.map((toast) => (
                    <Toast
                        key={toast.id}
                        {...toast}
                        onClose={removeToast}
                    />
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
