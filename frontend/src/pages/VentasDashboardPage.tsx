import { useState, useEffect, useCallback } from 'react';
import { BarChart2, RefreshCw, Download, TrendingUp } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import api from '@/lib/api';

type SaleDay   = { date: string; total: number };
type MonthStat = { mes: string; ventas: number; gastos: number };
type RankRow   = { productId: string | null; nombre: string; codigoInterno: string | null; cantidad: number; totalVenta: number; utilidad: number };

const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7c2f'];
const RANK_BG      = ['bg-amber-50 border-amber-200', 'bg-slate-50 border-slate-200', 'bg-orange-50 border-orange-200'];

function fmt(v: number) {
  return `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtK(v: number) {
  return v >= 1000 ? `S/${(v / 1000).toFixed(0)}k` : `S/${v}`;
}
function makeYAxis(interval: number, data: number[]) {
  const maxVal     = Math.max(...data, interval);
  const maxRounded = Math.ceil(maxVal / interval) * interval;
  return {
    type: 'value' as const,
    min: 0,
    max: maxRounded + interval,
    interval,
    splitLine: { lineStyle: { color: '#f1f5f9' } },
    axisLabel: { color: '#94a3b8', fontSize: 10, formatter: fmtK },
    axisLine: { show: false },
    axisTick: { show: false },
  };
}

export default function VentasDashboardPage() {
  const [salesData,   setSalesData]   = useState<SaleDay[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthStat[]>([]);
  const [kpis,        setKpis]        = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [tick,        setTick]        = useState(0);

  const [ranking,     setRanking]     = useState<RankRow[]>([]);
  const [rankLoading, setRankLoading] = useState(false);

  // ── Calcular lunes de la semana actual ──
  const getMondayStr = () => {
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  };

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<SaleDay[]>('/dashboard/sales-chart', { params: { months: 2 } }).then(r => r.data),
      api.get<MonthStat[]>('/dashboard/ventas-vs-gastos', { params: { months: 12 } }).then(r => r.data),
      api.get('/dashboard/kpis').then(r => r.data),
    ]).then(([sales, monthly, kpisData]) => {
      setSalesData(sales);
      setMonthlyData(monthly);
      setKpis(kpisData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fetchRanking = useCallback(() => {
    setRankLoading(true);
    const from = getMondayStr();
    const to   = new Date().toISOString().split('T')[0];
    api.get('/reports/productos-vendidos', { params: { from, to } })
      .then(r => setRanking((r.data.data ?? []).slice(0, 10)))
      .catch(() => setRanking([]))
      .finally(() => setRankLoading(false));
  }, []);

  useEffect(() => { fetchAll(); fetchRanking(); }, [fetchAll, fetchRanking, tick]);

  // ── Semana actual ──
  const now    = new Date();
  const dow    = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);

  const DAYS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
  const weekData = DAYS.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    return { day, total: salesData.find(s => s.date === ds)?.total ?? 0 };
  });

  // ── Últimas 4 semanas ──
  const weeksData = Array.from({ length: 4 }, (_, i) => {
    const wStart = new Date(monday); wStart.setDate(monday.getDate() - i * 7);
    const wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
    const total  = salesData
      .filter(s => { const d = new Date(s.date + 'T12:00:00'); return d >= wStart && d <= wEnd; })
      .reduce((sum, s) => sum + s.total, 0);
    const d1 = wStart.getDate().toString().padStart(2, '0');
    const d2 = wEnd.getDate().toString().padStart(2, '0');
    const m1 = (wStart.getMonth() + 1).toString().padStart(2, '0');
    const m2 = (wEnd.getMonth() + 1).toString().padStart(2, '0');
    return { label: `${d1}/${m1} - ${d2}/${m2}`, total };
  }).reverse();

  const weekTotal      = weekData.reduce((s, d) => s + d.total, 0);
  const lastWeeksTotal = weeksData.reduce((s, w) => s + w.total, 0);
  const anioTotal      = kpis?.ventas?.anio?.total ?? 0;

  // ── Tooltip común ──
  const tooltip = {
    trigger: 'axis' as const,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    textStyle: { color: '#f8fafc', fontSize: 12 },
    formatter: (p: any) => fmt(Number(p[0].value)),
  };

  // ── Opción: Ventas por día ──
  const optDia = {
    grid: { top: 20, right: 12, bottom: 36, left: 60 },
    tooltip,
    xAxis: {
      type: 'category' as const,
      data: weekData.map(d => d.day),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: makeYAxis(50, weekData.map(d => d.total)),
    series: [{
      type: 'bar' as const,
      data: weekData.map((d, i) => ({
        value: d.total,
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: i === (dow === 0 ? 6 : dow - 1)
            ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#2563eb' }, { offset: 1, color: '#93c5fd' }] }
            : { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#818cf8' }, { offset: 1, color: '#c7d2fe' }] },
        },
      })),
      barMaxWidth: 40,
    }],
  };

  // ── Opción: Comparativo semanal ──
  const optSemanal = {
    grid: { top: 20, right: 12, bottom: 56, left: 60 },
    tooltip,
    xAxis: {
      type: 'category' as const,
      data: weeksData.map(w => w.label),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 10, interval: 0 },
    },
    yAxis: makeYAxis(1000, weeksData.map(w => w.total)),
    series: [{
      type: 'line' as const,
      smooth: true,
      data: weeksData.map(w => w.total),
      symbol: 'circle', symbolSize: 9,
      lineStyle: { color: '#10b981', width: 2.5 },
      itemStyle: { color: '#10b981', borderWidth: 2.5, borderColor: '#fff' },
      areaStyle: {
        color: {
          type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(16,185,129,0.28)' }, { offset: 1, color: 'rgba(16,185,129,0.02)' }],
        },
      },
    }],
  };

  // ── Opción: Ventas por mes ──
  const optMensual = {
    grid: { top: 20, right: 12, bottom: 36, left: 60 },
    tooltip,
    xAxis: {
      type: 'category' as const,
      data: monthlyData.map(m => m.mes.split('.')[0].toUpperCase()),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 10, interval: 0 },
    },
    yAxis: makeYAxis(5000, monthlyData.map(m => m.ventas)),
    series: [{
      type: 'bar' as const,
      data: monthlyData.map(m => m.ventas),
      barMaxWidth: 28,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#c7d2fe' }] },
      },
    }],
  };

  const handleExport = () => {
    const n    = new Date();
    const from = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
    const to   = n.toISOString().split('T')[0];
    window.open(`${api.defaults.baseURL}/reports/excel/ventas?from=${from}&to=${to}`, '_blank');
  };

  const maxCantidad = ranking.length > 0 ? ranking[0].cantidad : 1;

  return (
    <div className="min-h-full bg-slate-50 p-5 flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.05)] px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <BarChart2 size={20} className="text-emerald-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800 leading-none">Dashboard de ventas</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Evolucion semanal, ultimas semanas y acumulado mensual.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTick(t => t + 1)}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600
              bg-white hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            ACTUALIZAR
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white
              active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
          >
            <Download size={14} />
            EXPORTAR
          </button>
        </div>
      </div>

      {/* ── Stats pills ── */}
      <div className="flex items-center gap-3">
        {[
          { label: 'Semana actual',   value: weekTotal,      color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: 'Ultimas semanas', value: lastWeeksTotal, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          { label: 'Año',            value: anioTotal,       color: 'text-violet-700 bg-violet-50 border-violet-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold ${color}`}>
            <span className="opacity-70 text-xs">{label}:</span>
            <span>{fmt(value)}</span>
          </div>
        ))}
      </div>

      {/* ── Gráficos ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm py-24">
          Cargando datos...
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">

          {/* Ventas por día */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Ventas por dia</p>
                <p className="text-[11px] text-slate-400">Semana actual</p>
              </div>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                {fmt(weekTotal)}
              </span>
            </div>
            <ReactECharts option={optDia} style={{ height: 320 }} notMerge />
          </div>

          {/* Comparativo semanal */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Comparativo semanal</p>
                <p className="text-[11px] text-slate-400">Ultimos 4 periodos</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                {fmt(lastWeeksTotal)}
              </span>
            </div>
            <ReactECharts option={optSemanal} style={{ height: 320 }} notMerge />
          </div>

          {/* Ventas por mes */}
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Ventas por mes</p>
                <p className="text-[11px] text-slate-400">Año en curso</p>
              </div>
              <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-100">
                {fmt(anioTotal)}
              </span>
            </div>
            <ReactECharts option={optMensual} style={{ height: 320 }} notMerge />
          </div>

        </div>
      )}

      {/* ── Ranking de productos esta semana ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp size={15} className="text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 leading-none">Ranking semanal de productos</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Top 10 más vendidos esta semana</p>
            </div>
          </div>
          {ranking.length > 0 && (
            <span className="text-[11px] text-slate-400">
              {ranking.reduce((s, r) => s + r.cantidad, 0)} unidades vendidas
            </span>
          )}
        </div>

        {rankLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm gap-2">
            <RefreshCw size={13} className="animate-spin" /> Cargando ranking...
          </div>
        ) : ranking.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <p className="text-sm font-medium text-slate-500">Sin ventas esta semana</p>
            <p className="text-xs">El ranking se actualizará cuando haya productos vendidos.</p>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {ranking.map((row, i) => {
              const pct = Math.round((row.cantidad / maxCantidad) * 100);
              const isTop3 = i < 3;
              return (
                <div
                  key={row.productId ?? i}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isTop3 ? RANK_BG[i] : 'bg-slate-50/50 border-slate-100'
                  }`}
                >
                  {/* Posición */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black"
                    style={{
                      background: isTop3
                        ? `${MEDAL_COLORS[i]}22`
                        : '#f1f5f9',
                      color: isTop3 ? MEDAL_COLORS[i] : '#94a3b8',
                      border: `1.5px solid ${isTop3 ? MEDAL_COLORS[i] + '55' : '#e2e8f0'}`,
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Info + barra */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-800 truncate">{row.nombre}</span>
                      <span className="text-xs font-bold text-slate-700 flex-shrink-0">{row.cantidad} uds.</span>
                    </div>
                    {/* Barra de progreso */}
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: isTop3
                            ? MEDAL_COLORS[i]
                            : '#94a3b8',
                        }}
                      />
                    </div>
                  </div>

                  {/* Venta */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-slate-800">{fmt(row.totalVenta)}</p>
                    <p className={`text-[10px] font-semibold ${row.utilidad >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      util. {fmt(row.utilidad)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
