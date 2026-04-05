import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import {
  TrendingUp, TrendingDown, Minus,
  ShoppingCart, DollarSign, Percent, AlertTriangle, FileWarning,
} from 'lucide-react';
import { dashboardService } from '@/services/dashboard.service';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { FullDashboard } from '@/types';

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiProps {
  label:     string;
  value:     string;
  sub?:      string;
  pct?:      number;
  icon:      React.ReactNode;
  iconBg:    string;
}

function KpiCard({ label, value, sub, pct, icon, iconBg }: KpiProps) {
  const isUp   = pct !== undefined && pct > 0;
  const isDown = pct !== undefined && pct < 0;

  return (
    <Card className="flex gap-4 items-start">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {pct !== undefined && (
        <div
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0
            ${isUp ? 'bg-emerald-50 text-emerald-700' : isDown ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}
        >
          {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : <Minus size={12} />}
          {Math.abs(pct).toFixed(1)}%
        </div>
      )}
    </Card>
  );
}

// ─── Chart options ────────────────────────────────────────────────────────────

function ventasVsGastosOption(data: FullDashboard['graficos']['ventasVsGastos']) {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend:  { data: ['Ventas', 'Gastos', 'Utilidad'], bottom: 0, textStyle: { fontSize: 11 } },
    grid:    { top: 10, left: 10, right: 10, bottom: 36, containLabel: true },
    xAxis:   { type: 'category', data: data.map((d) => d.mes), axisLabel: { fontSize: 11 } },
    yAxis:   { type: 'value', axisLabel: { formatter: (v: number) => `S/ ${formatNumber(v, 0)}`, fontSize: 10 } },
    series: [
      { name: 'Ventas',   type: 'bar', data: data.map((d) => d.ventas),   itemStyle: { color: '#1E40AF', borderRadius: [3, 3, 0, 0] } },
      { name: 'Gastos',   type: 'bar', data: data.map((d) => d.gastos),   itemStyle: { color: '#EF4444', borderRadius: [3, 3, 0, 0] } },
      { name: 'Utilidad', type: 'line', data: data.map((d) => d.utilidad), lineStyle: { color: '#10B981', width: 2 }, itemStyle: { color: '#10B981' }, symbol: 'circle', symbolSize: 5 },
    ],
  };
}

function paymentMethodOption(data: FullDashboard['graficos']['porMetodoPago']) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: S/ {c} ({d}%)' },
    legend:  { orient: 'vertical', right: 0, top: 'center', textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['38%', '50%'],
      data: data.map((p) => ({ name: p.nombre, value: p.monto })),
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.2)' } },
    }],
    color: ['#1E40AF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
  };
}

function cashFlowOption(data: FullDashboard['graficos']['cashFlow']) {
  return {
    tooltip: { trigger: 'axis' },
    legend:  { data: ['Ingresos', 'Egresos', 'Saldo'], bottom: 0, textStyle: { fontSize: 11 } },
    grid:    { top: 10, left: 10, right: 10, bottom: 36, containLabel: true },
    xAxis:   { type: 'category', data: data.map((d) => d.date.slice(5)), axisLabel: { fontSize: 10 } },
    yAxis:   { type: 'value', axisLabel: { formatter: (v: number) => `S/ ${formatNumber(v, 0)}`, fontSize: 10 } },
    series: [
      { name: 'Ingresos', type: 'bar', data: data.map((d) => d.ingresos), itemStyle: { color: '#10B981', borderRadius: [2, 2, 0, 0] } },
      { name: 'Egresos',  type: 'bar', data: data.map((d) => d.egresos),  itemStyle: { color: '#EF4444', borderRadius: [2, 2, 0, 0] } },
      { name: 'Saldo',    type: 'line', data: data.map((d) => d.saldoAcumulado), lineStyle: { color: '#1E40AF', width: 2 }, itemStyle: { color: '#1E40AF' }, symbol: 'circle', symbolSize: 4 },
    ],
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  dashboardService.getFullDashboard,
    refetchInterval: 5 * 60 * 1000, // refresca cada 5 min
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <AlertTriangle size={32} className="text-amber-500" />
        <p className="text-sm">No se pudo cargar el dashboard.</p>
        <button onClick={() => refetch()} className="text-blue-600 text-sm hover:underline">
          Reintentar
        </button>
      </div>
    );
  }

  const { kpis, graficos, topClientes, documentStats } = data;

  return (
    <div className="space-y-6">
      {/* Refresh indicator */}
      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Spinner size="sm" /> Actualizando...
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Ventas Hoy"
          value={formatCurrency(kpis.ventas.hoy.total)}
          sub={`${kpis.transacciones.hoy} transacciones`}
          pct={kpis.ventas.hoy.pctVsAyer}
          icon={<ShoppingCart size={20} className="text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <KpiCard
          label="Ventas del Mes"
          value={formatCurrency(kpis.ventas.mes.total)}
          sub={`${kpis.transacciones.mes} transacciones`}
          pct={kpis.ventas.mes.pctVsAnterior}
          icon={<TrendingUp size={20} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <KpiCard
          label="Ticket Promedio"
          value={formatCurrency(kpis.ventas.ticketPromedio)}
          sub="del mes actual"
          icon={<DollarSign size={20} className="text-amber-600" />}
          iconBg="bg-amber-50"
        />
        <KpiCard
          label="Utilidad Bruta"
          value={formatCurrency(kpis.finanzas.utilidadBruta)}
          sub={`Margen: ${kpis.finanzas.margenBruto}%`}
          icon={<Percent size={20} className="text-purple-600" />}
          iconBg="bg-purple-50"
        />
      </div>

      {/* ── Alertas ──────────────────────────────────────────────────────── */}
      {(kpis.alertas.stockCritico > 0 || kpis.alertas.comprobantesPendientes > 0) && (
        <div className="flex flex-wrap gap-3">
          {kpis.alertas.stockCritico > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
              <span>
                <strong>{kpis.alertas.stockCritico}</strong> producto(s) en stock crítico:&nbsp;
                {kpis.alertas.productosStockCritico
                  .slice(0, 3)
                  .map((p) => p.nombre)
                  .join(', ')}
                {kpis.alertas.stockCritico > 3 && ` y ${kpis.alertas.stockCritico - 3} más`}
              </span>
            </div>
          )}
          {kpis.alertas.comprobantesPendientes > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-800">
              <FileWarning size={16} className="text-red-500 flex-shrink-0" />
              <span>
                <strong>{kpis.alertas.comprobantesPendientes}</strong> comprobante(s) pendientes de envío a SUNAT
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Gráficos fila 1 ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Ventas vs Gastos — ocupa 3 cols */}
        <Card className="xl:col-span-3" padding="md">
          <CardHeader>
            <CardTitle>Ventas vs Gastos (últimos 6 meses)</CardTitle>
          </CardHeader>
          <ReactECharts
            option={ventasVsGastosOption(graficos.ventasVsGastos)}
            style={{ height: 240 }}
            notMerge
          />
        </Card>

        {/* Métodos de pago — ocupa 2 cols */}
        <Card className="xl:col-span-2" padding="md">
          <CardHeader>
            <CardTitle>Métodos de Pago</CardTitle>
            <span className="text-xs text-slate-400">Últimos 30 días</span>
          </CardHeader>
          {graficos.porMetodoPago.length > 0 ? (
            <ReactECharts
              option={paymentMethodOption(graficos.porMetodoPago)}
              style={{ height: 240 }}
              notMerge
            />
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-400 text-sm">
              Sin datos
            </div>
          )}
        </Card>
      </div>

      {/* ── Gráficos fila 2 ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Flujo de caja */}
        <Card padding="md">
          <CardHeader>
            <CardTitle>Flujo de Caja</CardTitle>
            <span className="text-xs text-slate-400">Últimos 30 días</span>
          </CardHeader>
          {graficos.cashFlow.length > 0 ? (
            <ReactECharts
              option={cashFlowOption(graficos.cashFlow)}
              style={{ height: 220 }}
              notMerge
            />
          ) : (
            <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
              Sin datos de caja
            </div>
          )}
        </Card>

        {/* Estado comprobantes SUNAT */}
        <Card padding="md">
          <CardHeader>
            <CardTitle>Comprobantes SUNAT (mes actual)</CardTitle>
          </CardHeader>
          <div className="space-y-2 mt-1">
            {Object.entries(documentStats).length > 0 ? (
              Object.entries(documentStats).map(([estado, stats]) => (
                <div key={estado} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        estado === 'aceptado'  ? 'success' :
                        estado === 'pendiente' ? 'warning' :
                        estado === 'observado' ? 'danger'  : 'default'
                      }
                    >
                      {estado}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{stats.cantidad} docs</p>
                    <p className="text-xs text-slate-500">{formatCurrency(stats.total)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">Sin comprobantes este mes</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Tablas fila 3 ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top Productos */}
        <Card padding="none">
          <CardHeader className="p-5 pb-0">
            <CardTitle>Top Productos</CardTitle>
            <span className="text-xs text-slate-400">Últimos 30 días</span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Producto</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-3 py-3">Cant.</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Ingreso</th>
                </tr>
              </thead>
              <tbody>
                {graficos.topProductos.length > 0 ? graficos.topProductos.map((p, i) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-semibold flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-slate-800 font-medium line-clamp-1">{p.nombre}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{formatNumber(p.cantidadVendida)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">{formatCurrency(p.ingresoTotal)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400 text-sm">Sin ventas en el período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Top Clientes */}
        <Card padding="none">
          <CardHeader className="p-5 pb-0">
            <CardTitle>Top Clientes</CardTitle>
            <span className="text-xs text-slate-400">Mes actual</span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Cliente</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-3 py-3">Compras</th>
                  <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {topClientes.length > 0 ? topClientes.map((c, i) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-semibold flex-shrink-0">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-slate-800 font-medium line-clamp-1">{c.nombreCompleto}</p>
                          <p className="text-xs text-slate-400">{c.numeroDocumento}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{c.transacciones}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">{formatCurrency(c.totalCompras)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400 text-sm">Sin clientes registrados este mes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Generado en */}
      <p className="text-xs text-slate-400 text-right">
        Actualizado: {new Date(data.generadoEn).toLocaleString('es-PE')}
      </p>
    </div>
  );
}
