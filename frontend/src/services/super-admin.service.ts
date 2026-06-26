import api from '@/lib/api';

export interface Plan {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  duracionDias: number;
  isActive: boolean;
}

export interface BusinessSubscription {
  id: string;
  planId?: string;
  plan?: Plan;
  estado: 'pendiente' | 'activo' | 'suspendido' | 'cancelado';
  fechaInicio?: string;
  fechaFin?: string;
  montoPagado: number;
  notas?: string;
}

export interface BusinessWithSub {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  email?: string;
  telefono?: string;
  status: 'pendiente' | 'activo' | 'suspendido' | 'cancelado';
  createdAt: string;
  subscription?: BusinessSubscription;
  users: {
    id: string; nombre: string; apellido: string; email: string;
    isActive: boolean; role: { name: string };
  }[];
}

export const superAdminService = {
  getOverview: () =>
    api.get('/super-admin/overview').then((r) => r.data as {
      total: number; activos: number; pendientes: number; suspendidos: number;
    }),

  getBusinesses: () =>
    api.get('/super-admin/businesses').then((r) => r.data as BusinessWithSub[]),

  activateBusiness: (id: string, body: {
    planId?: string;
    duracionDias?: number;
    montoPagado?: number;
    metodoPago?: string;
    referenciaPago?: string;
    notas?: string;
  }) =>
    api.post(`/super-admin/businesses/${id}/activate`, body).then((r) => r.data),

  updateBusinessStatus: (id: string, body: { status: string; notas?: string }) =>
    api.patch(`/super-admin/businesses/${id}/status`, body).then((r) => r.data),

  getPlans: () =>
    api.get('/super-admin/plans').then((r) => r.data as Plan[]),

  createPlan: (body: { nombre: string; descripcion?: string; precio: number; duracionDias?: number }) =>
    api.post('/super-admin/plans', body).then((r) => r.data as Plan),

  updatePlan: (id: string, body: Partial<{ nombre: string; descripcion: string; precio: number; duracionDias: number; isActive: boolean }>) =>
    api.patch(`/super-admin/plans/${id}`, body).then((r) => r.data as Plan),
};
