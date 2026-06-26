import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, ChevronDown, CheckCircle,
  Filter, MoreVertical, CreditCard, Eye, FileSpreadsheet, FileText,
} from 'lucide-react';
import { salesService } from '@/services/sales.service';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/auth.store';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string | Date) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getFullYear()).slice(2)}`;
};

const fmtMoney = (v: number) =>
  `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const addDays = (d: string | Date, days: number) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt;
};

// ── Modal registrar cobro ─────────────────────────────────────────────────────

function PaymentModal({ sale, paymentMethods, onClose }: {
  sale: any; paymentMethods: any[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [monto, setMonto]   = useState(String(Number(sale.saldoPendiente)));
  const [pmId, setPmId]     = useState(paymentMethods[0]?.id ?? '');
  const [ref, setRef]       = useState('');
  const [err, setErr]       = useState('');

  const mut = useMutation({
    mutationFn: () => salesService.registerCreditPayment(sale.id, {
      monto: parseFloat(monto), paymentMethodId: pmId, referencia: ref || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-credit'] }); onClose(); },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Error al registrar pago'),
  });

  return (
    <Modal open onClose={onClose} title="Registrar cobro" size="sm"
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => {
          const m = parseFloat(monto);
          if (!m || m <= 0) { setErr('Ingresa un monto válido'); return; }
          if (!pmId) { setErr('Selecciona método de pago'); return; }
          setErr(''); mut.mutate();
        }} loading={mut.isPending} icon={<CheckCircle size={15} />}>Registrar</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm space-y-1">
          <p className="font-semibold text-amber-800">{sale.customer?.nombreCompleto ?? 'Sin cliente'}</p>
          <div className="flex justify-between text-amber-700"><span>Total venta:</span><span className="font-medium">{fmtMoney(Number(sale.total))}</span></div>
          <div className="flex justify-between text-emerald-700"><span>Pagado:</span><span className="font-medium">{fmtMoney(Number(sale.montoPagado))}</span></div>
          <div className="flex justify-between text-red-700 border-t border-amber-200 pt-1 mt-1 font-bold"><span>Pendiente:</span><span>{fmtMoney(Number(sale.saldoPendiente))}</span></div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Monto a cobrar (S/)</label>
          <input type="number" step="0.01" min="0.01" max={Number(sale.saldoPendiente)} value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Método de pago</label>
          <select value={pmId} onChange={(e) => setPmId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            {paymentMethods.map((pm) => <option key={pm.id} value={pm.id}>{pm.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Referencia (opcional)</label>
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Nro. operación..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
      </div>
    </Modal>
  );
}

// ── Modal detalle venta ───────────────────────────────────────────────────────

function SaleDetailModal({ sale, onClose }: { sale: any; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Detalle — ${sale.customer?.nombreCompleto ?? 'Sin cliente'}`} size="md">
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3">
          <div><p className="text-xs text-slate-500">Emisión</p><p className="font-medium">{fmtDate(sale.fecha)}</p></div>
          <div><p className="text-xs text-slate-500">Cliente</p><p className="font-medium">{sale.customer?.nombreCompleto ?? '—'}</p></div>
          <div><p className="text-xs text-slate-500">Documento</p><p className="font-medium">{sale.customer?.numeroDocumento ?? '—'}</p></div>
          <div><p className="text-xs text-slate-500">Teléfono</p><p className="font-medium">{sale.customer?.telefono ?? '—'}</p></div>
        </div>
        {sale.items && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-600 font-semibold">Producto</th>
                  <th className="text-right px-3 py-2 text-slate-600 font-semibold">Cant.</th>
                  <th className="text-right px-3 py-2 text-slate-600 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item: any, i: number) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2">{item.product?.nombre ?? item.descripcion ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{item.cantidad}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtMoney(Number(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-700"><span>Total venta</span><span className="font-semibold">{fmtMoney(Number(sale.total))}</span></div>
          <div className="flex justify-between text-emerald-600"><span>Pagado</span><span className="font-semibold">{fmtMoney(Number(sale.montoPagado))}</span></div>
          <div className="flex justify-between text-red-600 border-t border-slate-200 pt-1.5"><span className="font-bold">Saldo pendiente</span><span className="font-bold">{fmtMoney(Number(sale.saldoPendiente))}</span></div>
        </div>
      </div>
    </Modal>
  );
}

// ── Row Action Menu ───────────────────────────────────────────────────────────

function RowMenu({ onView, onPay, canCollect }: { onView: () => void; onPay: () => void; canCollect: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 bg-white rounded-xl border border-slate-100 shadow-xl py-1 w-40 overflow-hidden">
            <button onClick={() => { setOpen(false); onView(); }}
              className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <Eye size={14} className="text-blue-500" /> Ver detalle
            </button>
            {canCollect && (
              <button onClick={() => { setOpen(false); onPay(); }}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <CreditCard size={14} className="text-emerald-500" /> Registrar cobro
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CobranzasPage() {
  const canCollect = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'cajero']));

  const [estadoFiltro,   setEstadoFiltro]   = useState<string>('pendiente');
  const [clienteSearch,  setClienteSearch]  = useState<string>('');
  const [appliedEstado,  setAppliedEstado]  = useState<string>('pendiente');
  const [appliedCliente, setAppliedCliente] = useState<string>('');
  const [page,           setPage]           = useState(1);
  const [rowsPerPage,    setRowsPerPage]    = useState<number | 'all'>('all');
  const [selected,       setSelected]       = useState<any>(null);
  const [toPay,          setToPay]          = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pending-credit', appliedEstado, page],
    queryFn:  () => salesService.getPendingCredit(page, 200),
  });

  const { data: pmData } = useQuery({
    queryKey: ['payment-methods'],
    queryFn:  () => import('@/lib/api').then(({ default: api }) =>
      api.get('/sales/payment-methods').then((r) => r.data)
    ),
  });
  const paymentMethods = pmData ?? [];

  const allSales: any[] = data?.data ?? [];

  // Filter client-side
  const filteredSales = useMemo(() => {
    return allSales.filter((s) => {
      const matchCliente = !appliedCliente
        || s.customer?.nombreCompleto?.toLowerCase().includes(appliedCliente.toLowerCase())
        || s.customer?.numeroDocumento?.includes(appliedCliente);
      return matchCliente;
    });
  }, [allSales, appliedCliente]);

  const pagedSales = rowsPerPage === 'all' ? filteredSales
    : filteredSales.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const totalPendiente = filteredSales.reduce((acc, s) => acc + Number(s.saldoPendiente), 0);
  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(filteredSales.length / rowsPerPage);

  const handleFiltrar = () => {
    setAppliedEstado(estadoFiltro);
    setAppliedCliente(clienteSearch);
    setPage(1);
  };

  // Export Excel (simple CSV)
  const exportExcel = () => {
    const rows = [
      ['Cliente', 'Documento', 'Comprobante', 'Emision', 'Vencimiento', 'Dias', 'Estado', 'Total', 'Pendiente', 'Pagado'],
      ...filteredSales.map((s) => {
        const dias = s.diasCredito ?? 15;
        const venc = fmtDate(addDays(s.fecha, dias));
        const comp = s.documents?.[0]?.numero ?? s.id.slice(-8).toUpperCase();
        return [
          s.customer?.nombreCompleto ?? 'Sin cliente',
          s.customer?.numeroDocumento ?? '',
          comp,
          fmtDate(s.fecha),
          venc,
          `${dias} días`,
          (s.estado ?? 'pendiente').toUpperCase(),
          Number(s.total).toFixed(2),
          Number(s.saldoPendiente).toFixed(2),
          Number(s.montoPagado).toFixed(2),
        ];
      }),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cx-cobrar.csv';
    a.click();
  };

  return (
    <div className="min-h-full bg-gray-50 p-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center">
            <FileText size={18} className="text-slate-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Cx Cobrar</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all">
            <FileSpreadsheet size={15} /> EXCEL
          </button>
          <button
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all">
            <FileText size={15} /> PDF
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        {/* Estado */}
        <div className="relative">
          <label className="absolute -top-2 left-2 text-[10px] font-bold text-slate-500 bg-gray-50 px-1">Estado</label>
          <div className="flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-2 bg-white min-w-[180px]">
            <Filter size={13} className="text-slate-400 flex-shrink-0" />
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}
              className="flex-1 text-sm font-semibold text-slate-700 outline-none bg-transparent appearance-none cursor-pointer pr-1">
              <option value="pendiente">PENDIENTE</option>
              <option value="liquidado">LIQUIDADO</option>
              <option value="eliminado">ELIMINADO</option>
            </select>
            <ChevronDown size={14} className="text-slate-400 flex-shrink-0 pointer-events-none" />
          </div>
        </div>

        {/* Buscar cliente */}
        <div className="relative flex-1 min-w-[220px]">
          <label className="absolute -top-2 left-2 text-[10px] font-bold text-slate-500 bg-gray-50 px-1">Buscar Cliente</label>
          <input
            value={clienteSearch}
            onChange={(e) => setClienteSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFiltrar()}
            placeholder="Nombre o documento..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <button onClick={handleFiltrar}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-bold px-5 py-2 rounded-lg transition-all">
          <Filter size={14} /> FILTRAR
        </button>
      </div>

      {/* ── Total pendiente ── */}
      <p className="text-lg font-bold text-slate-800 mb-4">
        Total Pendiente:&nbsp;
        <span className="text-red-600">{fmtMoney(totalPendiente)}</span>
      </p>

      {/* ── Tabla ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {['Cliente', 'Emision', 'Venci.', 'Días', 'Estado', 'Total', 'Pendiente', 'Pagado', 'Accion'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : pagedSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
                    <p className="text-slate-500 font-medium">No hay cobranzas pendientes</p>
                  </td>
                </tr>
              ) : pagedSales.map((sale: any, idx: number) => {
                const dias     = sale.diasCredito ?? 15;
                const vencDate = addDays(sale.fecha, dias);
                const vencida  = vencDate < new Date() && Number(sale.saldoPendiente) > 0;
                const comp     = sale.documents?.[0]?.numero ?? '';
                const compType = comp.startsWith('B') ? 'B' : comp.startsWith('T') ? 'T' : null;

                return (
                  <tr key={sale.id ?? idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">

                    {/* Cliente */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 text-sm leading-tight">
                        {sale.customer?.nombreCompleto?.toUpperCase() ?? 'SIN CLIENTE'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{sale.customer?.numeroDocumento ?? '00000000'}</span>
                        {comp && (
                          <button className={`text-xs font-semibold ${compType === 'B' ? 'text-blue-500' : 'text-blue-400'} hover:underline`}>
                            {comp}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Emision */}
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {fmtDate(sale.fecha)}
                    </td>

                    {/* Venci. */}
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap
                        ${vencida ? 'bg-red-100 text-red-700' : 'bg-pink-100 text-pink-700'}`}>
                        {fmtDate(vencDate)}
                      </span>
                    </td>

                    {/* Días */}
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold whitespace-nowrap">
                        {dias} días
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap
                        ${Number(sale.saldoPendiente) <= 0
                          ? 'bg-emerald-500 text-white'
                          : Number(sale.montoPagado) > 0
                            ? 'bg-blue-500 text-white'
                            : 'bg-orange-400 text-white'}`}>
                        {Number(sale.saldoPendiente) <= 0
                          ? 'PAGADA'
                          : Number(sale.montoPagado) > 0
                            ? 'PARCIAL'
                            : 'PENDIENTE'}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 text-slate-700 font-semibold whitespace-nowrap">
                      S/ {Number(sale.total).toFixed(2)}
                    </td>

                    {/* Pendiente */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-red-600">
                        S/ {Number(sale.saldoPendiente).toFixed(2)}
                      </span>
                    </td>

                    {/* Pagado */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-emerald-600">
                        S/{Number(sale.montoPagado).toFixed(2)}
                      </span>
                    </td>

                    {/* Accion */}
                    <td className="px-4 py-3">
                      <RowMenu
                        canCollect={canCollect && Number(sale.saldoPendiente) > 0}
                        onView={() => setSelected(sale)}
                        onPay={() => setToPay(sale)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Paginación ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Rows per page:</span>
            <select
              value={rowsPerPage === 'all' ? 'all' : String(rowsPerPage)}
              onChange={(e) => {
                const v = e.target.value;
                setRowsPerPage(v === 'all' ? 'all' : parseInt(v));
                setPage(1);
              }}
              className="border border-slate-300 rounded-md px-2 py-1 text-sm bg-white outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>
              {rowsPerPage === 'all'
                ? `1-${filteredSales.length} of ${filteredSales.length}`
                : `${Math.min((page - 1) * rowsPerPage + 1, filteredSales.length)}-${Math.min(page * rowsPerPage, filteredSales.length)} of ${filteredSales.length}`}
            </span>
            <button
              disabled={page === 1 || rowsPerPage === 'all'}
              onClick={() => setPage((p) => p - 1)}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={page >= totalPages || rowsPerPage === 'all'}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modales ── */}
      {selected && <SaleDetailModal sale={selected} onClose={() => setSelected(null)} />}
      {toPay && <PaymentModal sale={toPay} paymentMethods={paymentMethods} onClose={() => setToPay(null)} />}
    </div>
  );
}
