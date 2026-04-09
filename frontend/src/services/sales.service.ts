import api from '@/lib/api';
import type { Sale, Paginated } from '@/types';

export interface SaleFilters {
  from?:       string;
  to?:         string;
  customerId?: string;
  estado?:     string;
  page?:       number;
  limit?:      number;
}

export interface SaleItemInput {
  productId:      string;
  cantidad:       number;
  precioUnitario: number;
  descuento?:     number;
}

export interface SalePaymentInput {
  paymentMethodId: string;
  monto:           number;
  referencia?:     string;
}

export interface CreateSaleData {
  customerId?:    string;
  cashSessionId?: string;
  tipoVenta:      'contado' | 'credito';
  items:          SaleItemInput[];
  payments:       SalePaymentInput[];
  descuentoGlobal?: number;
  observaciones?: string;
}

export const salesService = {
  getAll: (filters: SaleFilters = {}) =>
    api.get<Paginated<Sale>>('/sales', { params: filters }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<Sale>(`/sales/${id}`).then((r) => r.data),

  getSummary: (period: 'today' | 'week' | 'month' | 'year' = 'today') =>
    api.get('/sales/summary', { params: { period } }).then((r) => r.data),

  getDailySeries: (days = 30) =>
    api.get('/sales/daily-series', { params: { days } }).then((r) => r.data),

  create: (data: CreateSaleData) =>
    api.post<Sale>('/sales', data).then((r) => r.data),

  cancel: (id: string, motivo: string) =>
    api.patch<Sale>(`/sales/${id}/cancel`, { motivo }).then((r) => r.data),

  getPaymentMethods: () =>
    api.get('/sales/payment-methods').then((r) => r.data),

  getPendingCredit: (page = 1, limit = 50) =>
    api.get('/sales/pending-credit', { params: { page, limit } }).then((r) => r.data),

  registerCreditPayment: (id: string, data: { monto: number; paymentMethodId: string; referencia?: string }) =>
    api.post(`/sales/${id}/credit-payment`, data).then((r) => r.data),

  processReturn: (id: string, data: { items: { saleItemId: string; cantidad: number }[]; motivo: string }) =>
    api.post(`/sales/${id}/return`, data).then((r) => r.data),
};
