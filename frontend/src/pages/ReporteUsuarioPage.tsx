import { useState, useEffect } from 'react';
import {
  UserRoundSearch, RefreshCw, FileSpreadsheet,
  ChevronDown, Search, CheckCircle2, Info,
  ShoppingCart, FileText, TrendingUp,
} from 'lucide-react';
import api from '@/lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

const firstOfMonth = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
};
const todayStr = () => new Date().toISOString().split('T')[0];

const fmtS = (v: number) =>
  `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtFecha = (d: string | Date) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

// ── tipos ─────────────────────────────────────────────────────────────────────

interface SaleRow {
  id: string;
  fecha: string;
  estado: string;
  total: number;
  comprobante: string | null;
  tipoDoc: string | null;
  cliente: string;
  responsable: string;
  responsableId: string;
}

interface Totales { total: number; comprobantes: number; promedio: number }
interface Usuario { id: string; nombre: string; apellido: string }

// ── badges ────────────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<string, string> = {
  activa:         'bg-emerald-100 text-emerald-700',
  anulada:        'bg-red-100 text-red-600',
  pendiente_pago: 'bg-amber-100 text-amber-700',
};
const ESTADO_LABEL: Record<string, string> = {
  activa:         'Activa',
  anulada:        'Anulada',
  pendiente_pago: 'Pendiente',
};

const DOC_BADGE: Record<string, { label: string; color: string }> = {
  boleta:       { label: 'B', color: 'bg-blue-600 text-white' },
  factura:      { label: 'F', color: 'bg-emerald-600 text-white' },
  nota_credito: { label: 'NC', color: 'bg-purple-600 text-white' },
};

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${color}`}>
      {icon}
      <span>{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

// ── UsuarioSelect ─────────────────────────────────────────────────────────────

function UsuarioSelect({
  usuarios, value, onChange,
}: { usuarios: Usuario[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = usuarios.find((u) => u.id === value);
  const label = value === 'todos' ? 'TODOS' : selected ? `${selected.nombre} ${selected.apellido}` : 'TODOS';

  return (
    <div className="relative flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Usuario</span>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-white text-sm text-slate-700 min-w-[180px] hover:border-blue-300 transition-colors"
      >
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[200px] py-1 overflow-hidden">
          <button
            className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${value === 'todos' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
            onClick={() => { onChange('todos'); setOpen(false); }}
          >
            TODOS
          </button>
          {usuarios.map((u) => (
            <button key={u.id}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${value === u.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
              onClick={() => { onChange(u.id); setOpen(false); }}
            >
              {u.nombre} {u.apellido}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ReporteUsuarioPage ────────────────────────────────────────────────────────

export default function ReporteUsuarioPage() {
  const [desde, setDesde]       = useState(firstOfMonth());
  const [hasta, setHasta]       = useState(todayStr());
  const [userId, setUserId]     = useState('todos');
  const [search, setSearch]     = useState('');

  const [rows, setRows]         = useState<SaleRow[]>([]);
  const [totales, setTotales]   = useState<Totales | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [generated, setGenerated] = useState(false);

  // Carga usuarios al montar (para tener el dropdown listo antes de generar)
  useEffect(() => {
    api.get('/reports/ventas-por-usuario', {
      params: { from: firstOfMonth(), to: todayStr() },
    }).then((r) => {
      setUsuarios(r.data.usuarios ?? []);
    }).catch(() => {});
  }, []);

  const handleGenerar = async () => {
    setLoading(true); setError(''); setGenerated(false);
    try {
      const params: Record<string, string> = { from: desde, to: hasta };
      if (userId !== 'todos') params.userId = userId;
      const { data } = await api.get('/reports/ventas-por-usuario', { params });
      setRows(data.data ?? []);
      setTotales(data.totales);
      setUsuarios(data.usuarios ?? []);
      setGenerated(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al generar el reporte');
    } finally { setLoading(false); }
  };

  // Filtro local por cliente o comprobante
  const visible = search
    ? rows.filter((r) =>
        r.cliente.toLowerCase().includes(search.toLowerCase()) ||
        (r.comprobante ?? '').toLowerCase().includes(search.toLowerCase()) ||
        r.responsable.toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  const exportExcel = () => {
    if (!rows.length) return;
    const headers = ['#', 'Comprobante', 'Tipo', 'Cliente', 'Fecha', 'Responsable', 'Estado', 'Total'];
    const csvRows = [
      headers.join(','),
      ...rows.map((r, i) => [
        i + 1,
        r.comprobante ?? 'Ticket',
        r.tipoDoc ?? '—',
        `"${r.cliente.replace(/"/g, '""')}"`,
        fmtFecha(r.fecha),
        `"${r.responsable}"`,
        ESTADO_LABEL[r.estado] ?? r.estado,
        r.total.toFixed(2),
      ].join(',')),
    ];
    if (totales) {
      csvRows.push(`,,,,,,TOTAL,${totales.total.toFixed(2)}`);
      csvRows.push(`,,,,,,PROMEDIO,${totales.promedio.toFixed(2)}`);
    }
    const csv = '﻿' + csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ventas_usuario_${desde}_${hasta}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <UserRoundSearch size={20} className="text-indigo-700" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Ventas por usuario</h1>
            <p className="text-xs text-slate-500">Reporte filtrado por fecha y usuario responsable de la venta.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerar} disabled={loading}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            GENERAR
          </button>
          <button onClick={exportExcel} disabled={!generated}
            className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors">
            <FileSpreadsheet size={14} className={generated ? 'text-emerald-600' : ''} />
            EXCEL
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Inicio</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white text-slate-700" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Fin</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white text-slate-700" />
          </div>
          <UsuarioSelect usuarios={usuarios} value={userId} onChange={setUserId} />
        </div>
      </div>

      {/* Stats pills */}
      {totales && (
        <div className="flex items-center gap-2 flex-wrap">
          <StatPill icon={<ShoppingCart size={12} />} label="Total"
            value={fmtS(totales.total)}
            color="border-blue-200 bg-blue-50 text-blue-700" />
          <StatPill icon={<FileText size={12} />} label="Comprobantes"
            value={String(totales.comprobantes)}
            color="border-indigo-200 bg-indigo-50 text-indigo-700" />
          <StatPill icon={<TrendingUp size={12} />} label="Promedio"
            value={fmtS(totales.promedio)}
            color="border-emerald-200 bg-emerald-50 text-emerald-700" />
        </div>
      )}

      {/* Banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-5 py-3 text-sm text-red-700">
          <Info size={15} className="flex-shrink-0" /> {error}
        </div>
      )}
      {generated && rows.length === 0 && !error && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 text-sm text-blue-700">
          <Info size={15} className="flex-shrink-0" />
          Sin ventas en el rango seleccionado para ese usuario.
        </div>
      )}
      {generated && rows.length > 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-sm text-emerald-700 font-medium">
          <CheckCircle2 size={16} className="flex-shrink-0" />
          {rows.length} venta{rows.length !== 1 ? 's' : ''} encontrada{rows.length !== 1 ? 's' : ''}.
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

        {/* Buscador local */}
        {generated && rows.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Search size={13} className="text-slate-400" />
            <input className="flex-1 text-sm outline-none placeholder:text-slate-400"
              placeholder="Filtrar por cliente, comprobante o responsable..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && (
              <span className="text-xs text-slate-400">{visible.length} de {rows.length}</span>
            )}
          </div>
        )}

        {!generated && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <UserRoundSearch size={26} className="text-indigo-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">Selecciona el rango, el usuario y pulsa GENERAR</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
            <RefreshCw size={16} className="animate-spin" /> Generando reporte...
          </div>
        ) : rows.length === 0 ? null : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Comprobante</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Responsable</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Estado</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visible.map((row) => {
                  const docCfg = row.tipoDoc ? DOC_BADGE[row.tipoDoc] : null;
                  const estadoBadge = ESTADO_BADGE[row.estado] ?? 'bg-slate-100 text-slate-600';
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {docCfg ? (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${docCfg.color}`}>
                              {docCfg.label}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">T</span>
                          )}
                          <span className="font-mono text-xs font-semibold text-slate-800">
                            {row.comprobante ?? 'Ticket'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-800">{row.cliente}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {fmtFecha(row.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-indigo-700">
                              {row.responsable.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-slate-700 font-medium">{row.responsable}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ${estadoBadge}`}>
                          {ESTADO_LABEL[row.estado] ?? row.estado}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800 text-xs whitespace-nowrap">
                        {fmtS(row.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totales */}
              {totales && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-5 py-3 text-xs font-bold text-slate-700" colSpan={4}>
                      {totales.comprobantes} venta{totales.comprobantes !== 1 ? 's' : ''} &nbsp;·&nbsp;
                      Promedio {fmtS(totales.promedio)}
                    </td>
                    <td />
                    <td className="px-5 py-3 text-right font-bold text-blue-700 text-sm whitespace-nowrap">
                      {fmtS(totales.total)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
