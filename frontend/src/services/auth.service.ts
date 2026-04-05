import api from '@/lib/api';
import type { LoginResponse } from '@/types';

export const authService = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }).then((r) => r.data),

  logout: () =>
    api.post('/auth/logout').catch(() => {}),

  me: () =>
    api.get('/auth/me').then((r) => r.data),
};
