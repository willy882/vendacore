import { useState } from 'react';
import {
  RefreshCw, FileSpreadsheet, FileText, Search,
  TrendingUp, Package, Hash, ShoppingCart, Info, CheckCircle2,
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

// ── types ─────────────────────────────────────────────────────────────────────

interface ProductRow {
  productId: string | null;
  nombre: string;
  codigoInterno: string | null;
  unidadMedida: string | null;
  costoUnitario: number;
  cantidad: number;
  totalVenta: number;
  precioPromedio: number;
  utilidad: number;
}

interface Totales {
  totalVenta: number;
  utilidad: number;
  productos: number;
  unidades: number;
}

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${color}`}>
      {icon}
      <span>{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

// ── ReporteProductosPage ──────────────────────────────────────────────────────

export default function ReporteProductosPage() {
  const [desde, setDesde]     = useState(firstOfMonth());
  const [hasta, setHasta]     = useState(todayStr());
  const [search, setSearch]   = useState('');
  const [useCostoCatalogo, setUseCostoCatalogo] = useState(true);

  const [rows, setRows]       = useState<ProductRow[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [generated, setGenerated] = useState(false);

  const handleGenerar = async () => {
    setLoading(true); setError(''); setGenerated(false);
    try {
      const params: Record<string, any> = {};
      if (desde) params.from = desde;
      if (hasta) params.to   = hasta;
      if (search) params.search = search;
      const { data } = await api.get('/reports/productos-vendidos', { params });
      const rawRows: ProductRow[] = data.data ?? [];
      // Si el toggle "Costo catálogo" está OFF, asumimos costo 0 para utilidad
      const adjusted = useCostoCatalogo
        ? rawRows
        : rawRows.map((r) => ({ ...r, costoUnitario: 0, utilidad: r.totalVenta }));
      setRows(adjusted);
      const tot = data.totales as Totales;
      setTotales(
        useCostoCatalogo
          ? tot
          : { ...tot, utilidad: tot.totalVenta },
      );
      setGenerated(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al generar el reporte');
    } finally { setLoading(false); }
  };

  const exportExcel = () => {
    if (!rows.length) return;
    const headers = ['#', 'Código', 'Producto', 'Medida', 'Cantidad', 'Costo', 'P. Promedio', 'Total Venta', 'Utilidad'];
    const csvRows = [
      headers.join(','),
      ...rows.map((r, i) => [
        i + 1,
        r.codigoInterno ?? '',
        `"${r.nombre.replace(/"/g, '""')}"`,
        r.unidadMedida ?? 'UNIDAD',
        r.cantidad,
        r.costoUnitario.toFixed(2),
        r.precioPromedio.toFixed(2),
        r.totalVenta.toFixed(2),
        r.utilidad.toFixed(2),
      ].join(',')),
    ];
    const csv = '﻿' + csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `productos_vendidos_${desde}_${hasta}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    if (!rows.length) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    const rowsHtml = rows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="text-align:center;padding:6px 8px">
          <span style="background:#1e3a5f;color:#fff;border-radius:50%;padding:2px 7px;font-size:11px;font-weight:bold">${r.cantidad}</span>
        </td>
        <td style="padding:6px 8px">
          <div style="font-weight:600;font-size:12px">${r.nombre}</div>
          ${r.codigoInterno ? `<div style="color:#94a3b8;font-size:10px">Cod. ${r.codigoInterno}</div>` : ''}
        </td>
        <td style="padding:6px 8px;text-align:center;font-size:11px">${r.unidadMedida ?? 'UNIDAD'}</td>
        <td style="padding:6px 8px;text-align:right;font-size:11px">${useCostoCatalogo ? `S/ ${r.costoUnitario.toFixed(2)}` : '—'}</td>
        <td style="padding:6px 8px;text-align:right;font-size:11px">S/ ${r.precioPromedio.toFixed(2)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;font-size:12px">S/ ${r.totalVenta.toFixed(2)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;color:${r.utilidad >= 0 ? '#16a34a' : '#dc2626'};font-size:12px">
          S/ ${r.utilidad.toFixed(2)}
        </td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>Productos Vendidos</title>
      <style>
        @page{size:A4 landscape;margin:15mm}
        body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;margin:0}
        table{width:100%;border-collapse:collapse}
        th{background:#1e3a5f;color:#fff;padding:8px;font-size:11px;text-align:center}
        td{border-bottom:1px solid #e2e8f0}
        .pill{display:inline-block;border:1px solid;border-radius:999px;padding:3px 10px;font-size:11px;margin-right:8px}
      </style></head><body>
      <h2 style="color:#1e3a5f;margin-bottom:4px">Productos Vendidos</h2>
      <p style="color:#64748b;font-size:11px;margin-bottom:10px">
        ${desde} al ${hasta} &nbsp;·&nbsp; ${rows.length} productos &nbsp;·&nbsp; ${totales?.unidades ?? 0} unidades
      </p>
      <div style="margin-bottom:12px">
        <span class="pill" style="color:#2563eb;border-color:#93c5fd">Venta: S/ ${totales?.totalVenta.toFixed(2) ?? '0.00'}</span>
        <span class="pill" style="color:#16a34a;border-color:#86efac">Utilidad: S/ ${totales?.utilidad.toFixed(2) ?? '0.00'}</span>
        <span class="pill" style="color:#7c3aed;border-color:#c4b5fd">Productos: ${totales?.productos ?? 0}</span>
        <span class="pill" style="color:#0891b2;border-color:#67e8f9">Unidades: ${totales?.unidades ?? 0}</span>
      </div>
      <table>
        <thead><tr>
          <th>Cant.</th><th style="text-align:left">Producto</th><th>Medida</th>
          <th>Costo</th><th>P. Prom.</th><th>Total Venta</th><th>Utilidad</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`);
    win.document.close();
  };

  // Filtro local en tabla (búsqueda adicional sobre los rows ya generados)
  const [localSearch, setLocalSearch] = useState('');
  const visibleRows = localSearch
    ? rows.filter((r) => r.nombre.toLowerCase().includes(localSearch.toLowerCase()))
    : rows;

  return (
    <div className="p-6 space-y-4">

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Hash size={20} className="text-blue-700" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Productos vendidos</h1>
            <p className="text-xs text-slate-500">Consolidado de unidades, venta y utilidad por producto.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerar} disabled={loading}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            GENERAR
          </button>
          <button onClick={exportExcel} disabled={!generated}
            className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors">
            <FileSpreadsheet size={14} className={generated ? 'text-emerald-600' : ''} />
            EXCEL
          </button>
          <button onClick={exportPdf} disabled={!generated}
            className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors">
            <FileText size={14} className={generated ? 'text-red-500' : ''} />
            PDF
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
          <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Buscar producto</span>
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-white">
              <Search size={14} className="text-slate-400 flex-shrink-0" />
              <input className="flex-1 text-sm outline-none placeholder:text-slate-400"
                placeholder="Nombre del producto..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerar()} />
            </div>
          </div>
          {/* Toggle Costo catálogo */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1 opacity-0">x</span>
            <button
              onClick={() => setUseCostoCatalogo((p) => !p)}
              className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-white hover:bg-slate-50 transition-colors"
            >
              <div className={`relative w-9 h-5 rounded-full transition-colors ${useCostoCatalogo ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${useCostoCatalogo ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-sm text-slate-700 whitespace-nowrap">Costo catálogo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats pills */}
      {totales && (
        <div className="flex items-center gap-2 flex-wrap">
          <StatPill icon={<ShoppingCart size={12} />} label="Venta"
            value={fmtS(totales.totalVenta)}
            color="border-blue-200 bg-blue-50 text-blue-700" />
          <StatPill icon={<TrendingUp size={12} />} label="Utilidad"
            value={fmtS(totales.utilidad)}
            color={totales.utilidad >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'} />
          <StatPill icon={<Package size={12} />} label="Productos"
            value={String(totales.productos)}
            color="border-violet-200 bg-violet-50 text-violet-700" />
          <StatPill icon={<Hash size={12} />} label="Unidades"
            value={String(totales.unidades)}
            color="border-cyan-200 bg-cyan-50 text-cyan-700" />
        </div>
      )}

      {/* Banner estado */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-5 py-3 text-sm text-red-700">
          <Info size={15} className="flex-shrink-0" /> {error}
        </div>
      )}
      {generated && rows.length === 0 && !error && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 text-sm text-blue-700">
          <Info size={15} className="flex-shrink-0" />
          No se encontraron ventas aprobadas en el rango seleccionado.
        </div>
      )}
      {generated && rows.length > 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-sm text-emerald-700 font-medium">
          <CheckCircle2 size={16} className="flex-shrink-0" />
          Reporte generado: {rows.length} producto{rows.length !== 1 ? 's' : ''} consolidado{rows.length !== 1 ? 's' : ''}.
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

        {/* Buscador local en tabla */}
        {generated && rows.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Search size={13} className="text-slate-400" />
            <input className="flex-1 text-sm outline-none placeholder:text-slate-400"
              placeholder="Filtrar en tabla..."
              value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} />
            {localSearch && (
              <span className="text-xs text-slate-400">{visibleRows.length} de {rows.length}</span>
            )}
          </div>
        )}

        {!generated && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Package size={26} className="text-blue-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">Selecciona el rango de fechas y pulsa GENERAR</p>
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
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 w-16">Cantidad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Producto</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Medida</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Costo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">P. prom.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total venta</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Utilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibleRows.map((row, i) => (
                  <tr key={row.productId ?? i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-700 text-white text-xs font-bold">
                        {row.cantidad}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 text-xs leading-tight">{row.nombre}</div>
                      {row.codigoInterno && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Cod. {row.codigoInterno}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-slate-600 font-medium">{row.unidadMedida ?? 'UNIDAD'}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                      {useCostoCatalogo ? fmtS(row.costoUnitario) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">
                      {fmtS(row.precioPromedio)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800 text-xs whitespace-nowrap">
                      {fmtS(row.totalVenta)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold text-xs whitespace-nowrap ${
                      row.utilidad < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {fmtS(row.utilidad)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Fila de totales */}
              {totales && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-blue-700 text-white text-xs font-bold">
                        {totales.unidades}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-slate-700">TOTAL — {totales.productos} productos</span>
                    </td>
                    <td />
                    <td />
                    <td />
                    <td className="px-4 py-3 text-right font-bold text-blue-700 text-sm whitespace-nowrap">
                      {fmtS(totales.totalVenta)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold text-sm whitespace-nowrap ${
                      totales.utilidad < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {fmtS(totales.utilidad)}
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
