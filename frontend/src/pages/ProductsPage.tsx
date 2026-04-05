import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Search, Pencil, ToggleLeft, ToggleRight,
  AlertTriangle, Package, ChevronLeft, ChevronRight,
  Tag, Trash2, RefreshCw, Barcode, Download, Printer,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';

import { productsService } from '@/services/products.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Product, ProductCategory } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

// ── Esquema del formulario ────────────────────────────────────────────────────

// Usamos strings para campos numéricos y convertimos en onSubmit
// (evita incompatibilidades z.coerce/valueAsNumber con zodResolver en Zod v4)
const schema = z.object({
  nombre:        z.string().min(1, 'El nombre es requerido').max(200),
  codigoInterno: z.string().optional(),
  codigoBarras:  z.string().optional(),
  descripcion:   z.string().optional(),
  categoryId:    z.string().optional(),
  unidadMedida:  z.string().optional(),
  precioCompra:  z.string().optional(),
  precioVenta:   z.string().min(1, 'El precio de venta es requerido'),
  igvTipo:       z.enum(['gravado', 'exonerado', 'inafecto']),
  stockMinimo:   z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ── Generador de código de barras EAN-13 ──────────────────────────────────────

function generateEAN13(): string {
  // Prefijo 775 (Perú asignado por GS1)
  const prefix = '775';
  const body   = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  const raw    = prefix + body;                      // 12 dígitos
  const digits = raw.split('').map(Number);
  // Checksum EAN-13: posiciones impares ×1, pares ×3
  const sum    = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check  = (10 - (sum % 10)) % 10;
  return raw + check;
}

// ── Modal de código de barras ─────────────────────────────────────────────────

function BarcodeModal({ open, onClose, product }: {
  open: boolean; onClose: () => void; product: Product | null;
}) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const [qty, setQty] = useState(1);
  const code = product?.codigoBarras ?? product?.codigoInterno ?? '';

  useEffect(() => {
    if (!open || !svgRef.current || !code) return;
    try {
      JsBarcode(svgRef.current, code, {
        format:      'CODE128',
        width:       2,
        height:      80,
        displayValue: true,
        fontSize:    14,
        margin:      10,
        background:  '#ffffff',
        lineColor:   '#000000',
      });
    } catch { /* código inválido */ }
  }, [open, code]);

  const downloadPNG = useCallback(() => {
    if (!svgRef.current) return;
    const svg    = svgRef.current;
    const xml    = new XMLSerializer().serializeToString(svg);
    const blob   = new Blob([xml], { type: 'image/svg+xml' });
    const url    = URL.createObjectURL(blob);
    // Convertir SVG → Canvas → PNG
    const img    = new Image();
    img.onload   = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = svg.width.baseVal.value * 2;
      canvas.height = svg.height.baseVal.value * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href     = canvas.toDataURL('image/png');
      a.download = `barcode-${code}.png`;
      a.click();
    };
    img.src = url;
  }, [code]);

  const printLabels = useCallback(() => {
    if (!svgRef.current) return;
    const xml  = new XMLSerializer().serializeToString(svgRef.current);
    const b64  = btoa(unescape(encodeURIComponent(xml)));
    const labelHtml = `<img src="data:image/svg+xml;base64,${b64}" style="width:180px;display:block"/>
      <p style="font-size:11px;text-align:center;margin:2px 0 0;font-family:sans-serif">${product?.nombre ?? ''}</p>`;
    const grid = Array.from({ length: qty }, () =>
      `<div style="display:inline-block;border:1px dashed #ccc;padding:6px;margin:4px;vertical-align:top">${labelHtml}</div>`
    ).join('');
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Etiquetas — ${product?.nombre}</title>
      <style>body{margin:16px;font-family:sans-serif}@media print{body{margin:0}}</style></head>
      <body><div>${grid}</div><script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
    win.document.close();
  }, [code, qty, product]);

  if (!product) return null;

  return (
    <Modal open={open} onClose={onClose} title="Código de barras" size="sm">
      <div className="flex flex-col items-center gap-4">
        {code ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-4 w-full flex justify-center">
              <svg ref={svgRef} />
            </div>

            <p className="text-sm text-slate-600 text-center font-medium">{product.nombre}</p>

            {/* Cantidad de etiquetas */}
            <div className="flex items-center gap-3 w-full">
              <label className="text-sm text-slate-600 whitespace-nowrap">Cantidad de etiquetas:</label>
              <input
                type="number" min={1} max={100} value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 w-full">
              <Button variant="outline" icon={<Download size={15} />} onClick={downloadPNG} className="flex-1">
                Descargar PNG
              </Button>
              <Button icon={<Printer size={15} />} onClick={printLabels} className="flex-1">
                Imprimir {qty} etiqueta{qty !== 1 ? 's' : ''}
              </Button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-slate-400 text-sm">
            Este producto no tiene código de barras asignado.
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Badge de stock ────────────────────────────────────────────────────────────

function StockBadge({ product }: { product: Product }) {
  const stock    = Number(product.stockActual);
  const minStock = Number(product.stockMinimo);
  const isCrit   = stock <= minStock;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${isCrit ? 'text-red-600' : 'text-slate-700'}`}>
      {isCrit && <AlertTriangle size={11} />}
      {formatNumber(stock)}
    </span>
  );
}

// ── Modal de producto ─────────────────────────────────────────────────────────

interface ProductModalProps {
  open:       boolean;
  onClose:    () => void;
  product?:   Product | null;
  categories: ProductCategory[];
}

function ProductModal({ open, onClose, product, categories }: ProductModalProps) {
  const qc = useQueryClient();
  const isEdit = !!product;

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: product
        ? {
            nombre:        product.nombre,
            codigoInterno: product.codigoInterno ?? '',
            codigoBarras:  product.codigoBarras  ?? '',
            descripcion:   product.descripcion   ?? '',
            categoryId:    product.category?.id  ?? '',
            unidadMedida:  product.unidadMedida  ?? '',
            precioCompra:  product.precioCompra != null ? String(product.precioCompra) : '',
            precioVenta:   String(product.precioVenta),
            igvTipo:       product.igvTipo ?? 'gravado',
            stockMinimo:   String(product.stockMinimo ?? 0),
          }
        : { igvTipo: 'gravado' as const, precioVenta: '', precioCompra: '', stockMinimo: '' },
    });

  // Auto-generar EAN-13 al abrir el modal de creación
  useEffect(() => {
    if (open && !isEdit) {
      setValue('codigoBarras', generateEAN13());
    }
  }, [open, isEdit, setValue]);

  const createMut = useMutation({
    mutationFn: productsService.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); handleClose(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof productsService.update>[1] }) =>
      productsService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); handleClose(); },
  });

  const handleClose = () => { reset(); onClose(); };

  const onSubmit = (data: FormData) => {
    const clean: Parameters<typeof productsService.create>[0] = {
      nombre:        data.nombre,
      igvTipo:       data.igvTipo,
      precioVenta:   parseFloat(data.precioVenta),
      precioCompra:  data.precioCompra  ? parseFloat(data.precioCompra)  : undefined,
      stockMinimo:   data.stockMinimo   ? parseFloat(data.stockMinimo)   : undefined,
      codigoInterno: data.codigoInterno || undefined,
      codigoBarras:  data.codigoBarras  || undefined,
      descripcion:   data.descripcion   || undefined,
      categoryId:    data.categoryId    || undefined,
      unidadMedida:  data.unidadMedida  || undefined,
    };
    if (isEdit && product) {
      updateMut.mutate({ id: product.id, data: clean });
    } else {
      createMut.mutate(clean);
    }
  };

  const error = createMut.error || updateMut.error;
  const errMsg = (error as any)?.response?.data?.message;

  const catOptions = [
    ...categories.map((c) => ({ value: c.id, label: c.nombre })),
  ];

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Editar Producto' : 'Nuevo Producto'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting || createMut.isPending || updateMut.isPending}
          >
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {errMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {Array.isArray(errMsg) ? errMsg.join(', ') : errMsg}
          </div>
        )}

        {/* Fila 1 */}
        <Input label="Nombre *" placeholder="Ej: Arroz extra" error={errors.nombre?.message} {...register('nombre')} />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Código interno" placeholder="Ej: PROD-001" {...register('codigoInterno')} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Código de barras (EAN-13)</label>
            <div className="flex gap-2">
              <input
                {...register('codigoBarras')}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="7750000000000"
              />
              <button
                type="button"
                onClick={() => setValue('codigoBarras', generateEAN13())}
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-colors"
                title="Generar nuevo código"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Categoría"
            options={catOptions}
            placeholder="— Sin categoría —"
            {...register('categoryId')}
          />
          <Input label="Unidad de medida" placeholder="Ej: kg, und, caja" {...register('unidadMedida')} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Precio compra (S/)"
            type="number" step="0.0001" min="0"
            placeholder="0.00"
            error={errors.precioCompra?.message}
            {...register('precioCompra')}
          />
          <Input
            label="Precio venta (S/) *"
            type="number" step="0.0001" min="0"
            placeholder="0.00"
            error={errors.precioVenta?.message}
            {...register('precioVenta')}
          />
          <Select
            label="Tipo IGV *"
            options={[
              { value: 'gravado',   label: 'Gravado (18%)' },
              { value: 'exonerado', label: 'Exonerado' },
              { value: 'inafecto',  label: 'Inafecto' },
            ]}
            error={errors.igvTipo?.message}
            {...register('igvTipo')}
          />
        </div>

        <Input
          label="Stock mínimo"
          type="number" step="0.01" min="0"
          placeholder="0"
          error={errors.stockMinimo?.message}
          {...register('stockMinimo')}
        />

        <Textarea
          label="Descripción"
          placeholder="Descripción opcional del producto..."
          {...register('descripcion')}
        />
      </form>
    </Modal>
  );
}

// ── Modal de categorías ───────────────────────────────────────────────────────

function CategoriesModal({ open, onClose, categories }: {
  open: boolean; onClose: () => void; categories: ProductCategory[];
}) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [err, setErr] = useState('');
  const canEdit = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'almacenero']));
  const isAdmin = useAuthStore((s) => s.hasRole('administrador'));

  const createMut = useMutation({
    mutationFn: () => productsService.createCategory(nombre.trim()),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['categories'] }); setNombre(''); setErr(''); },
    onError:    (e: any) => setErr(e?.response?.data?.message ?? 'Error al crear'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => productsService.deleteCategory(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  return (
    <Modal open={open} onClose={onClose} title="Categorías de Producto" size="sm">
      {canEdit && (
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Nueva categoría..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={err}
          />
          <Button
            onClick={() => nombre.trim() && createMut.mutate()}
            loading={createMut.isPending}
            icon={<Plus size={16} />}
            className="flex-shrink-0"
          >
            Agregar
          </Button>
        </div>
      )}

      <ul className="space-y-1.5">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Tag size={14} className="text-slate-400" />
              {c.nombre}
            </div>
            {isAdmin && (
              <button
                onClick={() => deleteMut.mutate(c.id)}
                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Eliminar categoría"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">Sin categorías</p>
        )}
      </ul>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const LIMIT = 20;

export default function ProductsPage() {
  const qc        = useQueryClient();
  const canEdit   = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'almacenero']));

  // Filtros
  const [search, setSearch]       = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activeFilter, setActive] = useState<'' | 'true' | 'false'>('true');
  const [page, setPage]           = useState(1);

  // Modales
  const [prodModal, setProdModal]     = useState(false);
  const [catModal, setCatModal]       = useState(false);
  const [barcodeModal, setBarcodeModal] = useState(false);
  const [editing, setEditing]         = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);

  // Queries
  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn:  productsService.getCategories,
    staleTime: 10 * 60 * 1000,   // categorías cambian poco: 10 min
  });
  const categories = catData ?? [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', { search, categoryId, activeFilter, page }],
    queryFn:  () => productsService.getAll({
      search:     search || undefined,
      categoryId: categoryId || undefined,
      isActive:   activeFilter === '' ? undefined : activeFilter === 'true',
      page,
      limit: LIMIT,
    }),
    staleTime: 60_000,           // 1 min: suficiente para navegar sin recargar
    placeholderData: (prev) => prev,  // muestra datos anteriores mientras carga el nuevo filtro
  });

  // Toggle activo/inactivo
  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      productsService.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const openCreate  = () => { setEditing(null); setProdModal(true); };
  const openEdit    = (p: Product) => { setEditing(p); setProdModal(true); };
  const openBarcode = (p: Product) => { setBarcodeProduct(p); setBarcodeModal(true); };

  const products  = data?.data ?? [];
  const total     = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      {/* ── Barra de acciones ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar producto, código..."
            icon={<Search size={15} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Select
          options={[
            { value: '', label: 'Todas las categorías' },
            ...categories.map((c) => ({ value: c.id, label: c.nombre })),
          ]}
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          className="w-44"
        />

        <Select
          options={[
            { value: 'true',  label: 'Activos' },
            { value: 'false', label: 'Inactivos' },
            { value: '',      label: 'Todos' },
          ]}
          value={activeFilter}
          onChange={(e) => { setActive(e.target.value as '' | 'true' | 'false'); setPage(1); }}
          className="w-32"
        />

        <Button variant="outline" icon={<Tag size={16} />} onClick={() => setCatModal(true)}>
          Categorías
        </Button>

        {canEdit && (
          <Button icon={<Plus size={16} />} onClick={openCreate}>
            Nuevo Producto
          </Button>
        )}
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────── */}
      <Card padding="none">
        {/* Resumen */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
          <Package size={16} className="text-slate-400" />
          <span className="text-sm text-slate-600">
            <strong>{total}</strong> producto(s) encontrado(s)
          </span>
          {isFetching && !isLoading && (
            <Spinner size="sm" className="ml-1 text-slate-400" />
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Código</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Producto</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Categoría</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Stock</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Mín.</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">P. Compra</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">P. Venta</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">IGV</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Estado</th>
                {canEdit && (
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400 text-sm">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isCrit = Number(p.stockActual) <= Number(p.stockMinimo);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-500">
                          {p.codigoInterno ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800">{p.nombre}</p>
                          {p.descripcion && (
                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{p.descripcion}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.category ? (
                          <Badge variant="info">{p.category.nombre}</Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StockBadge product={p} />
                        {p.unidadMedida && (
                          <span className="ml-1 text-xs text-slate-400">{p.unidadMedida}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {formatNumber(Number(p.stockMinimo))}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {p.precioCompra ? formatCurrency(Number(p.precioCompra)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(Number(p.precioVenta))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={
                            p.igvTipo === 'gravado'   ? 'default' :
                            p.igvTipo === 'exonerado' ? 'success' : 'warning'
                          }
                        >
                          {p.igvTipo === 'gravado' ? '18%' : p.igvTipo}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.isActive ? (
                          <Badge variant="success">Activo</Badge>
                        ) : (
                          <Badge variant="outline">Inactivo</Badge>
                        )}
                        {isCrit && p.isActive && (
                          <div className="mt-1">
                            <Badge variant="danger">Stock crítico</Badge>
                          </div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openBarcode(p)}
                              className="p-1.5 rounded-lg hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors"
                              title="Ver código de barras"
                            >
                              <Barcode size={15} />
                            </button>
                            <button
                              onClick={() => openEdit(p)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => toggleMut.mutate({ id: p.id, isActive: !p.isActive })}
                              className={`p-1.5 rounded-lg transition-colors ${
                                p.isActive
                                  ? 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                                  : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                              }`}
                              title={p.isActive ? 'Desactivar' : 'Activar'}
                            >
                              {p.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                icon={<ChevronLeft size={14} />}
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              />
              <Button
                variant="outline"
                size="sm"
                icon={<ChevronRight size={14} />}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* ── Modales ───────────────────────────────────────────────────── */}
      <ProductModal
        open={prodModal}
        onClose={() => { setProdModal(false); setEditing(null); }}
        product={editing}
        categories={categories}
      />

      <CategoriesModal
        open={catModal}
        onClose={() => setCatModal(false)}
        categories={categories}
      />

      <BarcodeModal
        open={barcodeModal}
        onClose={() => { setBarcodeModal(false); setBarcodeProduct(null); }}
        product={barcodeProduct}
      />
    </div>
  );
}
