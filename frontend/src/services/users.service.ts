import api from '@/lib/api';
import type { User } from '@/types';

export interface CreateUserData {
  nombre:    string;
  apellido:  string;
  email:     string;
  password:  string;
  roleId:    string;
}

export const usersService = {
  getAll: () =>
    api.get<User[]>('/users').then((r) => r.data),

  getRoles: () =>
    api.get<{ id: string; name: string }[]>('/users/roles').then((r) => r.data),

  create: (data: CreateUserData) =>
    api.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: Partial<Omit<CreateUserData, 'password'>> & { isActive?: boolean }) =>
    api.put<User>(`/users/${id}`, data).then((r) => r.data),

  toggleActive: (id: string, isActive: boolean) =>
    api.patch<User>(`/users/${id}/toggle-active`, { isActive }).then((r) => r.data),
};
