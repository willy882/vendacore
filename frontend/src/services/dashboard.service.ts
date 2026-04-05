import api from '@/lib/api';
import type { FullDashboard, DashboardKpis, VentasVsGastos, TopProduct, PaymentMethodStat, CashFlowPoint } from '@/types';

export const dashboardService = {
  getFullDashboard: () =>
    api.get<FullDashboard>('/dashboard').then((r) => r.data),

  getKpis: () =>
    api.get<DashboardKpis>('/dashboard/kpis').then((r) => r.data),

  getVentasVsGastos: (months = 6) =>
    api.get<VentasVsGastos[]>('/dashboard/ventas-vs-gastos', { params: { months } }).then((r) => r.data),

  getTopProducts: (limit = 10, days = 30) =>
    api.get<TopProduct[]>('/dashboard/top-products', { params: { limit, days } }).then((r) => r.data),

  getPaymentMethods: (days = 30) =>
    api.get<PaymentMethodStat[]>('/dashboard/payment-methods', { params: { days } }).then((r) => r.data),

  getCashFlow: (days = 30) =>
    api.get<CashFlowPoint[]>('/dashboard/cash-flow', { params: { days } }).then((r) => r.data),
};
