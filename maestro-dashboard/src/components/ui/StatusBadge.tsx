import React from 'react';
import { STATUS_CONFIG, BATCH_STATUS_COLORS } from '@/config/constants';

interface StatusBadgeProps {
    status: string;
    type?: 'default' | 'batch';
    className?: string;
    showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    type = 'default',
    className = '',
    showDot = true
}) => {
    const s = status.toLowerCase();

    if (type === 'batch') {
        let config = BATCH_STATUS_COLORS.default;
        if (["running", "processing", "pending"].includes(s)) {
            config = BATCH_STATUS_COLORS.running;
        } else if (["failed", "error", "partial_failure"].includes(s)) {
            config = BATCH_STATUS_COLORS.failed;
        } else if (["completed", "success"].includes(s)) {
            config = BATCH_STATUS_COLORS.completed;
        }

        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}>
                {s.toUpperCase()}
            </span>
        );
    }

    // Default / Tool status style
    // Default / Tool status style
    const isActive = s === 'active';
    const isSetup = s === 'setup_required';

    let styles = "bg-gray-500/10 text-gray-500 border-gray-500/20";
    let dotColor = "bg-gray-500";
    let label = "Inactive";

    if (isActive) {
        styles = "bg-green-500/10 text-green-500 border-green-500/20";
        dotColor = "bg-green-500";
        label = "Active";
    } else if (isSetup) {
        styles = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
        dotColor = "bg-yellow-500";
        label = "Setup Required";
    } else if (STATUS_CONFIG[s]) {
        // Fallback to generic status config if available
        const config = STATUS_CONFIG[s];
        styles = `${config.bgClass} ${config.textClass} ${config.borderClass}`;
        // Use full dotClass from config
        dotColor = config.dotClass;
        label = config.label;
    }

    return (
        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles} ${className}`}>
            {showDot && (
                isActive ? (
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                ) : (
                    <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                )
            )}
            {label}
        </span>
    );
};
