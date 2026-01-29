import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'h-6 w-6',
        md: 'h-12 w-12',
        lg: 'h-16 w-16'
    };

    return (
        <div className={`flex items-center justify-center py-20 ${className}`}>
            <div className={`animate-spin rounded-full border-b-2 border-primary ${sizeClasses[size]}`}></div>
        </div>
    );
};
