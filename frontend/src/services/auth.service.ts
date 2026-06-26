import api from '@/lib/api';
import type { LoginResponse } from '@/types';

export interface RegisterData {
  nombreNegocio: string;
  ruc: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  telefono?: string;
}

export const authService = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),

  register: (data: RegisterData) =>
    api.post<{ message: string }>('/auth/register', data).then((r) => r.data),

  logout: () =>
    api.post('/auth/logout').catch(() => {}),

  me: () =>
    api.get('/auth/me').then((r) => r.data),
};
