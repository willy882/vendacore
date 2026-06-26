import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, MessageCircle, TrendingUp, AlertTriangle, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { productsService } from '@/services/products.service';
import api from '@/lib/api';

const WA_SUPPORT = 'https://wa.me/51987654321';

interface Props {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: Props) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const isPOS     = location.pathname === '/punto-venta';

  const canSeeStock = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'almacenero']));
  const canSeeDocs  = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'cajero']));

  // Comparte cache con ['products'] — cualquier refetch/invalidate de products actualiza este badge
  const { data: stockData } = useQuery({
    queryKey: ['products', { limit: 500, isActive: true }],
    queryFn:  () => productsService.getAll({ limit: 500, isActive: true }),
    enabled:  canSeeStock,
    staleTime: 0,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: sunatData } = useQuery({
    queryKey: ['header-sunat-rechazados'],
    queryFn:  () => api.get('/documents', { params: { estado: 'rechazado', limit: 50 } }).then(r => r.data),
    enabled:  canSeeDocs,
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const lowStockCount    = canSeeStock
    ? (stockData?.data ?? []).filter(p =>
        Number(p.stockMinimo) > 0 && Number(p.stockActual) <= Number(p.stockMinimo)
      ).length
    : 0;
  const sunatRechazados  = canSeeDocs
    ? ((sunatData?.data ?? sunatData ?? []) as any[]).filter((d: any) => d.estado === 'rechazado').length
    : 0;

  return (
    <header className="h-14 bg-slate-900 flex items-center px-4 gap-3 flex-shrink-0">
      {/* Izquierda: hamburger + marca */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        title="Menú"
      >
        <Menu size={22} />
      </button>

      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md overflow-hidden bg-slate-800 flex items-center justify-center flex-shrink-0">
          <img src="/wcode.png" alt="W_Code" className="w-full h-full object-contain p-0.5"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div className="leading-none">
          <p className="text-white font-bold text-sm tracking-wide">W_Code</p>
          <p className="text-slate-400 text-[10px]">Conectando el mundo</p>
        </div>
      </div>

      {/* Centro: FLUJO CAJA solo en POS */}
      <div className="flex-1 flex justify-center">
        {isPOS && (
          <button
            onClick={() => navigate('/caja')}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-5 py-1.5 rounded-full transition-colors"
          >
            <TrendingUp size={15} />
            FLUJO CAJA
          </button>
        )}
      </div>

      {/* Derecha: badges + WhatsApp */}
      {canSeeStock && lowStockCount > 0 && (
        <button
          onClick={() => navigate('/productos')}
          title={`${lowStockCount} producto${lowStockCount !== 1 ? 's' : ''} bajo stock mínimo`}
          className="relative p-2 rounded-lg hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors"
        >
          <AlertTriangle size={20} />
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {lowStockCount > 99 ? '99+' : lowStockCount}
          </span>
        </button>
      )}
      {canSeeDocs && sunatRechazados > 0 && (
        <button
          onClick={() => navigate('/comprobantes', { state: { showRechazados: true } })}
          title={`${sunatRechazados} comprobante${sunatRechazados !== 1 ? 's' : ''} rechazado${sunatRechazados !== 1 ? 's' : ''} por SUNAT`}
          className="relative p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
        >
          <Bell size={20} />
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {sunatRechazados > 99 ? '99+' : sunatRechazados}
          </span>
        </button>
      )}
      <a
        href={WA_SUPPORT}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg hover:bg-green-600/20 text-green-400 hover:text-green-300 transition-colors"
        title="Soporte WhatsApp"
      >
        <MessageCircle size={22} />
      </a>
    </header>
  );
}
