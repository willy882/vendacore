import api from '@/lib/api';

export const inventoryService = {
  getKardex: (productId: string, from?: string, to?: string) =>
    api.get(`/inventory/${productId}/kardex`, { params: { from, to } }).then((r) => r.data),

  getValorizado: () =>
    api.get('/inventory/valorizado').then((r) => r.data),

  getRotacion: (days = 30) =>
    api.get('/inventory/rotacion', { params: { days } }).then((r) => r.data),

  adjust: (data: {
    productId:      string;
    tipo:           'ajuste_entrada' | 'ajuste_salida';
    cantidad:       number;
    observaciones?: string;
    costoUnitario?: number;
  }) => api.post('/inventory/adjustments', data).then((r) => r.data),
};
