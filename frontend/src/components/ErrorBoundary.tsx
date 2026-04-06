import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-red-600 text-2xl font-bold">!</span>
        </div>
        <div>
          <p className="font-semibold text-slate-800">Algo salió mal</p>
          <p className="text-sm text-red-600 mt-1 font-mono max-w-md break-all">{error.message}</p>
        </div>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={14} /> Recargar página
        </button>
      </div>
    );
  }
}
