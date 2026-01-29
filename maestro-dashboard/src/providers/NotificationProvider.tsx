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
            // Prevent duplicate error toasts if possible, but for now just show them
            // We could filter 404s if we didn't want to alert on those, but typically we do so user knows
            showNotification('error', error.detail || 'An unexpected error occurred');
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
