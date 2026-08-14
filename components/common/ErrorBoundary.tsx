import React from 'react';
import { Button } from './Button';
import { campaignService } from '../../services/campaignService';

// ── Types ─────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** Optional custom fallback UI. Receives the error and a reset callback. */
    fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// ── ErrorBoundary ─────────────────────────────────────────────────────────

/**
 * React class-based error boundary. Catches runtime errors in the component
 * tree below it and renders a recovery screen instead of a blank page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyComponent />
 *   </ErrorBoundary>
 *
 * With custom fallback:
 *   <ErrorBoundary fallback={(err, reset) => <MyFallback error={err} onReset={reset} />}>
 *     <MyComponent />
 *   </ErrorBoundary>
 */
// Use a type alias to let TypeScript infer the full interface of React.Component
type ReactComponentInstance = React.Component<ErrorBoundaryProps, ErrorBoundaryState>;

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    // Declare instance members explicitly so TypeScript resolves them even
    // when useDefineForClassFields is false.
    declare state: ErrorBoundaryState;
    declare props: Readonly<ErrorBoundaryProps> & Readonly<{ children?: React.ReactNode }>;
    declare setState: ReactComponentInstance['setState'];

    constructor(props: ErrorBoundaryProps) {
        super(props);
        (this as unknown as { state: ErrorBoundaryState }).state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('[ErrorBoundary] Uncaught error:', error);
        console.error('[ErrorBoundary] Component stack:', info.componentStack);
    }

    reset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    // Finding #61: flush the debounced (AUTO_SAVE_DELAY_MS) pending campaign
    // write before reloading, so up to 2s of unsaved edits made right before
    // the throw are not discarded by the reload.
    handleReload = (): void => {
        try {
            campaignService.saveCampaign();
        } catch (e) {
            console.error('[ErrorBoundary] Failed to flush pending save before reload:', e);
        }
        window.location.reload();
    };

    render(): React.ReactNode {
        const { hasError, error } = this.state;
        const { children, fallback } = this.props;

        if (!hasError || !error) {
            return children;
        }

        // Custom fallback takes precedence
        if (fallback) {
            return fallback(error, this.reset);
        }

        // Default recovery screen — dark theme matching app styling
        return (
            <div className="flex flex-col items-center justify-center min-h-full p-8 bg-slate-900 text-slate-100">
                <div className="w-full max-w-md text-center space-y-6">
                    {/* Icon */}
                    <div className="flex justify-center">
                        <div className="w-16 h-16 rounded-full bg-red-900/30 border border-red-800 flex items-center justify-center">
                            <svg
                                className="w-8 h-8 text-red-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Heading */}
                    <div>
                        <h2 className="text-xl font-bold font-serif text-slate-100 mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            An unexpected error occurred in this part of the app.
                            Your campaign data is safe — this error is isolated to the current view.
                        </p>
                    </div>

                    {/* Error detail (collapsible) */}
                    <details className="text-left bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                        <summary className="px-4 py-2 text-xs text-slate-500 cursor-pointer hover:text-slate-300 select-none">
                            Error details
                        </summary>
                        <pre className="px-4 pb-3 text-xs text-red-400 overflow-auto max-h-32 leading-relaxed whitespace-pre-wrap break-words">
                            {error.message}
                        </pre>
                    </details>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={this.reset}
                        >
                            Try Again
                        </Button>
                        <Button
                            variant="secondary"
                            size="lg"
                            onClick={this.handleReload}
                        >
                            Reload App
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}
