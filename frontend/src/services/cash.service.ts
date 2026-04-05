import api from '@/lib/api';
import type { CashSession } from '@/types';

export const cashService = {
  getActive: () =>
    api.get<CashSession | null>('/cash/active').then((r) => r.data).catch(() => null),

  getSessions: (page = 1, limit = 20) =>
    api.get('/cash/sessions', { params: { page, limit } }).then((r) => r.data),

  getArqueo: (sessionId: string) =>
    api.get(`/cash/${sessionId}/arqueo`).then((r) => r.data),

  open: (montoApertura: number, observaciones?: string) =>
    api.post<CashSession>('/cash/open', { montoApertura, observaciones }).then((r) => r.data),

  close: (sessionId: string, montoCierreReal: number, observaciones?: string) =>
    api.post<CashSession>(`/cash/${sessionId}/close`, { montoCierreReal, observaciones }).then((r) => r.data),

  addMovement: (sessionId: string, data: {
    tipo:        'ingreso' | 'egreso';
    monto:       number;
    concepto:    string;
    referencia?: string;
  }) => api.post(`/cash/${sessionId}/movements`, data).then((r) => r.data),
};
