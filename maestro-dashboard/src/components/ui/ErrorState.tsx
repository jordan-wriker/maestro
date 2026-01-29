

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    fullScreen?: boolean;
}

export function ErrorState({
    title = "Something went wrong",
    message = "An unexpected error occurred. Please try again.",
    onRetry,
    fullScreen = false
}: ErrorStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center ${fullScreen ? 'min-h-screen' : 'h-full bg-surface-dark/50 rounded-lg'}`}>
            <div className="w-16 h-16 mb-4 text-red-500 bg-red-500/10 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
            <p className="text-gray-400 mb-6 max-w-md">{message}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-md transition-colors font-medium"
                >
                    Try Again
                </button>
            )}
        </div>
    );
}

export default ErrorState;
