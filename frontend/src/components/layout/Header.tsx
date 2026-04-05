import { Bell, Menu, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

interface Props {
  title:        string;
  onMenuClick?: () => void;
  onRefresh?:   () => void;
  isRefreshing?: boolean;
}

export function Header({ title, onMenuClick, onRefresh, isRefreshing }: Props) {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center px-4 gap-3 flex-shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
      >
        <Menu size={20} />
      </button>

      {/* Title */}
      <h1 className="text-base font-semibold text-slate-800 flex-1">{title}</h1>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
          </button>
        )}

        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-semibold">
          {user ? `${user.nombre[0]}${user.apellido[0]}` : '?'}
        </div>
      </div>
    </header>
  );
}
