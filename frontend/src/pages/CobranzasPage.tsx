import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Eye,
  CreditCard, User, AlertTriangle, CheckCircle, Search, History, X,
} from 'lucide-react';
import { salesService } from '@/services/sales.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

// ── Modal registrar cobro ─────────────────────────────────────────────────────

function PaymentModal({ sale, paymentMethods, onClose }: {
  sale: any;
  paymentMethods: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [monto, setMonto] = useState(String(Number(sale.saldoPendiente)));
  const [pmId, setPmId] = useState(paymentMethods[0]?.id ?? '');
  const [ref, setRef] = useState('');
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: () =>
      salesService.registerCreditPayment(sale.id, {
        monto: parseFloat(monto),
        paymentMethodId: pmId,
        referencia: ref || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-credit'] });
      qc.invalidateQueries({ queryKey: ['credit-payment-history'] });
      onClose();
    },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Error al registrar pago'),
  });

  const handleSubmit = () => {
    const m = parseFloat(monto);
    if (!m || m <= 0) { setErr('Ingresa un monto válido'); return; }
    if (!pmId) { setErr('Selecciona un método de pago'); return; }
    setErr('');
    mut.mutate();
  };

  return (
    <Modal open onClose={onClose} title="Registrar cobro" size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={mut.isPending} icon={<CheckCircle size={15} />}>
            Registrar cobro
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          <p className="font-semibold text-amber-800">Venta #{sale.id.slice(-8).toUpperCase()}</p>
          <p className="text-amber-700 mt-0.5">Cliente: <strong>{sale.customer?.nombreCompleto ?? 'Sin cliente'}</strong></p>
          <div className="flex justify-between mt-1">
            <span className="text-amber-600">Total venta:</span>
            <span className="font-semibold">{formatCurrency(Number(sale.total))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-600">Pagado:</span>
            <span className="font-semibold text-emerald-700">{formatCurrency(Number(sale.montoPagado))}</span>
          </div>
          <div className="flex justify-between border-t border-amber-200 mt-1 pt-1">
            <span className="font-semibold text-amber-800">Saldo pendiente:</span>
            <span className="font-bold text-red-600">{formatCurrency(Number(sale.saldoPendiente))}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Monto a cobrar (S/)</label>
          <input
            type="number" step="0.01" min="0.01" max={Number(sale.saldoPendiente)}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Método de pago</label>
          <select
            value={pmId}
            onChange={(e) => setPmId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>{pm.nombre}</option>
            ))}
          </select>
        </div>

        <Input label="Referencia (opcional)" placeholder="Nro. operación, comprobante..." value={ref} onChange={(e) => setRef(e.target.value)} />

        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
      </div>
    </Modal>
  );
}

// ── Modal detalle venta ───────────────────────────────────────────────────────

function SaleDetailModal({ sale, onClose }: { sale: any; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Detalle venta #${sale.id.slice(-8).toUpperCase()}`} size="md">
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3">
          <div><p className="text-xs text-slate-500">Fecha</p><p className="font-medium">{formatDateTime(sale.fecha)}</p></div>
          <div><p className="text-xs text-slate-500">Cliente</p><p className="font-medium">{sale.customer?.nombreCompleto ?? '—'}</p></div>
          <div><p className="text-xs text-slate-500">Teléfono</p><p className="font-medium">{sale.customer?.telefono ?? '—'}</p></div>
          <div><p className="text-xs text-slate-500">Vendedor</p><p className="font-medium">{sale.user?.nombre} {sale.user?.apellido}</p></div>
        </div>

        {sale.items && (
          <div>
            <p className="font-semibold text-slate-700 mb-2">Productos</p>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-slate-600">Producto</th>
                    <th className="text-right px-3 py-2 text-slate-600">Cant.</th>
                    <th className="text-right px-3 py-2 text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item: any, i: number) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2">{item.product.nombre}</td>
                      <td className="px-3 py-2 text-right">{item.cantidad}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-slate-50 rounded-xl p-3 space-y-1">
          <div className="flex justify-between text-slate-600"><span>Total venta</span><span className="font-semibold">{formatCurrency(Number(sale.total))}</span></div>
          <div className="flex justify-between text-emerald-600"><span>Pagado</span><span className="font-semibold">{formatCurrency(Number(sale.montoPagado))}</span></div>
          <div className="flex justify-between text-red-600 border-t border-slate-200 pt-1 mt-1"><span className="font-semibold">Saldo pendiente</span><span className="font-bold">{formatCurrency(Number(sale.saldoPendiente))}</span></div>
        </div>
      </div>
    </Modal>
  );
}

// ── Tab: Pendientes ───────────────────────────────────────────────────────────

function PendientesTab({ canCollect, paymentMethods }: { canCollect: boolean; paymentMethods: any[] }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [toPay, setToPay] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pending-credit', page, search],
    queryFn: () => salesService.getPendingCredit(page, 20),
  });

  const sales = (data?.data ?? []).filter((s: any) =>
    !search || s.customer?.nombreCompleto?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = data?.totalPages ?? 1;
  const totalSaldo = (data?.data ?? []).reduce((acc: number, s: any) => acc + Number(s.saldoPendiente), 0);

  const handleSearch = () => setSearch(searchInput);

  return (
    <>
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-slate-800">{data?.total ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Ventas pendientes</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalSaldo)}</p>
          <p className="text-xs text-slate-500 mt-1">Saldo pendiente (pág. actual)</p>
        </Card>
      </div>

      {/* Búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por cliente..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button size="sm" onClick={handleSearch} icon={<Search size={14} />}>Buscar</Button>
        {search && (
          <Button size="sm" variant="outline" icon={<X size={14} />} onClick={() => { setSearch(''); setSearchInput(''); }}>
            Limpiar
          </Button>
        )}
      </div>

      {/* Tabla */}
      <Card padding="none">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <AlertTriangle size={16} className="text-amber-500" />
          <span className="text-sm text-slate-600"><strong>{data?.total ?? 0}</strong> venta(s) pendiente(s) de cobro</span>
          {isLoading && <Spinner size="sm" className="ml-1" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">#</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Fecha</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Cliente</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Total</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Pagado</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Saldo</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
                  <p className="text-slate-500 font-medium">No hay cobranzas pendientes</p>
                </td></tr>
              ) : sales.map((sale: any) => (
                <tr key={sale.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{sale.id.slice(-8).toUpperCase()}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(sale.fecha)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" />
                      <span>{sale.customer?.nombreCompleto ?? <span className="italic text-slate-400">Sin cliente</span>}</span>
                    </div>
                    {sale.customer?.telefono && <p className="text-xs text-slate-400 mt-0.5 ml-5">{sale.customer.telefono}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(sale.total))}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatCurrency(Number(sale.montoPagado))}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-red-600">{formatCurrency(Number(sale.saldoPendiente))}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setSelected(sale)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Ver detalle"><Eye size={15} /></button>
                      {canCollect && (
                        <button onClick={() => setToPay(sale)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Registrar cobro">
                          <CreditCard size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" icon={<ChevronLeft size={14} />} disabled={page === 1} onClick={() => setPage((p) => p - 1)} />
              <Button variant="outline" size="sm" icon={<ChevronRight size={14} />} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} />
            </div>
          </div>
        )}
      </Card>

      {selected && <SaleDetailModal sale={selected} onClose={() => setSelected(null)} />}
      {toPay && <PaymentModal sale={toPay} paymentMethods={paymentMethods} onClose={() => setToPay(null)} />}
    </>
  );
}

// ── Tab: Historial de cobros ──────────────────────────────────────────────────

function HistorialTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['credit-payment-history', page, search, from, to],
    queryFn: () => salesService.getCreditPaymentHistory({
      page, limit: 20,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
  });

  const payments = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCobrado = payments.reduce((acc: number, p: any) => acc + Number(p.monto), 0);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const clearFilters = () => { setSearch(''); setSearchInput(''); setFrom(''); setTo(''); setPage(1); };

  return (
    <>
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-emerald-600">{data?.total ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Cobros registrados</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalCobrado)}</p>
          <p className="text-xs text-slate-500 mt-1">Total cobrado (página actual)</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por cliente..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Desde</p>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Hasta</p>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <Button size="sm" onClick={handleSearch} icon={<Search size={14} />}>Buscar</Button>
          {(search || from || to) && (
            <Button size="sm" variant="outline" icon={<X size={14} />} onClick={clearFilters}>Limpiar</Button>
          )}
        </div>
      </Card>

      {/* Tabla */}
      <Card padding="none">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <History size={16} className="text-emerald-500" />
          <span className="text-sm text-slate-600"><strong>{data?.total ?? 0}</strong> cobro(s) registrado(s)</span>
          {isLoading && <Spinner size="sm" className="ml-1" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Fecha cobro</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Cliente</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Venta #</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Método</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Monto cobrado</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Saldo restante</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400">No hay cobros registrados</td></tr>
              ) : payments.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(p.fecha)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{p.sale?.customer?.nombreCompleto ?? <span className="italic text-slate-400">Sin cliente</span>}</p>
                    {p.sale?.customer?.numeroDocumento && <p className="text-xs text-slate-400">{p.sale.customer.numeroDocumento}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.sale?.id?.slice(-8).toUpperCase()}</td>
                  <td className="px-4 py-3 text-slate-600">{p.paymentMethod?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(Number(p.monto))}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={Number(p.sale?.saldoPendiente) <= 0 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                      {formatCurrency(Number(p.sale?.saldoPendiente ?? 0))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.referencia ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" icon={<ChevronLeft size={14} />} disabled={page === 1} onClick={() => setPage((p) => p - 1)} />
              <Button variant="outline" size="sm" icon={<ChevronRight size={14} />} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} />
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CobranzasPage() {
  const canCollect = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'cajero']));
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes');

  const { data: pmData } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => import('@/lib/api').then(({ default: api }) =>
      api.get('/sales/payment-methods').then((r) => r.data)
    ),
  });
  const paymentMethods = pmData ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Cobranzas</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ventas a crédito y registro de cobros</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('pendientes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'pendientes' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <AlertTriangle size={15} className={tab === 'pendientes' ? 'text-amber-500' : 'text-slate-400'} />
          Pendientes
        </button>
        <button
          onClick={() => setTab('historial')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'historial' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <History size={15} className={tab === 'historial' ? 'text-emerald-500' : 'text-slate-400'} />
          Historial de cobros
        </button>
      </div>

      {tab === 'pendientes' ? (
        <PendientesTab canCollect={canCollect} paymentMethods={paymentMethods} />
      ) : (
        <HistorialTab />
      )}
    </div>
  );
}