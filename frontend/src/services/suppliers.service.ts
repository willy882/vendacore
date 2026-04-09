import api from '@/lib/api';
import type { Supplier, Paginated } from '@/types';

export interface CreateSupplierData {
  razonSocial:      string;
  ruc?:             string;
  nombreContacto?:  string;
  telefono?:        string;
  email?:           string;
  direccion?:       string;
}

export const suppliersService = {
  getAll: (search?: string, page = 1, limit = 50) =>
    api.get<Paginated<Supplier>>('/suppliers', { params: { search, page, limit } }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<Supplier>(`/suppliers/${id}`).then((r) => r.data),

  getHistorial: (id: string) =>
    api.get(`/suppliers/${id}/historial`).then((r) => r.data),

  getDeudas: () =>
    api.get('/suppliers/deudas').then((r) => r.data),

  create: (data: CreateSupplierData) =>
    api.post<Supplier>('/suppliers', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateSupplierData>) =>
    api.put<Supplier>(`/suppliers/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.patch(`/suppliers/${id}/deactivate`),
};
