import api from '@/lib/api';
import type { Product, ProductCategory, Paginated } from '@/types';

export interface ProductFilters {
  search?:     string;
  categoryId?: string;
  isActive?:   boolean;
  lowStock?:   boolean;
  page?:       number;
  limit?:      number;
}

export interface CreateProductData {
  nombre:        string;
  codigoInterno?: string;
  codigoBarras?:  string;
  descripcion?:   string;
  categoryId?:    string;
  unidadMedida?:  string;
  precioCompra?:  number;
  precioVenta:    number;
  igvTipo?:       'gravado' | 'exonerado' | 'inafecto';
  stockMinimo?:   number;
  stockInicial?:  number;
  imagenUrl?:     string;
}

export type UpdateProductData = Partial<CreateProductData> & { isActive?: boolean };

export const productsService = {
  // Categorías
  getCategories: () =>
    api.get<ProductCategory[]>('/products/categories').then((r) => r.data),

  createCategory: (nombre: string, descripcion?: string) =>
    api.post<ProductCategory>('/products/categories', { nombre, descripcion }).then((r) => r.data),

  updateCategory: (id: string, nombre: string, descripcion?: string) =>
    api.put<ProductCategory>(`/products/categories/${id}`, { nombre, descripcion }).then((r) => r.data),

  deleteCategory: (id: string) =>
    api.delete(`/products/categories/${id}`),

  // Alertas
  getLowStock: () =>
    api.get<Product[]>('/products/alerts/low-stock').then((r) => r.data),

  // Productos
  getAll: (filters: ProductFilters = {}) => {
    const params: Record<string, unknown> = { ...filters };
    if (params.isActive === undefined) delete params.isActive;
    return api.get<Paginated<Product>>('/products', { params }).then((r) => r.data);
  },

  getOne: (id: string) =>
    api.get<Product>(`/products/${id}`).then((r) => r.data),

  create: (data: CreateProductData) =>
    api.post<Product>('/products', data).then((r) => r.data),

  update: (id: string, data: UpdateProductData) =>
    api.put<Product>(`/products/${id}`, data).then((r) => r.data),

  toggleActive: (id: string, isActive: boolean) =>
    api.patch<Product>(`/products/${id}/toggle-active`, { isActive }).then((r) => r.data),
};
