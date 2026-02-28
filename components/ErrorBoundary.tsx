import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public readonly props: Readonly<Props>;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  /**
   * Updates state so the next render will show the fallback UI.
   * @param {Error} error - The error that was thrown by a descendant component.
   * @returns {State} The new state object indicating an error occurred.
   */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center" role="alert">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-zinc-400 mb-8 max-w-md">
            The application encountered an unexpected error.
            {this.state.error && (
              <details open className="mt-4 text-left bg-zinc-900 p-3 rounded border border-zinc-800">
                <summary className="text-sm font-medium text-zinc-300 cursor-pointer mb-2 outline-none focus:text-white">Error Details</summary>
                <span className="block text-xs font-mono text-red-400 overflow-auto max-h-32">{this.state.error.message}</span>
              </details>
            )}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 px-6 py-2.5 rounded-lg font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 outline-none"
            aria-label="Reload the application"
          >
            <RefreshCw size={18} /> Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}