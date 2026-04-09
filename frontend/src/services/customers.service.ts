import api from '@/lib/api';
import type { Customer, Paginated } from '@/types';

export interface CustomerFilters { search?: string; page?: number; limit?: number }

export interface CreateCustomerData {
  nombreCompleto:  string;
  tipoDocumento:   string;
  numeroDocumento: string;
  telefono?:       string;
  email?:          string;
  direccion?:      string;
  creditoLimite?:  number;
}

export const customersService = {
  getAll: (filters: CustomerFilters = {}) =>
    api.get<Paginated<Customer>>('/customers', { params: filters }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<Customer>(`/customers/${id}`).then((r) => r.data),

  getHistorial: (id: string) =>
    api.get(`/customers/${id}/historial`).then((r) => r.data),

  getRanking: () =>
    api.get('/customers/ranking').then((r) => r.data),

  getDeudores: () =>
    api.get('/customers/deudores').then((r) => r.data),

  create: (data: CreateCustomerData) =>
    api.post<Customer>('/customers', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateCustomerData>) =>
    api.put<Customer>(`/customers/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.patch(`/customers/${id}/deactivate`),
};
