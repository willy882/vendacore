import { useState } from 'react';
import { RotateCcw, Search, X, FileX, AlertCircle, CheckCircle2, Calendar, ChevronRight, User } from 'lucide-react';
import api from '@/lib/api';

const fmtMoney = (v: number | string) =>
  `S/.${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | Date) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

interface SaleItem {
  id: string;
  descripcion: string | null;
  cantidad: string | number;
  precioUnitario: string | number;
  total: string | number;
  product: { id: string; nombre: string } | null;
}

interface Sale {
  id: string;
  fecha: string;
  total: string | number;
  estado: string;
  customer: { id: string; nombreCompleto: string; numeroDocumento: string } | null;
  items: SaleItem[];
  electronicDocuments: { id: string; tipo: string; numeroCompleto: string; estado: string }[];
}

type SearchMode = 'documento' | 'sin-documento';

export default function DevolucionesPage() {
  // Modo de búsqueda
  const [mode, setMode] = useState<SearchMode>('documento');

  // Modo documento
  const [serie, setSerie]             = useState('');
  const [correlativo, setCorrelativo] = useState('');

  // Modo sin documento
  const [fromDate, setFromDate]       = useState(todayISO());
  const [toDate, setToDate]           = useState(todayISO());
  const [clientSearch, setClientSearch] = useState('');
  const [salesList, setSalesList]     = useState<Sale[]>([]);

  // Estado compartido
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [sale, setSale]               = useState<Sale | null>(null);
  const [searched, setSearched]       = useState(false);

  // Devolución
  const [returnQtys, setReturnQtys]   = useState<Record<string, string>>({});
  const [motivo, setMotivo]           = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess]         = useState(false);

  const resetReturnState = () => {
    setSale(null); setError(''); setSearched(false);
    setReturnQtys({}); setMotivo(''); setSubmitError(''); setSuccess(false);
    setSalesList([]);
  };

  const loadSale = (s: Sale) => {
    setSale(s);
    const qtys: Record<string, string> = {};
    s.items.forEach((item) => { qtys[item.id] = ''; });
    setReturnQtys(qtys);
    setSubmitError(''); setSuccess(false);
  };

  // ── Búsqueda por número de comprobante ────────────────────────────────────
  const handleSearchDocumento = async () => {
    const q = [serie.trim(), correlativo.trim()].filter(Boolean).join('-');
    if (!q) { setError('Ingresa al menos la serie o el correlativo'); return; }
    setError(''); setLoading(true); setSale(null); setSearched(false);
    setReturnQtys({}); setMotivo(''); setSubmitError(''); setSuccess(false);
    try {
      const { data } = await api.get('/sales', { params: { search: q, limit: 5 } });
      const results: Sale[] = data.data ?? [];
      if (results.length === 0) {
        setError('No se encontró ninguna venta con ese comprobante');
      } else {
        const exact = results.find((s) =>
          s.electronicDocuments?.some((d) =>
            d.numeroCompleto.toLowerCase().includes(q.toLowerCase()),
          ),
        );
        loadSale(exact ?? results[0]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al buscar la venta');
    } finally {
      setLoading(false); setSearched(true);
    }
  };

  // ── Búsqueda sin documento (por fecha + cliente) ──────────────────────────
  const handleSearchSinDocumento = async () => {
    setError(''); setLoading(true); setSale(null); setSearched(false);
    setSalesList([]); setReturnQtys({}); setMotivo(''); setSubmitError(''); setSuccess(false);
    try {
      const params: Record<string, any> = { from: fromDate, to: toDate, limit: 20 };
      if (clientSearch.trim()) params.search = clientSearch.trim();
      const { data } = await api.get('/sales', { params });
      const results: Sale[] = data.data ?? [];
      if (results.length === 0) {
        setError('No se encontraron ventas en ese rango de fechas');
      } else {
        setSalesList(results);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al buscar ventas');
    } finally {
      setLoading(false); setSearched(true);
    }
  };

  const handleClear = () => {
    setSerie(''); setCorrelativo('');
    setFromDate(todayISO()); setToDate(todayISO()); setClientSearch('');
    resetReturnState();
  };

  const handleReturn = async () => {
    if (!sale) return;
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => qty && Number(qty) > 0)
      .map(([saleItemId, qty]) => ({ saleItemId, cantidad: Number(qty) }));

    if (items.length === 0) { setSubmitError('Selecciona al menos un ítem con cantidad a devolver'); return; }
    if (!motivo.trim()) { setSubmitError('Ingresa el motivo de la devolución'); return; }

    setSubmitError(''); setSubmitting(true);
    try {
      await api.post(`/sales/${sale.id}/return`, { items, motivo: motivo.trim() });
      setSuccess(true);
      setTimeout(handleClear, 2500);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message ?? 'Error al procesar la devolución');
    } finally {
      setSubmitting(false);
    }
  };

  const docNumber = sale?.electronicDocuments?.[0]?.numeroCompleto ?? null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <RotateCcw size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800">Devolución de productos vendidos</h1>
            <p className="text-xs text-slate-500 mt-0.5">Busca el comprobante y registra la cantidad exacta a devolver.</p>
          </div>
        </div>

        {/* Toggle de modo */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => { setMode('documento'); resetReturnState(); }}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
              mode === 'documento'
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Search size={12} />
            Con comprobante
          </button>
          <button
            onClick={() => { setMode('sin-documento'); resetReturnState(); }}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
              mode === 'sin-documento'
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileX size={12} />
            Sin documento
          </button>
        </div>
      </div>

      {/* ── Panel de búsqueda ── */}
      {mode === 'documento' ? (
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 bg-white min-w-[160px] flex-1">
              <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 flex-shrink-0">S</span>
              <input
                className="flex-1 text-sm outline-none placeholder:text-slate-400"
                placeholder="Serie"
                value={serie}
                onChange={(e) => setSerie(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchDocumento()}
              />
            </div>
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 bg-white min-w-[200px] flex-1">
              <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 flex-shrink-0 font-mono">#</span>
              <input
                className="flex-1 text-sm outline-none placeholder:text-slate-400"
                placeholder="Correlativo"
                value={correlativo}
                onChange={(e) => setCorrelativo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchDocumento()}
              />
            </div>
            <button
              onClick={handleSearchDocumento}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              <Search size={15} />
              BUSCAR VENTA
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium px-3 py-2.5"
            >
              <X size={14} />
              LIMPIAR
            </button>
          </div>
          {error && (
            <div className="flex items-center gap-2 mt-3 text-red-600 text-xs font-medium">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 space-y-3">
          <p className="text-xs text-slate-500 font-medium">
            Busca ventas por rango de fechas. Útil cuando la venta no tiene comprobante emitido.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Desde */}
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 bg-white flex-1 min-w-[160px]">
              <Calendar size={14} className="text-slate-400 flex-shrink-0" />
              <input
                type="date"
                className="flex-1 text-sm outline-none text-slate-700"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            {/* Hasta */}
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 bg-white flex-1 min-w-[160px]">
              <Calendar size={14} className="text-slate-400 flex-shrink-0" />
              <input
                type="date"
                className="flex-1 text-sm outline-none text-slate-700"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            {/* Cliente (opcional) */}
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 bg-white flex-1 min-w-[180px]">
              <User size={14} className="text-slate-400 flex-shrink-0" />
              <input
                className="flex-1 text-sm outline-none placeholder:text-slate-400"
                placeholder="Nombre cliente (opcional)"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSinDocumento()}
              />
            </div>
            <button
              onClick={handleSearchSinDocumento}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
            >
              <Search size={15} />
              BUSCAR
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium px-3 py-2.5"
            >
              <X size={14} />
              LIMPIAR
            </button>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs font-medium">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>
      )}

      {/* ── Lista de ventas (modo sin-documento) ── */}
      {mode === 'sin-documento' && salesList.length > 0 && !sale && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600">
              {salesList.length} venta{salesList.length !== 1 ? 's' : ''} encontrada{salesList.length !== 1 ? 's' : ''} — selecciona una
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {salesList.map((s) => {
              const doc = s.electronicDocuments?.[0]?.numeroCompleto;
              return (
                <button
                  key={s.id}
                  onClick={() => loadSale(s)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 text-left transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{fmtDate(s.fecha)}</span>
                      {doc ? (
                        <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{doc}</span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">sin comprobante</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        s.estado === 'activa' ? 'bg-emerald-100 text-emerald-700' :
                        s.estado === 'anulada' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {s.estado.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.customer
                        ? `${s.customer.nombreCompleto} · ${s.customer.numeroDocumento}`
                        : 'Sin cliente registrado'}
                      {' · '}{s.items.length} ítem{s.items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-sm font-bold text-slate-800">{fmtMoney(s.total)}</span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Estado vacío ── */}
      {!sale && !loading && salesList.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 flex flex-col items-center gap-3 text-slate-400">
          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
              <Search size={24} className="opacity-40" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
              <RotateCcw size={12} className="opacity-60" />
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-600">
            {searched ? 'No se encontraron ventas' : 'Busca una venta para iniciar'}
          </p>
          <p className="text-xs text-center max-w-xs">
            {searched
              ? mode === 'documento'
                ? 'Verifica el número de comprobante e intenta nuevamente.'
                : 'No hay ventas activas en ese rango de fechas. Prueba con otro rango.'
              : mode === 'documento'
                ? 'Usa la serie y correlativo del comprobante emitido.'
                : 'Selecciona un rango de fechas y presiona Buscar.'}
          </p>
        </div>
      )}

      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 flex items-center justify-center text-slate-400 text-sm">
          Buscando venta...
        </div>
      )}

      {/* ── Venta seleccionada (formulario de devolución) ── */}
      {sale && !loading && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

          {/* Info de la venta */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between flex-wrap gap-3">
            <div className="space-y-1">
              {docNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Comprobante</span>
                  <span className="text-sm font-semibold text-blue-700 font-mono">{docNumber}</span>
                </div>
              )}
              {!docNumber && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Venta</span>
                  <span className="text-xs text-slate-400 italic">sin comprobante electrónico</span>
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>Fecha: <span className="font-medium text-slate-700">{fmtDate(sale.fecha)}</span></span>
                <span>Total: <span className="font-semibold text-slate-800">{fmtMoney(sale.total)}</span></span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  sale.estado === 'activa' ? 'bg-emerald-100 text-emerald-700' :
                  sale.estado === 'anulada' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {sale.estado.toUpperCase()}
                </span>
              </div>
              {sale.customer && (
                <div className="text-xs text-slate-500">
                  Cliente: <span className="font-medium text-slate-700">{sale.customer.nombreCompleto}</span>
                  {' · '}<span className="font-mono">{sale.customer.numeroDocumento}</span>
                </div>
              )}
            </div>
            {/* Botón para cambiar selección en modo sin-documento */}
            {mode === 'sin-documento' && salesList.length > 1 && (
              <button
                onClick={() => setSale(null)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg"
              >
                <X size={12} />
                Cambiar selección
              </button>
            )}
          </div>

          {/* Ítems */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Producto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Cant. Vendida</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Precio U.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Cant. a Devolver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sale.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <span className="font-medium text-slate-800">
                        {item.product?.nombre ?? item.descripcion ?? 'Producto'}
                      </span>
                      {!item.product && (
                        <span className="ml-2 text-xs text-slate-400 italic">(ítem libre)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {Number(item.cantidad)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 text-xs">
                      {fmtMoney(item.precioUnitario)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 text-xs">
                      {fmtMoney(item.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <input
                          type="number"
                          min="0"
                          max={Number(item.cantidad)}
                          step="1"
                          placeholder="0"
                          value={returnQtys[item.id] ?? ''}
                          onChange={(e) => setReturnQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className={`w-20 text-center border rounded-lg px-2 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-300 ${
                            Number(returnQtys[item.id]) > 0
                              ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold'
                              : 'border-slate-300'
                          }`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Motivo + acción */}
          <div className="px-6 py-4 border-t border-slate-100 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                Motivo de la devolución *
              </label>
              <textarea
                rows={2}
                placeholder="Ej: Producto defectuoso, error en pedido, cambio de talla..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none"
              />
            </div>

            {submitError && (
              <div className="flex items-center gap-2 text-red-600 text-xs font-medium">
                <AlertCircle size={13} /> {submitError}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                <CheckCircle2 size={16} /> Devolución procesada correctamente. Redirigiendo...
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Solo se pueden devolver ítems de ventas activas.
              </span>
              <button
                onClick={handleReturn}
                disabled={submitting || success || sale.estado === 'anulada'}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold"
              >
                <RotateCcw size={14} />
                {submitting ? 'Procesando...' : 'Procesar Devolución'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
