import { useState, useEffect } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Trash2,
  CheckCircle, Clock, Info,
} from 'lucide-react';
import api from '@/lib/api';

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtMoney = (v: number | string) =>
  `S/.${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

interface DocAnulado {
  id: string;
  tipo: string;
  numeroCompleto: string;
  estado: string;
  fechaEmision: string;
  total: number | string;
  errorDescripcion?: string;
  respuestaSunat?: string;
  customer?: { nombreCompleto: string } | null;
}

// Agrupa documentos anulados por fecha de emisión
function groupByDate(docs: DocAnulado[]): Map<string, DocAnulado[]> {
  const map = new Map<string, DocAnulado[]>();
  docs.forEach((d) => {
    const key = fmtDate(d.fechaEmision);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  });
  return map;
}

export default function SunatResumenBajasPage() {
  const [desde, setDesde]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [hasta, setHasta]   = useState(todayStr());
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const limit = 50;

  const [docs, setDocs]         = useState<DocAnulado[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const fetchDocs = async (p = page) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page: p, limit };
      if (desde) params.from = desde;
      if (hasta) params.to   = hasta;
      if (search) params.search = search;
      const { data } = await api.get('/documents', { params });
      const all: DocAnulado[] = data.data ?? data ?? [];
      // Solo documentos anulados (boletas y facturas)
      const anulados = all.filter(
        (d) => d.estado === 'anulado' && (d.tipo === 'boleta' || d.tipo === 'factura'),
      );
      setDocs(anulados);
      setTotalPages(Math.ceil(anulados.length / limit) || 1);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al cargar documentos anulados');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(1); setPage(1); }, [desde, hasta, search]);
  useEffect(() => { fetchDocs(page); }, [page]);

  const grouped = groupByDate(docs);
  const dates   = Array.from(grouped.keys());
  const totalAnulado = docs.reduce((a, d) => a + Number(d.total), 0);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Trash2 size={17} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800">Resumen de Bajas</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Boletas y facturas anuladas que deben reportarse a SUNAT. SUNAT no permite anular boletas individualmente
            — se agrupan por fecha en un "Resumen de Bajas" y se envían al día siguiente de la emisión.
          </p>
        </div>
      </div>

      {/* Info SUNAT */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-start gap-3">
        <Info size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          <span className="font-semibold">¿Qué es el Resumen de Bajas?</span> Cuando anulas una boleta de venta,
          debes informar a SUNAT al día siguiente mediante un "Resumen de Bajas" (código RC). Las facturas se anulan
          directamente con Nota de Crédito. Aquí se muestran las boletas/facturas anuladas agrupadas por fecha de emisión.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white text-slate-700" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white text-slate-700" />
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Buscar</span>
          <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-white">
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <input className="flex-1 text-sm outline-none placeholder:text-slate-400"
              placeholder="Número de comprobante..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-sm font-semibold text-slate-500">Total anulado:</span>
          <span className="text-sm font-bold text-amber-700">{fmtMoney(totalAnulado)}</span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <span className="text-xs text-slate-500">
          {docs.length} comprobante{docs.length !== 1 ? 's' : ''} anulado{docs.length !== 1 ? 's' : ''} en {dates.length} fecha{dates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl flex items-center justify-center py-20 text-slate-400 text-sm">
          Cargando...
        </div>
      ) : error ? (
        <div className="bg-white border border-slate-200 rounded-2xl flex items-center justify-center py-20 text-red-500 text-sm">{error}</div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <CheckCircle size={26} className="text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">Sin documentos anulados en este período</p>
          <p className="text-xs">No hay bajas pendientes de reportar a SUNAT.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dates.map((date) => {
            const items = grouped.get(date)!;
            const isOpen = expandedDates.has(date);
            const subtotal = items.reduce((a, d) => a + Number(d.total), 0);
            const boletas  = items.filter((d) => d.tipo === 'boleta').length;
            const facturas = items.filter((d) => d.tipo === 'factura').length;

            return (
              <div key={date} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {/* Cabecera de fecha (acordeón) */}
                <button
                  onClick={() => toggleDate(date)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-sm font-bold text-slate-800">{date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {boletas > 0 && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                          {boletas} boleta{boletas !== 1 ? 's' : ''}
                        </span>
                      )}
                      {facturas > 0 && (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                          {facturas} factura{facturas !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-amber-700">{fmtMoney(subtotal)}</span>
                    <div className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <ChevronLeft size={16} className="rotate-[-90deg]" />
                    </div>
                  </div>
                </button>

                {/* Detalle de documentos */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-amber-50/50">
                          <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500">Comprobante</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Tipo</th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Cliente</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Monto</th>
                          <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500">Estado Baja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {items.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/30">
                            <td className="px-5 py-2.5">
                              <span className="font-mono text-xs font-semibold text-slate-800">{doc.numeroCompleto}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                doc.tipo === 'boleta' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {doc.tipo === 'boleta' ? 'Boleta' : 'Factura'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-600">
                              {doc.customer?.nombreCompleto ?? 'Clientes Varios'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs font-mono font-semibold text-red-600">
                              -{fmtMoney(doc.total)}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-center">
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                  <Clock size={10} /> Pendiente RC
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={14} /></button>
              <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
