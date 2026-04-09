import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null; stack: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: '' };

  static getDerivedStateFromError(error: Error): State {
    return { error, stack: error.stack ?? '' };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    this.setState((s) => ({ ...s, stack: (error.stack ?? '') + '\n---\n' + info.componentStack }));
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col h-full min-h-64 gap-4 p-4 overflow-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <span className="text-red-600 text-xl font-bold">!</span>
          </div>
          <div>
            <p className="font-semibold text-slate-800">Algo salió mal</p>
            <p className="text-sm text-red-600 font-mono break-all">{error.message}</p>
          </div>
        </div>
        {stack && (
          <pre className="text-xs text-slate-600 bg-slate-100 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
            {stack}
          </pre>
        )}
        <button
          onClick={() => { this.setState({ error: null, stack: '' }); window.location.reload(); }}
          className="self-start flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={14} /> Recargar página
        </button>
      </div>
    );
  }
}
