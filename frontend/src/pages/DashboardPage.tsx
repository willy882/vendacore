import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark, Package, FileText, Users, Palette,
  Monitor, BarChart2, Headphones, Settings,
  X, MessageCircle, Globe, Megaphone,
  UtensilsCrossed, BedDouble, Stethoscope, Bus, Wrench, ChevronRight,
  ArrowRight, RefreshCw, Sparkles, CheckCircle2, ShoppingCart, FileCheck,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

const ONBOARDING_KEY = 'vendacore-onboarding-done';
const WA_ONBOARDING = import.meta.env.VITE_WHATSAPP_NUMBER ?? '51928141669';

const WA = '51928141669';

// ── Modal Servicio de Diseño ──────────────────────────────────────────────────

function DesignModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 9999, background: 'rgba(10,14,26,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[440px] bg-white rounded-[2rem] overflow-hidden"
        style={{ boxShadow: '0 32px 80px -8px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center
            bg-white/10 border border-white/20 text-white hover:bg-white/20 active:scale-95 transition-all"
        >
          <X size={15} />
        </button>

        {/* Imagen de fondo */}
        <div className="relative h-[200px] overflow-hidden">
          <img
            src="/cards/diseno-modal.png"
            alt="Servicios de Diseño"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Contenido */}
        <div className="px-7 pt-6 pb-7 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 leading-snug">
              Servicios Profesionales<br />de Diseño Gráfico
            </h2>
            <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
              Transformamos tu marca en una presencia visual que comunica, conecta y vende.
              Diseños a medida con enfoque estratégico y estético.
            </p>
          </div>

          <ul className="space-y-3">
            {[
              { Icon: Palette,    text: 'Identidad visual y logos memorables' },
              { Icon: Megaphone,  text: 'Materiales publicitarios que captan la atención' },
              { Icon: Globe,      text: 'Páginas web adaptadas a cualquier dispositivo' },
            ].map(({ Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center mt-0.5">
                  <Icon size={14} className="text-zinc-500" />
                </span>
                <span className="text-sm text-zinc-600 leading-snug pt-1">{text}</span>
              </li>
            ))}
          </ul>

          <div className="h-px bg-zinc-100" />

          <div className="flex gap-3">
            <a
              href={`https://wa.me/${WA}?text=Hola,%20quiero%20información%20sobre%20servicios%20de%20diseño%20gráfico`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                bg-zinc-900 text-white text-sm font-bold tracking-wide
                hover:bg-zinc-800 active:scale-[0.98] transition-all duration-150"
            >
              <MessageCircle size={15} />
              CONTÁCTANOS
            </a>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-semibold text-zinc-400
                hover:text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] transition-all duration-150"
            >
              CERRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Mis Reportes ────────────────────────────────────────────────────────

type SaleDay    = { date: string; total: number };
type MonthStat  = { mes: string; ventas: number; gastos: number };

function fmt(v: number) {
  return `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtK(v: number) {
  return v >= 1000 ? `S/${(v / 1000).toFixed(0)}k` : `S/${v}`;
}

const MONTH_OPTIONS = [
  { label: '1M',  value: 1 },
  { label: '2M',  value: 2 },
  { label: '3M',  value: 3 },
  { label: '6M',  value: 6 },
  { label: '12M', value: 12 },
];

function ReportesModal({ onClose, onNavigate }: { onClose: () => void; onNavigate: () => void }) {
  const [salesData,   setSalesData]   = useState<SaleDay[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthStat[]>([]);
  const [kpis,        setKpis]        = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [tick,        setTick]        = useState(0);
  const [chartMonths, setChartMonths] = useState(2);

  const fetchAll = useCallback((months: number) => {
    setLoading(true);
    Promise.all([
      api.get<SaleDay[]>('/dashboard/sales-chart', { params: { months } }).then(r => r.data),
      api.get<MonthStat[]>('/dashboard/ventas-vs-gastos', { params: { months: 12 } }).then(r => r.data),
      api.get('/dashboard/kpis').then(r => r.data),
    ]).then(([sales, monthly, kpisData]) => {
      setSalesData(sales);
      setMonthlyData(monthly);
      setKpis(kpisData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(chartMonths); }, [fetchAll, tick, chartMonths]);

  // ── Proceso semana actual ──
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

  // ── Proceso últimas 4 semanas ──
  const weeksData = Array.from({ length: 4 }, (_, i) => {
    const wStart = new Date(monday); wStart.setDate(monday.getDate() - i * 7);
    const wEnd   = new Date(wStart); wEnd.setDate(wStart.getDate() + 6);
    const total  = salesData
      .filter(s => { const d = new Date(s.date + 'T12:00:00'); return d >= wStart && d <= wEnd; })
      .reduce((sum, s) => sum + s.total, 0);
    const label  = `${wStart.getDate().toString().padStart(2, '0')}/${(wStart.getMonth() + 1).toString().padStart(2, '0')}`;
    return { label, total };
  }).reverse();

  const weekTotal      = weekData.reduce((s, d) => s + d.total, 0);
  const lastWeeksTotal = weeksData.reduce((s, w) => s + w.total, 0);
  const anioTotal      = kpis?.ventas?.anio?.total ?? 0;

  // ── ECharts tooltip base ──
  const tooltip = {
    trigger: 'axis' as const,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    textStyle: { color: '#f8fafc', fontSize: 12 },
    formatter: (p: any) => fmt(Number(p[0].value)),
  };
  const makeYAxis = (interval: number, data: number[]) => {
    const maxVal = Math.max(...data, interval);
    const maxRounded = Math.ceil(maxVal / interval) * interval;
    return {
      type: 'value' as const,
      min: 0,
      max: maxRounded + interval,
      interval,
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { color: '#94a3b8', fontSize: 9, formatter: fmtK },
      axisLine: { show: false }, axisTick: { show: false },
    };
  };

  // ── Opción: Ventas por día ──
  const optDia = {
    grid: { top: 14, right: 8, bottom: 28, left: 48 },
    tooltip,
    xAxis: {
      type: 'category' as const,
      data: weekData.map(d => d.day),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
    },
    yAxis: makeYAxis(50, weekData.map(d => d.total)),
    series: [{
      type: 'bar' as const,
      data: weekData.map((d, i) => ({
        value: d.total,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: i === (dow === 0 ? 6 : dow - 1)
            ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#2563eb' }, { offset: 1, color: '#93c5fd' }] }
            : { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#818cf8' }, { offset: 1, color: '#c7d2fe' }] },
        },
      })),
      barMaxWidth: 32,
    }],
  };

  // ── Opción: Comparativo semanal ──
  const optSemanal = {
    grid: { top: 14, right: 8, bottom: 28, left: 48 },
    tooltip,
    xAxis: {
      type: 'category' as const,
      data: weeksData.map(w => w.label),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
    },
    yAxis: makeYAxis(1000, weeksData.map(w => w.total)),
    series: [{
      type: 'line' as const,
      smooth: true,
      data: weeksData.map(w => w.total),
      symbol: 'circle', symbolSize: 8,
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
    grid: { top: 14, right: 8, bottom: 28, left: 48 },
    tooltip,
    xAxis: {
      type: 'category' as const,
      data: monthlyData.map(m => m.mes.split('.')[0].replace('ago','AGO').replace('set','SET').toUpperCase()),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#94a3b8', fontSize: 9, interval: 0 },
    },
    yAxis: makeYAxis(5000, monthlyData.map(m => m.ventas)),
    series: [{
      type: 'bar' as const,
      data: monthlyData.map(m => m.ventas),
      barMaxWidth: 22,
      itemStyle: {
        borderRadius: [3, 3, 0, 0],
        color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#c7d2fe' }] },
      },
    }],
  };

  const CHART_H = 280;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-2 py-2"
      style={{ zIndex: 9999, background: 'rgba(5,10,20,0.82)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full bg-white rounded-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: '97vw', maxHeight: '96vh', boxShadow: '0 40px 100px -12px rgba(0,0,0,0.55)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <BarChart2 size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-800 leading-none">Dashboard de ventas</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Evolución semanal, últimas semanas y acumulado mensual.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Selector de rango */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {MONTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setChartMonths(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    chartMonths === opt.value
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setTick(t => t + 1)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600
                hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              ACTUALIZAR
            </button>
            <button
              onClick={() => {
                const now = new Date();
                const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
                const to   = now.toISOString().split('T')[0];
                window.open(`${api.defaults.baseURL}/reports/excel/ventas?from=${from}&to=${to}`, '_blank');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-bold text-emerald-700
                bg-emerald-50 hover:bg-emerald-100 active:scale-95 transition-all"
            >
              <ArrowRight size={12} className="rotate-90" />
              EXPORTAR
            </button>
            <button
              onClick={onNavigate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white
                active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}
            >
              <ArrowRight size={12} />
              VER COMPLETO
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400
                hover:bg-slate-100 hover:text-slate-700 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Stats pills ── */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-50 flex-shrink-0">
          {[
            { Icon: BarChart2, label: 'Semana actual', value: weekTotal,      color: 'text-blue-600 bg-blue-50 border-blue-100' },
            { Icon: BarChart2, label: 'Últimas semanas', value: lastWeeksTotal, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
            { Icon: BarChart2, label: 'Año',            value: anioTotal,      color: 'text-violet-600 bg-violet-50 border-violet-100' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${color}`}>
              <span className="opacity-60">{label}:</span>
              <span>{fmt(value)}</span>
            </div>
          ))}
        </div>

        {/* ── Gráficos ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
              Cargando datos...
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {/* Ventas por día */}
              <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Ventas por dia</p>
                    <p className="text-[11px] text-slate-400">Semana actual</p>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    {fmt(weekTotal)}
                  </span>
                </div>
                <ReactECharts option={optDia} style={{ height: CHART_H }} notMerge />
              </div>

              {/* Comparativo semanal */}
              <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Comparativo semanal</p>
                    <p className="text-[11px] text-slate-400">Ultimos 4 periodos</p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    {fmt(lastWeeksTotal)}
                  </span>
                </div>
                <ReactECharts option={optSemanal} style={{ height: CHART_H }} notMerge />
              </div>

              {/* Ventas por mes */}
              <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Ventas por mes</p>
                    <p className="text-[11px] text-slate-400">Año en curso</p>
                  </div>
                  <span className="text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                    {fmt(anioTotal)}
                  </span>
                </div>
                <ReactECharts option={optMensual} style={{ height: CHART_H }} notMerge />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal Otros Sistemas ──────────────────────────────────────────────────────

const SISTEMAS = [
  {
    Icon: UtensilsCrossed,
    color: 'bg-orange-500',
    nombre: 'Sistema para Restaurantes',
    sub: 'Comandas, mesas, cocina y delivery.',
    desc: 'Gestiona todo tu negocio gastronómico desde una sola pantalla, desde la toma de pedidos hasta el cierre de caja.',
    bullets: [
      'Comandas digitales para mozos desde tablet o celular',
      'Control de mesas, reservas y turnos',
      'Gestión de insumos, recetas y costos',
      'Reportes de ventas, productos más vendidos y rentabilidad',
    ],
    img: '/cards/restaurante.png',
  },
  {
    Icon: BedDouble,
    color: 'bg-blue-600',
    nombre: 'Sistema para Hoteles y Hospedajes',
    sub: 'Reservas, habitaciones y facturación.',
    desc: 'Administra tu hotel o hospedaje con control total de habitaciones, huéspedes y pagos en tiempo real.',
    bullets: [
      'Gestión de habitaciones, tarifas y disponibilidad',
      'Check-in y check-out digital con historial de huéspedes',
      'Control de consumos adicionales y cargos',
      'Integración con booking online y emisión de comprobantes',
    ],
    img: '/cards/hoteles.png',
  },
  {
    Icon: Stethoscope,
    color: 'bg-emerald-600',
    nombre: 'Sistema para Clínicas y Consultorios',
    sub: 'Citas, historial médico y farmacia.',
    desc: 'Digitaliza tu clínica o consultorio: desde la agenda de citas hasta el historial clínico de cada paciente.',
    bullets: [
      'Agendamiento de citas con recordatorios automáticos',
      'Historial clínico, diagnósticos y recetas por paciente',
      'Control de farmacia, insumos y stock de medicamentos',
      'Facturación, seguros y emisión de boletas electrónicas',
    ],
    img: '/cards/clinicas.png',
  },
  {
    Icon: Bus,
    color: 'bg-violet-600',
    nombre: 'Sistema para Transportes',
    sub: 'Pasajes, encomiendas y guías de remisión.',
    desc: 'Controla tu empresa de transporte con venta de pasajes, gestión de encomiendas y rutas en tiempo real.',
    bullets: [
      'Venta de pasajes en ventanilla y reserva anticipada',
      'Guías de remisión electrónicas (SUNAT)',
      'Control de encomiendas: peso, destino y despacho',
      'Seguimiento de rutas, conductores y vehículos',
    ],
    img: '/cards/transportes.png',
  },
  {
    Icon: Wrench,
    color: 'bg-amber-600',
    nombre: 'Sistema para Ferreterías y Almacenes',
    sub: 'Inventario, compras, ventas y reportes.',
    desc: 'Lleva el control exacto de tu ferretería o almacén con gestión de stock, proveedores y ventas al por mayor y menor.',
    bullets: [
      'Inventario con lector de código de barras',
      'Control de proveedores, órdenes de compra y cuentas por pagar',
      'Ventas al por mayor, menor y cotizaciones',
      'Alertas de stock mínimo y reportes de rotación',
    ],
    img: '/cards/ferreterias.png',
  },
];

function OtherSystemsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4 py-6"
      style={{ zIndex: 9999, background: 'rgba(10,14,26,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-white rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh', boxShadow: '0 32px 80px -8px rgba(0,0,0,0.45)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header fijo ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
          >
            <X size={16} />
          </button>
          <h2 className="text-base font-bold text-slate-800 flex-1">
            Sistemas Integrales para Todo Tipo de Negocios
          </h2>
        </div>

        {/* ── Contenido scrollable ── */}
        <div className="overflow-y-auto flex-1">

          {/* Hero imagen */}
          {/* Hero imagen — ratio 3:2, sin recorte */}
          <div className="relative bg-slate-900">
            <img
              src="/cards/sistemas-hero.png"
              alt="Sistemas empresariales"
              className="w-full h-auto block"
            />
            {/* Difuminado en los bordes */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/60" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/30 via-transparent to-slate-900/30" />
          </div>

          {/* Intro */}
          <div className="px-6 pt-5 pb-2">
            <p className="text-sm text-slate-500 leading-relaxed">
              En <strong className="text-slate-800">W_Code</strong>, desarrollamos sistemas diseñados específicamente
              para cada tipo de negocio en Perú. Aumenta tu productividad, mejora la experiencia de tus clientes
              y gestiona todos tus procesos de forma eficiente con tecnología moderna y soporte continuo.
            </p>
          </div>

          {/* Sección sistemas */}
          <div className="px-6 pb-2 pt-3">
            <p className="text-sm font-extrabold text-slate-700 mb-4">Descubre Nuestros Sistemas Especializados:</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SISTEMAS.map(({ Icon, color, nombre, sub, desc, bullets, img }) => (
                <div key={nombre} className="border border-slate-100 rounded-xl overflow-hidden hover:border-slate-200 hover:shadow-sm transition-all">
                  <div className="h-[140px] overflow-hidden bg-slate-100">
                    <img
                      src={img}
                      alt={nombre}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={14} className="text-white" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-800 leading-tight">{nombre}</p>
                        <p className="text-[11px] font-semibold text-slate-400">{sub}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                    <ul className="space-y-1">
                      {bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <ChevronRight size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}

              {/* Card "Y Mucho Más" */}
              <div className="border border-dashed border-slate-200 rounded-xl p-5 flex flex-col justify-center bg-slate-50">
                <p className="text-base font-extrabold text-slate-700 mb-2">¡Y Mucho Más!</p>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Farmacias, minimarkets, bodegas, salones de belleza, talleres mecánicos, colegios y más.
                  Si tu negocio lo necesita, nosotros lo construimos.
                </p>
                <a
                  href={`https://wa.me/${WA}?text=Hola%2C%20quiero%20información%20sobre%20sistemas%20para%20mi%20negocio`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-bold
                    hover:bg-slate-700 active:scale-[0.98] transition-all w-fit"
                >
                  <MessageCircle size={13} />
                  Consultar mi caso
                </a>
              </div>
            </div>
          </div>

          <div className="h-5" />
        </div>

        {/* ── Footer fijo ── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-white">
          <p className="text-xs text-slate-400">Desarrollado por W_Code · Soporte continuo incluido</p>
          <div className="flex gap-2">
            <a
              href={`https://wa.me/${WA}?text=Hola%2C%20quiero%20información%20sobre%20sistemas%20para%20mi%20negocio`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold
                hover:bg-slate-800 active:scale-[0.98] transition-all"
            >
              <MessageCircle size={13} />
              CONTÁCTANOS
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400
                hover:text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all"
            >
              CERRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Card {
  label:  string;
  img:    string;
  icon:   React.ReactNode;
  action: () => void;
}

// ── Onboarding Modal ──────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: <Settings size={22} className="text-blue-600" />,
    bg: 'bg-blue-50',
    title: 'Configura tu negocio',
    desc: 'Completa el nombre, RUC, dirección y logo de tu empresa para que aparezcan en tus comprobantes.',
    action: 'Ir a Configuración',
    path: '/configuracion',
  },
  {
    icon: <Package size={22} className="text-emerald-600" />,
    bg: 'bg-emerald-50',
    title: 'Agrega tus productos',
    desc: 'Registra tu catálogo con precios, unidades y stock inicial. Usa categorías para organizarlos.',
    action: 'Ir a Productos',
    path: '/productos',
  },
  {
    icon: <ShoppingCart size={22} className="text-violet-600" />,
    bg: 'bg-violet-50',
    title: 'Realiza tu primera venta',
    desc: 'Usa el Punto de Venta para registrar ventas rápidas con boleta o ticket simple.',
    action: 'Ir a Punto de Venta',
    path: '/punto-venta',
  },
  {
    icon: <FileCheck size={22} className="text-amber-600" />,
    bg: 'bg-amber-50',
    title: 'Activa tu facturación SUNAT',
    desc: 'Escríbenos por WhatsApp con tu RUC y credenciales SOL. Nosotros configuramos todo por ti.',
    action: 'Contactar por WhatsApp',
    path: null,
  },
];

function OnboardingModal({ onClose, onNavigate }: { onClose: () => void; onNavigate: (path: string) => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleAction = () => {
    if (current.path) {
      onNavigate(current.path);
    } else {
      window.open(
        `https://wa.me/${WA_ONBOARDING}?text=${encodeURIComponent('Hola! Quiero activar mi facturación SUNAT en VendaCore.')}`,
        '_blank',
      );
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 9999, background: 'rgba(10,14,26,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 32px 80px -8px rgba(0,0,0,0.4)' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-6 pt-6 pb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-200" />
              <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Primeros pasos</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <h2 className="text-xl font-bold text-white">Bienvenido a VendaCore</h2>
          <p className="text-blue-200 text-sm mt-1">Sigue estos 4 pasos para comenzar</p>

          {/* Step indicators */}
          <div className="flex gap-2 mt-4">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'bg-white flex-1' : i < step ? 'bg-blue-300 w-6' : 'bg-blue-700 w-6'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 py-6">
          <div className={`w-11 h-11 rounded-xl ${current.bg} flex items-center justify-center mb-4`}>
            {current.icon}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400 font-medium">Paso {step + 1} de {STEPS.length}</span>
            {step < STEPS.length && (
              <span className="text-xs text-slate-300">·</span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">{current.title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{current.desc}</p>
        </div>

        {/* Completed steps summary (last step) */}
        {isLast && (
          <div className="mx-6 mb-4 bg-slate-50 rounded-xl p-3">
            <div className="space-y-1.5">
              {STEPS.slice(0, -1).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-xs text-slate-500">{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleAction}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors active:scale-[0.98]"
          >
            {current.action}
          </button>
          {!isLast ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Terminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [showDesign,      setShowDesign]      = useState(false);
  const [showSystems,     setShowSystems]     = useState(false);
  const [showReportes,    setShowReportes]    = useState(false);
  const [showOnboarding,  setShowOnboarding]  = useState(() => {
    return !localStorage.getItem(ONBOARDING_KEY);
  });

  const closeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  };

  const handleOnboardingNavigate = (path: string) => {
    closeOnboarding();
    navigate(path);
  };

  // Forzar onboarding solo a admins, no super_admin
  const shouldShowOnboarding = showOnboarding && !!user;

  const cards: Card[] = [
    { label: 'Caja',               img: '/cards/caja.png',        icon: <Landmark   size={38} />, action: () => navigate('/punto-venta') },
    { label: 'Productos',          img: '/cards/productos.png',   icon: <Package    size={38} />, action: () => navigate('/productos') },
    { label: 'Comprobantes',       img: '/cards/comprobantes.png',icon: <FileText   size={38} />, action: () => navigate('/comprobantes') },
    { label: 'Clientes',           img: '/cards/clientes.png',    icon: <Users      size={38} />, action: () => navigate('/clientes') },
    { label: 'Servicio de Diseño', img: '/cards/diseno.png',      icon: <Palette    size={38} />, action: () => setShowDesign(true) },
    { label: 'Otros Sistemas',     img: '/cards/otros.png',       icon: <Monitor    size={38} />, action: () => setShowSystems(true) },
    { label: 'Mis Reportes',       img: '/cards/reportes.png',    icon: <BarChart2  size={38} />, action: () => navigate('/dashboard-ventas') },
    { label: 'Soporte',            img: '/cards/soporte.png',     icon: <Headphones size={38} />, action: () => window.open(`https://wa.me/${WA}?text=Hola%2C%20necesito%20soporte`, '_blank') },
    { label: 'Config',             img: '/cards/config.png',      icon: <Settings   size={38} />, action: () => navigate('/configuracion') },
  ];

  return (
    <div className="min-h-full bg-slate-100">
      <div className="grid grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={card.action}
            className="relative overflow-hidden group cursor-pointer"
            style={{ aspectRatio: '3.2 / 1' }}
          >
            <img
              src={card.img}
              alt={card.label}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300" />
            <div className="relative z-10 flex flex-col justify-center h-full px-6 py-4 w-1/2">
              <div className="flex items-center gap-3 text-white drop-shadow-md">
                {card.icon}
                <span className="text-xl font-bold leading-tight drop-shadow-md">{card.label}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {showDesign    && <DesignModal       onClose={() => setShowDesign(false)}   />}
      {showSystems   && <OtherSystemsModal onClose={() => setShowSystems(false)}  />}
      {showReportes  && <ReportesModal     onClose={() => setShowReportes(false)} onNavigate={() => { setShowReportes(false); navigate('/reportes'); }} />}
      {shouldShowOnboarding && (
        <OnboardingModal onClose={closeOnboarding} onNavigate={handleOnboardingNavigate} />
      )}
    </div>
  );
}
