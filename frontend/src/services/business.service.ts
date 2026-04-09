import api from '@/lib/api';

export interface BusinessInfo {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  logoUrl?: string;
  nubefactToken?: string;
  sunatMode?: string;
}

export interface PaymentMethod {
  id: string;
  nombre: string;
  tipo: string;
  isActive: boolean;
}

export const businessService = {
  getMe: () => api.get<BusinessInfo>('/business/me').then((r) => r.data),

  updateMe: (data: Partial<BusinessInfo>) =>
    api.patch<BusinessInfo>('/business/me', data).then((r) => r.data),

  getPaymentMethods: () =>
    api.get<PaymentMethod[]>('/business/payment-methods').then((r) => r.data),

  updatePaymentMethod: (id: string, data: { nombre?: string; isActive?: boolean }) =>
    api.patch<PaymentMethod>(`/business/payment-methods/${id}`, data).then((r) => r.data),

  createPaymentMethod: (nombre: string, tipo: string) =>
    api.post<PaymentMethod>('/business/payment-methods', { nombre, tipo }).then((r) => r.data),
};