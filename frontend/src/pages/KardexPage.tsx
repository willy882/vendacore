import { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, Plus, ArrowDownUp, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api from '@/lib/api';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | Date) => {
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const mon = String(dt.getMonth() + 1).padStart(2, '0');
  const yr  = dt.getFullYear();
  return `${day}/${mon}/${yr}`;
};

const fmtMoney = (v: number) =>
  `S/.${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type MovTipo =
  | 'entrada_compra'
  | 'salida_venta'
  | 'ajuste_entrada'
  | 'ajuste_salida'
  | 'devolucion';

const MODO_LABEL: Record<MovTipo, string> = {
  entrada_compra: 'COMPRA',
  salida_venta:   'VENTA',
  ajuste_entrada: 'ENTRADA',
  ajuste_salida:  'SALIDA',
  devolucion:     'DEVOLUCIÓN',
};

const MODO_COLOR: Record<MovTipo, string> = {
  entrada_compra: 'bg-emerald-100 text-emerald-700',
  salida_venta:   'bg-red-100 text-red-700',
  ajuste_entrada: 'bg-blue-100 text-blue-700',
  ajuste_salida:  'bg-orange-100 text-orange-700',
  devolucion:     'bg-purple-100 text-purple-700',
};

interface Movement {
  id: string;
  tipo: MovTipo;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  costoUnitario: number | null;
  observaciones: string | null;
  referenciaId: string | null;
  referenciaTipo: string | null;
  fecha: string;
  product: { id: string; nombre: string; codigoInterno: string | null };
  user:    { id: string; nombre: string; apellido: string };
}

interface PageData {
  data: Movement[];
  total: number;
  page: number;
  totalPages: number;
}

// ── ProductSearch component ───────────────────────────────────────────────────

function ProductSearch({
  value,
  onChange,
}: {
  value: { id: string; nombre: string } | null;
  onChange: (p: { id: string; nombre: string } | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/products', { params: { search: q, limit: 8 } });
        setResults(data.data ?? data ?? []);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between border border-slate-300 rounded-lg px-3 py-2 bg-white">
        <span className="text-sm text-slate-800 font-medium">{value.nombre}</span>
        <button onClick={() => onChange(null)} className="text-slate-400 hover:text-red-500 ml-2">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center border border-slate-300 rounded-lg px-3 py-2 bg-white gap-2">
        <Search size={14} className="text-slate-400 flex-shrink-0" />
        <input
          className="flex-1 text-sm outline-none placeholder:text-slate-400"
          placeholder="Buscar producto..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
              onMouseDown={() => { onChange({ id: p.id, nombre: p.nombre }); setQ(''); setOpen(false); }}
            >
              <span className="font-medium text-slate-800">{p.nombre}</span>
              {p.codigoInterno && (
                <span className="text-xs text-slate-400 font-mono">{p.codigoInterno}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal Registro Compra ────────────────────────────────────────────────────

function RegistroCompraModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [producto, setProducto] = useState<{ id: string; nombre: string } | null>(null);
  const [proveedor, setProveedor] = useState('');
  const [documento, setDocumento] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [costo, setCosto] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const reset = () => {
    setProducto(null); setProveedor(''); setDocumento('');
    setCantidad(''); setCosto(''); setObs(''); setErr('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!producto) { setErr('Selecciona un producto'); return; }
    if (!cantidad || Number(cantidad) <= 0) { setErr('Ingresa una cantidad válida'); return; }
    setErr(''); setLoading(true);
    try {
      await api.post('/inventory/adjustments', {
        productId:     producto.id,
        tipo:          'entrada_compra',
        cantidad:      Number(cantidad),
        costoUnitario: costo ? Number(costo) : undefined,
        observaciones: [proveedor && `Proveedor: ${proveedor}`, documento && `Doc: ${documento}`, obs]
          .filter(Boolean).join(' | ') || undefined,
      });
      reset(); onSuccess();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Registro de Compra</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Producto *</label>
            <ProductSearch value={producto} onChange={setProducto} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Razón Social / Proveedor</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="Nombre del proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">N° Documento</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="Ej: F001-001" value={documento} onChange={(e) => setDocumento(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Cantidad *</label>
              <input type="number" min="1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Costo Unitario (S/.)</label>
              <input type="number" min="0" step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="0.00" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Observaciones</label>
            <textarea rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
              placeholder="Notas adicionales..." value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>

        {err && <p className="text-xs text-red-500 font-medium">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={handleClose} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
            {loading ? 'Registrando...' : 'Registrar Compra'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Entradas / Salidas ──────────────────────────────────────────────────

function EntradasSalidasModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [tipoAjuste, setTipoAjuste] = useState<'ajuste_entrada' | 'ajuste_salida'>('ajuste_entrada');
  const [producto, setProducto] = useState<{ id: string; nombre: string } | null>(null);
  const [cantidad, setCantidad] = useState('');
  const [costo, setCosto] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const reset = () => { setProducto(null); setCantidad(''); setCosto(''); setObs(''); setErr(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!producto) { setErr('Selecciona un producto'); return; }
    if (!cantidad || Number(cantidad) <= 0) { setErr('Ingresa una cantidad válida'); return; }
    setErr(''); setLoading(true);
    try {
      await api.post('/inventory/adjustments', {
        productId:     producto.id,
        tipo:          tipoAjuste,
        cantidad:      Number(cantidad),
        costoUnitario: costo ? Number(costo) : undefined,
        observaciones: obs || undefined,
      });
      reset(); onSuccess();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Entradas / Salidas</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo de movimiento *</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTipoAjuste('ajuste_entrada')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  tipoAjuste === 'ajuste_entrada'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Entrada
              </button>
              <button
                onClick={() => setTipoAjuste('ajuste_salida')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  tipoAjuste === 'ajuste_salida'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Salida
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Producto *</label>
            <ProductSearch value={producto} onChange={setProducto} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Cantidad *</label>
              <input type="number" min="1" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Costo Unitario (S/.)</label>
              <input type="number" min="0" step="0.01" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="0.00" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Observaciones</label>
            <textarea rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
              placeholder="Motivo del ajuste..." value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>

        {err && <p className="text-xs text-red-500 font-medium">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={handleClose} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className={`flex-1 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 ${
              tipoAjuste === 'ajuste_entrada' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
            }`}>
            {loading ? 'Registrando...' : tipoAjuste === 'ajuste_entrada' ? 'Registrar Entrada' : 'Registrar Salida'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KardexPage ────────────────────────────────────────────────────────────────

export default function KardexPage() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage]   = useState(1);
  const limit = 20;

  const [data, setData]       = useState<PageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [modalCompra, setModalCompra]       = useState(false);
  const [modalAjuste, setModalAjuste]       = useState(false);

  const fetchData = async (p = page) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page: p, limit };
      if (desde) params.from = desde;
      if (hasta) params.to   = hasta;
      if (search) params.search = search;
      const { data: res } = await api.get('/inventory/kardex', { params });
      setData(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al cargar Kardex');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1); setPage(1); }, [desde, hasta, search]);
  useEffect(() => { fetchData(page); }, [page]);

  const handleSuccess = () => { setModalCompra(false); setModalAjuste(false); fetchData(1); setPage(1); };

  const exportExcel = () => {
    if (!data?.data?.length) return;
    const rows = [
      ['Producto', 'Cód.', 'Documento', 'Observación', 'Ref', 'Fecha Emisión', 'Fecha Ing.', 'MODO', 'Cant.', 'Costo U.', 'Total', 'Stock Ant.', 'Stock Nuevo', 'Usuario'],
      ...data.data.map((m) => [
        m.product.nombre,
        m.product.codigoInterno ?? '',
        m.referenciaTipo ?? '',
        m.observaciones ?? '',
        m.referenciaId ? m.referenciaId.slice(0, 8) : '',
        fmtDate(m.fecha),
        fmtDate(m.fecha),
        MODO_LABEL[m.tipo] ?? m.tipo,
        m.cantidad,
        m.costoUnitario ?? 0,
        Number(m.costoUnitario ?? 0) * m.cantidad,
        m.stockAnterior,
        m.stockNuevo,
        `${m.user.nombre} ${m.user.apellido}`,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kardex_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const movements = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Movimientos de Kardex</h1>
          <p className="text-xs text-slate-500 mt-0.5">Control de entradas, salidas y ajustes de inventario</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setModalCompra(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
          >
            <Plus size={15} />
            Registro Compra
          </button>
          <button
            onClick={() => setModalAjuste(true)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
          >
            <ArrowDownUp size={15} />
            Entradas/Salidas
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-xl text-sm font-medium"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            Excel
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 bg-white">
          <Search size={13} className="text-slate-400" />
          <input
            className="text-sm outline-none placeholder:text-slate-400 w-44"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">INICIO</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">FIN</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white" />
        </div>
        {(desde || hasta || search) && (
          <button onClick={() => { setDesde(''); setHasta(''); setSearch(''); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 border border-slate-200 rounded-lg px-2 py-2">
            <X size={12} /> Limpiar
          </button>
        )}
        {total > 0 && (
          <span className="ml-auto text-xs text-slate-500 font-medium">{total} movimiento{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 text-sm">{error}</div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <ArrowDownUp size={36} className="opacity-30" />
            <p className="text-sm font-medium">Sin movimientos registrados</p>
            <p className="text-xs">Registra una compra o ajuste para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Producto', 'Documento', 'Observación', 'Ref', 'Fecha Emisión', 'Fecha Ing. Prod', 'MODO', 'Cant.', 'Total', 'Stock'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => {
                  const total = Number(m.costoUnitario ?? 0) * m.cantidad;
                  const modoLabel = MODO_LABEL[m.tipo] ?? m.tipo;
                  const modoColor = MODO_COLOR[m.tipo] ?? 'bg-slate-100 text-slate-600';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 leading-tight">{m.product.nombre}</div>
                        {m.product.codigoInterno && (
                          <div className="text-xs text-slate-400 font-mono">{m.product.codigoInterno}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {m.referenciaTipo ?? '—'}
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <span className="text-xs text-slate-600 line-clamp-2">{m.observaciones ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                        {m.referenciaId ? m.referenciaId.slice(0, 8) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(m.fecha)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(m.fecha)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap ${modoColor}`}>
                          {modoLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-700 whitespace-nowrap text-center">
                        {m.cantidad}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {total > 0 ? fmtMoney(total) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        <span className="font-mono">{m.stockAnterior}</span>
                        <span className="text-slate-300 mx-1">→</span>
                        <span className={`font-mono font-semibold ${m.stockNuevo > m.stockAnterior ? 'text-emerald-600' : 'text-red-600'}`}>
                          {m.stockNuevo}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <RegistroCompraModal open={modalCompra} onClose={() => setModalCompra(false)} onSuccess={handleSuccess} />
      <EntradasSalidasModal open={modalAjuste} onClose={() => setModalAjuste(false)} onSuccess={handleSuccess} />
    </div>
  );
}
