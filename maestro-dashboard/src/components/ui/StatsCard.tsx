import React from 'react';

interface StatsCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    subValueLabel?: string;
    subValueColor?: string; // e.g. "text-primary bg-primary/10"
    className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
    title,
    value,
    subValue,
    subValueColor = "text-gray-400 bg-gray-500/10",
    className = ""
}) => {
    return (
        <div className={`bg-surface-dark p-6 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden group ${className}`}>
            <h3 className="text-gray-400 text-sm font-medium mb-2">{title}</h3>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                    {value}
                </span>
                {subValue && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${subValueColor}`}>
                        {subValue}
                    </span>
                )}
            </div>
        </div>
    );
};
