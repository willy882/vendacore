import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, ChevronLeft, ChevronRight, Eye, XCircle,
  CalendarDays, User, Receipt, AlertTriangle,
} from 'lucide-react';
import { salesService } from '@/services/sales.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { formatCurrency, formatDateTime, currentMonthRange } from '@/lib/utils';
import type { Sale } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

// ─── Detalle de venta ──────────────────────────────────────────────────────────

function SaleDetailModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <Modal open title={`Venta #${sale.id.slice(-8).toUpperCase()}`} onClose={onClose}>
      <div className="space-y-4 text-sm">

        {/* Cabecera */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-lg p-3">
          <div>
            <p className="text-xs text-slate-500">Fecha</p>
            <p className="font-medium">{formatDateTime(sale.fecha)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Estado</p>
            <Badge variant={sale.estado === 'activa' ? 'success' : 'danger'}>
              {sale.estado === 'activa' ? 'Activa' : 'Anulada'}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-slate-500">Cliente</p>
            <p className="font-medium">{sale.customer?.nombreCompleto ?? 'Sin cliente'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Tipo</p>
            <p className="font-medium capitalize">{sale.tipoVenta}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Vendedor</p>
            <p className="font-medium">{sale.user.nombre} {sale.user.apellido}</p>
          </div>
        </div>

        {/* Items */}
        <div>
          <p className="font-semibold text-slate-700 mb-2">Productos</p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Producto</th>
                  <th className="text-right px-3 py-2">Cant.</th>
                  <th className="text-right px-3 py-2">P.Unit.</th>
                  <th className="text-right px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{item.product.nombre}</td>
                    <td className="px-3 py-2 text-right">{item.cantidad}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(Number(item.precioUnitario))}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totales */}
        <div className="bg-slate-50 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(Number(sale.subtotal))}</span>
          </div>
          {Number(sale.descuentoTotal) > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Descuentos</span>
              <span>-{formatCurrency(Number(sale.descuentoTotal))}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>IGV (18%)</span>
            <span>{formatCurrency(Number(sale.igv))}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-1 mt-1">
            <span>Total</span>
            <span>{formatCurrency(Number(sale.total))}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal de anulación ────────────────────────────────────────────────────────

function CancelModal({
  sale,
  onClose,
}: {
  sale: Sale;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [error, setError]   = useState('');

  const cancelMut = useMutation({
    mutationFn: () => salesService.cancel(sale.id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      onClose();
    },
    onError: (e: unknown) => {
      const data = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data;
      const msg = Array.isArray(data?.message)
        ? data!.message.join(', ')
        : (data?.message ?? 'Error al anular la venta');
      setError(msg);
    },
  });

  const handleConfirm = () => {
    if (!motivo.trim() || motivo.trim().length < 10) {
      setError('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    setError('');
    cancelMut.mutate();
  };

  return (
    <Modal open title="Anular Venta" onClose={onClose}>
      <div className="space-y-4">
        {/* Advertencia */}
        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-700">Esta acción no se puede deshacer</p>
            <p className="text-red-600 mt-0.5">
              La venta <span className="font-mono font-bold">#{sale.id.slice(-8).toUpperCase()}</span> por{' '}
              <strong>{formatCurrency(Number(sale.total))}</strong> será marcada como anulada
              y el stock de los productos se repondrá automáticamente.
            </p>
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Motivo de anulación <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: El cliente devolvió el producto, error en el cobro..."
            rows={3}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={cancelMut.isPending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={cancelMut.isPending}
          >
            {cancelMut.isPending ? <Spinner size="sm" /> : <XCircle size={16} />}
            {cancelMut.isPending ? 'Anulando...' : 'Confirmar anulación'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function HistorialVentasPage() {
  const { hasRoles } = useAuthStore();
  const canCancel    = hasRoles(['administrador', 'supervisor']);

  const today    = new Date().toISOString().split('T')[0];
  const { from: monthFrom } = currentMonthRange();

  const [from,       setFrom]       = useState(monthFrom);
  const [to,         setTo]         = useState(today);
  const [estadoFilt, setEstadoFilt] = useState('');
  const [page,       setPage]       = useState(1);
  const [selected,   setSelected]   = useState<Sale | null>(null);
  const [toCancel,   setToCancel]   = useState<Sale | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', { from, to, estado: estadoFilt, page }],
    queryFn:  () =>
      salesService.getAll({ from, to, estado: estadoFilt || undefined, page, limit: 20 }),
  });

  const ventas      = data?.data ?? [];
  const totalPages  = data?.totalPages ?? 1;
  const totalCount  = data?.total ?? 0;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial de Ventas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalCount} venta{totalCount !== 1 ? 's' : ''} encontradas
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={16} className="text-slate-400" />
            <span className="text-sm text-slate-600 font-medium">Desde</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-600 font-medium">Hasta</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Search size={16} className="text-slate-400" />
            <select
              value={estadoFilt}
              onChange={(e) => { setEstadoFilt(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los estados</option>
              <option value="activa">Activas</option>
              <option value="anulada">Anuladas</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : ventas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Receipt size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No se encontraron ventas</p>
            <p className="text-sm mt-1">Prueba cambiando el rango de fechas o los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">#</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Fecha</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Cliente</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Vendedor</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-semibold">Tipo</th>
                  <th className="text-right px-4 py-3 text-slate-600 font-semibold">Total</th>
                  <th className="text-center px-4 py-3 text-slate-600 font-semibold">Estado</th>
                  <th className="text-center px-4 py-3 text-slate-600 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {sale.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDateTime(sale.fecha)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400 flex-shrink-0" />
                        <span className="text-slate-700">
                          {sale.customer?.nombreCompleto ?? <span className="italic text-slate-400">Sin cliente</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {sale.user.nombre} {sale.user.apellido}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={sale.tipoVenta === 'contado' ? 'info' : 'warning'}>
                        {sale.tipoVenta === 'contado' ? 'Contado' : 'Crédito'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatCurrency(Number(sale.total))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={sale.estado === 'activa' ? 'success' : 'danger'}>
                        {sale.estado === 'activa' ? 'Activa' : 'Anulada'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title="Ver detalle"
                          onClick={() => setSelected(sale)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                        {canCancel && sale.estado === 'activa' && (
                          <button
                            title="Anular venta"
                            onClick={() => setToCancel(sale)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} /> Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      {selected && (
        <SaleDetailModal sale={selected} onClose={() => setSelected(null)} />
      )}
      {toCancel && (
        <CancelModal sale={toCancel} onClose={() => setToCancel(null)} />
      )}
    </div>
  );
}
