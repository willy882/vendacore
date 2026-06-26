import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search, X } from 'lucide-react';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  nombreCompleto: string;
  numeroDocumento: string | null;
  tipoDocumento: string | null;
}

interface Product {
  id: string;
  nombre: string;
  codigoInterno: string | null;
  precioVenta: number;
}

interface LineItem {
  productId:      string | null;
  descripcion:    string;
  cantidad:       number;
  precioUnitario: number;
  igvMonto:       number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const lineTotal = (l: LineItem) =>
  l.cantidad * l.precioUnitario + l.igvMonto * l.cantidad;

const fmt2 = (v: number) =>
  `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Product Search Dropdown ───────────────────────────────────────────────────

function ProductSearch({ onSelect }: { onSelect: (p: Product) => void }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get<Product[]>('/products', { params: { search: q, limit: 10 } });
        setResults(r.data);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (p: Product) => {
    onSelect(p);
    setQ('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400 bg-white">
        <Search size={14} className="text-slate-400 flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto para agregar..."
          className="flex-1 text-sm text-slate-700 outline-none bg-transparent placeholder:text-slate-400"
        />
        {loading && <span className="text-xs text-slate-400">...</span>}
      </div>
      {open && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-52 overflow-y-auto">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
              >
                <div className="text-left">
                  <p className="font-medium text-slate-800">{p.nombre}</p>
                  {p.codigoInterno && <p className="text-xs text-slate-400">{p.codigoInterno}</p>}
                </div>
                <span className="text-slate-600 font-semibold ml-4">{fmt2(p.precioVenta)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Form Page ────────────────────────────────────────────────────────────

export default function ProformaFormPage() {
  const { id }   = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit   = !!id;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [fecha, setFecha]           = useState(new Date().toISOString().split('T')[0]);
  const [observaciones, setObs]     = useState('');
  const [lines, setLines]           = useState<LineItem[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Load customers
  useEffect(() => {
    api.get<Customer[]>('/customers').then((r) => setCustomers(r.data));
  }, []);

  // Load existing proforma if editing
  useEffect(() => {
    if (!isEdit) return;
    api.get<any>(`/proformas/${id}`).then((r) => {
      const p = r.data;
      setCustomerId(p.customerId ?? '');
      setFecha(p.fecha.split('T')[0]);
      setObs(p.observaciones ?? '');
      setLines(
        p.items.map((i: any) => ({
          productId:      i.productId ?? null,
          descripcion:    i.descripcion ?? i.product?.nombre ?? '',
          cantidad:       Number(i.cantidad),
          precioUnitario: Number(i.precioUnitario),
          igvMonto:       Number(i.igvMonto),
        })),
      );
    });
  }, [id, isEdit]);

  const addProductLine = useCallback((p: Product) => {
    setLines((prev) => [
      ...prev,
      { productId: p.id, descripcion: p.nombre, cantidad: 1, precioUnitario: p.precioVenta, igvMonto: 0 },
    ]);
  }, []);

  const addFreeLine = () => {
    setLines((prev) => [
      ...prev,
      { productId: null, descripcion: '', cantidad: 1, precioUnitario: 0, igvMonto: 0 },
    ]);
  };

  const updateLine = (i: number, field: keyof LineItem, value: string | number | null) => {
    setLines((prev) => {
      const next = [...prev];
      (next[i] as any)[field] = value;
      return next;
    });
  };

  const removeLine = (i: number) => setLines((prev) => prev.filter((_, j) => j !== i));

  const subtotal = lines.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0);
  const igvTotal = lines.reduce((s, l) => s + l.igvMonto * l.cantidad, 0);
  const total    = subtotal + igvTotal;

  const handleSave = async () => {
    if (lines.length === 0) { setError('Agrega al menos un ítem'); return; }
    for (const l of lines) {
      if (!l.descripcion.trim()) { setError('Todos los ítems necesitan descripción'); return; }
      if (l.cantidad <= 0)       { setError('La cantidad debe ser mayor a 0'); return; }
    }
    setError('');
    setSaving(true);
    try {
      const body = {
        customerId:   customerId || undefined,
        fecha,
        observaciones: observaciones || undefined,
        items: lines.map((l) => ({
          productId:      l.productId ?? undefined,
          descripcion:    l.descripcion,
          cantidad:       l.cantidad,
          precioUnitario: l.precioUnitario,
          igvMonto:       l.igvMonto,
        })),
      };
      if (isEdit) {
        await api.patch(`/proformas/${id}`, body);
      } else {
        await api.post('/proformas', body);
      }
      navigate('/proformas');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/proformas')}
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">
              {isEdit ? 'EDITAR PROFORMA' : 'NUEVA PROFORMA'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit ? `Modificando proforma ID: ${id}` : 'Complete los datos y agregue los ítems'}
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

          {/* Section: Datos generales */}
          <div className="px-6 py-5 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Datos generales</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Cliente (opcional)</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  <option value="">— Sin cliente —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numeroDocumento ? `${c.numeroDocumento} - ` : ''}{c.nombreCompleto}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Fecha</label>
                <input
                  type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Observaciones (opcional)</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObs(e.target.value)}
                  rows={2}
                  placeholder="Notas o condiciones del presupuesto..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Items */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ítems</p>
              <button
                onClick={addFreeLine}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Plus size={13} />
                Ítem libre
              </button>
            </div>

            {/* Product search */}
            <div className="mb-4">
              <ProductSearch onSelect={addProductLine} />
            </div>

            {lines.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl py-10 text-center">
                <p className="text-sm text-slate-400">Busca un producto o agrega un ítem libre</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider pr-3">Descripción</th>
                      <th className="text-right pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider w-20">Cant.</th>
                      <th className="text-right pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider w-28">P. Unit.</th>
                      <th className="text-right pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider w-20">IGV</th>
                      <th className="text-right pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider w-28">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {lines.map((l, i) => (
                      <tr key={i} className="group">
                        <td className="py-2 pr-3">
                          <input
                            value={l.descripcion}
                            onChange={(e) => updateLine(i, 'descripcion', e.target.value)}
                            placeholder="Descripción del ítem"
                            className="w-full px-2 py-1.5 text-sm border border-transparent rounded-lg focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-slate-50 focus:bg-white transition-colors"
                          />
                        </td>
                        <td className="py-2 pl-2">
                          <input
                            type="number" min="0.01" step="0.01"
                            value={l.cantidad}
                            onChange={(e) => updateLine(i, 'cantidad', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-sm text-right border border-transparent rounded-lg focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-slate-50 focus:bg-white transition-colors"
                          />
                        </td>
                        <td className="py-2 pl-2">
                          <input
                            type="number" min="0" step="0.01"
                            value={l.precioUnitario}
                            onChange={(e) => updateLine(i, 'precioUnitario', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-sm text-right border border-transparent rounded-lg focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-slate-50 focus:bg-white transition-colors"
                          />
                        </td>
                        <td className="py-2 pl-2">
                          <input
                            type="number" min="0" step="0.01"
                            value={l.igvMonto}
                            onChange={(e) => updateLine(i, 'igvMonto', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-sm text-right border border-transparent rounded-lg focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-slate-50 focus:bg-white transition-colors"
                          />
                        </td>
                        <td className="py-2 pl-2 text-right font-semibold text-slate-800 tabular-nums">
                          {fmt2(lineTotal(l))}
                        </td>
                        <td className="py-2 pl-2">
                          <button
                            onClick={() => removeLine(i)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals + Actions */}
          <div className="px-6 py-5 bg-slate-50 border-t border-slate-100">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">

              {/* Totals */}
              <div className="space-y-1">
                <div className="flex justify-between gap-12 text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold text-slate-700 tabular-nums">{fmt2(subtotal)}</span>
                </div>
                <div className="flex justify-between gap-12 text-sm">
                  <span className="text-slate-500">IGV</span>
                  <span className="font-semibold text-slate-700 tabular-nums">{fmt2(igvTotal)}</span>
                </div>
                <div className="flex justify-between gap-12 text-base border-t border-slate-200 pt-1 mt-1">
                  <span className="font-bold text-slate-800">TOTAL</span>
                  <span className="font-black text-emerald-600 tabular-nums">{fmt2(total)}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2">
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Trash2 size={13} className="flex-shrink-0" />
                    {error}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/proformas')}
                    className="px-5 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-white transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || lines.length === 0}
                    className="px-6 py-2.5 text-sm font-bold text-white rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 active:scale-95 transition-all shadow-sm"
                  >
                    {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear Proforma'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
