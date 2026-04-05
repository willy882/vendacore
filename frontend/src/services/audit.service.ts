import api from '@/lib/api';
import type { AuditLog, Paginated } from '@/types';

export interface AuditFilters {
  modulo?:  string;
  accion?:  string;
  entidad?: string;
  userId?:  string;
  from?:    string;
  to?:      string;
  search?:  string;
  page?:    number;
  limit?:   number;
}

export const auditService = {
  getAll: (filters: AuditFilters = {}) =>
    api.get<Paginated<AuditLog>>('/audit', { params: filters }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<AuditLog>(`/audit/${id}`).then((r) => r.data),

  getStats: (days = 30) =>
    api.get('/audit/stats', { params: { days } }).then((r) => r.data),

  getFilters: () =>
    api.get<{ modulos: string[]; acciones: string[]; entidades: string[] }>('/audit/filters').then((r) => r.data),

  getEntityHistory: (entidad: string, entidadId: string) =>
    api.get<AuditLog[]>(`/audit/entity/${entidad}/${entidadId}`).then((r) => r.data),
};
