import api from '@/lib/api';
import type { Customer } from '@/types';

export interface CustomerFilters { search?: string; page?: number; limit?: number }

export interface CreateCustomerData {
  nombreCompleto:  string;
  tipoDocumento?:  string;
  numeroDocumento?: string;
  razonSocial?:    string;
  telefono?:       string;
  email?:          string;
  direccion?:      string;
  distrito?:       string;
  departamento?:   string;
  provincia?:      string;
  ubigeo?:         string;
  referencia?:     string;
  nota?:           string;
  creditoLimite?:  number;
}

export interface CustomerStats { total: number; activos: number; inactivos: number; }
export interface CustomerPage  { data: Customer[]; total: number; page: number; limit: number; totalPages: number; }

export interface LookupResult {
  source:          string;
  nombreCompleto:  string;
  razonSocial?:    string;
  tipoDocumento:   string;
  numeroDocumento: string;
  telefono?:       string;
  email?:          string;
  direccion?:      string;
  distrito?:       string;
  departamento?:   string;
  provincia?:      string;
  ubigeo?:         string;
}

export const customersService = {
  getStats: () =>
    api.get<CustomerStats>('/customers/stats').then((r) => r.data),

  getAll: (filters: CustomerFilters = {}) =>
    api.get<CustomerPage>('/customers', { params: filters }).then((r) => r.data),

  lookup: (tipo: string, numero: string) =>
    api.get<LookupResult>(`/customers/lookup`, { params: { tipo, numero } }).then((r) => r.data),

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

  upsert: (data: CreateCustomerData) =>
    api.post<Customer>('/customers/upsert', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateCustomerData>) =>
    api.put<Customer>(`/customers/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.patch(`/customers/${id}/deactivate`),
};
