import api from '@/lib/api';
import type { Purchase, Paginated } from '@/types';

export interface PurchaseFilters { supplierId?: string; from?: string; to?: string; page?: number; limit?: number }

export interface CreatePurchaseData {
  supplierId:       string;
  fecha:            string;
  tipoDocumento?:   string;
  numeroDocumento?: string;
  estadoPago?:      'pendiente' | 'parcial' | 'pagado';
  observaciones?:   string;
  items: { productId: string; cantidad: number; costoUnitario: number }[];
}

export const purchasesService = {
  getAll: (filters: PurchaseFilters = {}) =>
    api.get<Paginated<Purchase>>('/purchases', { params: filters }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<Purchase>(`/purchases/${id}`).then((r) => r.data),

  getPending: () =>
    api.get<Purchase[]>('/purchases/pending-payments').then((r) => r.data),

  create: (data: CreatePurchaseData) =>
    api.post<Purchase>('/purchases', data).then((r) => r.data),

  markPaid: (id: string) =>
    api.patch<Purchase>(`/purchases/${id}/mark-paid`).then((r) => r.data),
};
