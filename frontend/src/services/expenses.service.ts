import api from '@/lib/api';
import type { Expense, ExpenseCategory, Paginated } from '@/types';

export interface ExpenseFilters { from?: string; to?: string; categoryId?: string; page?: number; limit?: number }

export interface CreateExpenseData {
  descripcion:  string;
  monto:        number;
  fecha:        string;
  categoryId?:  string;
  observaciones?: string;
}

export const expensesService = {
  getCategories: () =>
    api.get<ExpenseCategory[]>('/expenses/categories').then((r) => r.data),

  createCategory: (nombre: string) =>
    api.post<ExpenseCategory>('/expenses/categories', { nombre }).then((r) => r.data),

  getSummary: (from?: string, to?: string) =>
    api.get('/expenses/summary', { params: { from, to } }).then((r) => r.data),

  getAll: (filters: ExpenseFilters = {}) =>
    api.get<Paginated<Expense>>('/expenses', { params: filters }).then((r) => r.data),

  create: (data: CreateExpenseData) =>
    api.post<Expense>('/expenses', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateExpenseData>) =>
    api.put<Expense>(`/expenses/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/expenses/${id}`),
};
