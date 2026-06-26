import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Search, Pencil,
  AlertTriangle, Package, ChevronLeft, ChevronRight,
  Tag, Trash2, RefreshCw, Barcode, Download, Printer, Check, X, QrCode, Camera,
  Settings, TrendingUp, SlidersHorizontal, FileDown, BarChart2,
  Upload, FileSpreadsheet, FileText, Users, Layers,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

import { productsService } from '@/services/products.service';
import { customersService } from '@/services/customers.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import {} from '@/lib/utils';
import type { Product, ProductCategory } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
import { useFormPersist } from '@/hooks/useFormPersist';

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
  stockInicial:  z.string().optional(),
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

// ── Compresor de imagen de producto ──────────────────────────────────────────

function compressProductImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Si pesa menos de 3 MB, leer directamente sin tocar la imagen
    if (file.size <= 3 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    // Solo redimensionar si es muy grande (>3 MB)
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1800;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = file.type === 'image/png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', 0.95);
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Visor de imagen ───────────────────────────────────────────────────────────

function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-slate-600 hover:text-slate-900 z-10"
        >
          <X size={16} />
        </button>
        <img src={src} alt={alt} className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
        <p className="text-center text-white/80 text-sm mt-3">{alt}</p>
      </div>
    </div>
  );
}

// ── Modal de código de barras / QR ───────────────────────────────────────────

function BarcodeModal({ open, onClose, product }: {
  open: boolean; onClose: () => void; product: Product | null;
}) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<'barcode' | 'qr'>('barcode');
  const [qty, setQty] = useState(1);

  // El código que se usa: codigoBarras → codigoInterno → id del producto
  const code = product?.codigoBarras ?? product?.codigoInterno ?? product?.id ?? '';
  // QR siempre usa el mismo valor que está guardado → determinístico por producto
  const qrValue = product?.codigoBarras ?? product?.codigoInterno ?? product?.id ?? '';

  // Barcode 1D
  useEffect(() => {
    if (!open || tab !== 'barcode' || !svgRef.current || !code) return;
    try {
      JsBarcode(svgRef.current, code, {
        format:       'CODE128',
        width:        2,
        height:       80,
        displayValue: true,
        fontSize:     14,
        margin:       10,
        background:   '#ffffff',
        lineColor:    '#000000',
      });
    } catch { /* código inválido */ }
  }, [open, tab, code]);

  // QR 2D — siempre la misma cadena → mismo QR para el mismo producto
  useEffect(() => {
    if (!open || tab !== 'qr' || !canvasRef.current || !qrValue) return;
    QRCode.toCanvas(canvasRef.current, qrValue, {
      width:          220,
      margin:         2,
      color:          { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(() => {/* error */ });
  }, [open, tab, qrValue]);

  const downloadBarcodePNG = useCallback(() => {
    if (!svgRef.current) return;
    const svg  = svgRef.current;
    const xml  = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
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

  const downloadQRPNG = useCallback(() => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href     = canvasRef.current.toDataURL('image/png');
    a.download = `qr-${product?.nombre ?? qrValue}.png`;
    a.click();
  }, [qrValue, product]);

  const printLabels = useCallback(() => {
    const isQR = tab === 'qr';
    let imgData = '';
    if (isQR) {
      imgData = canvasRef.current?.toDataURL('image/png') ?? '';
    } else {
      if (!svgRef.current) return;
      const xml = new XMLSerializer().serializeToString(svgRef.current);
      imgData = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
    }
    const labelHtml = `<img src="${imgData}" style="width:${isQR ? '120px' : '180px'};display:block"/>
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
  }, [tab, code, qty, product]);

  if (!product) return null;

  const hasCode = !!code;

  return (
    <Modal open={open} onClose={onClose} title="Código de producto" size="sm">
      {/* Tabs */}
      <div className="flex border border-slate-200 rounded-lg overflow-hidden mb-4">
        <button
          onClick={() => setTab('barcode')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
            tab === 'barcode' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Barcode size={15} /> Código de barras
        </button>
        <button
          onClick={() => setTab('qr')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
            tab === 'qr' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <QrCode size={15} /> Código QR
        </button>
      </div>

      <div className="flex flex-col items-center gap-4">
        {hasCode ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-4 w-full flex justify-center min-h-[120px] items-center">
              {tab === 'barcode' ? (
                <svg ref={svgRef} />
              ) : (
                <canvas ref={canvasRef} />
              )}
            </div>

            <p className="text-sm text-slate-600 text-center font-medium">{product.nombre}</p>
            <p className="text-xs text-slate-400 font-mono">{code}</p>

            <div className="flex items-center gap-3 w-full">
              <label className="text-sm text-slate-600 whitespace-nowrap">Cantidad de etiquetas:</label>
              <input
                type="number" min={1} max={100} value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                icon={<Download size={15} />}
                onClick={tab === 'barcode' ? downloadBarcodePNG : downloadQRPNG}
                className="flex-1"
              >
                Descargar PNG
              </Button>
              <Button icon={<Printer size={15} />} onClick={printLabels} className="flex-1">
                Imprimir {qty} etiqueta{qty !== 1 ? 's' : ''}
              </Button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-slate-400 text-sm">
            Este producto no tiene código asignado.
          </div>
        )}
      </div>
    </Modal>
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
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  // Sincronizar imagen al abrir/cambiar producto
  useEffect(() => {
    setImagenUrl(product?.imagenUrl ?? null);
  }, [open, product]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      values: (product
        ? {
            nombre:        product.nombre,
            codigoInterno: product.codigoInterno ?? '',
            codigoBarras:  product.codigoBarras  ?? '',
            descripcion:   product.descripcion   ?? '',
            categoryId:    product.category?.id  ?? '',
            unidadMedida:  product.unidadMedida  ?? '',
            precioCompra:  product.precioCompra != null ? String(product.precioCompra) : '',
            precioVenta:   String(product.precioVenta),
            igvTipo:       product.igvTipo ?? 'exonerado',
            stockMinimo:   String(product.stockMinimo ?? 0),
          }
        : { nombre: '', igvTipo: 'exonerado' as const, precioVenta: '', precioCompra: '', stockMinimo: '' }
      ) as FormData,
    });

  const { clearPersisted } = useFormPersist('productos', watch, reset, open, isEdit);

  // Auto-generar EAN-13 y forzar defaults al abrir el modal de creación
  // (corre después del restore de useFormPersist, sobreescribiendo valores obsoletos)
  useEffect(() => {
    if (open && !isEdit) {
      setValue('codigoBarras', generateEAN13());
      setValue('igvTipo', 'exonerado');
    }
  }, [open, isEdit, setValue]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgLoading(true);
    try {
      const dataUrl = await compressProductImage(file);
      setImagenUrl(dataUrl);
    } catch { /* ignorar */ }
    finally { setImgLoading(false); }
    e.target.value = '';
  };

  const createMut = useMutation({
    mutationFn: productsService.create,
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['products'] });
      handleClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof productsService.update>[1] }) =>
      productsService.update(id, data),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['products'] });
      handleClose();
    },
  });

  const handleClose = () => { clearPersisted(); reset(); setImagenUrl(null); onClose(); };

  const onSubmit = (data: FormData) => {
    const clean: Parameters<typeof productsService.create>[0] = {
      nombre:        data.nombre,
      igvTipo:       data.igvTipo,
      precioVenta:   parseFloat(data.precioVenta),
      precioCompra:  data.precioCompra  ? parseFloat(data.precioCompra)  : undefined,
      stockMinimo:   data.stockMinimo   ? parseFloat(data.stockMinimo)   : undefined,
      stockInicial:  (!isEdit && data.stockInicial) ? parseFloat(data.stockInicial) : undefined,
      codigoInterno: data.codigoInterno || undefined,
      codigoBarras:  data.codigoBarras  || undefined,
      descripcion:   data.descripcion   || undefined,
      categoryId:    data.categoryId    || undefined,
      unidadMedida:  data.unidadMedida  || undefined,
      imagenUrl:     imagenUrl ?? undefined,
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

        {/* Imagen del producto */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => imgInputRef.current?.click()}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 flex items-center justify-center cursor-pointer overflow-hidden bg-slate-50 transition-colors flex-shrink-0"
            title="Subir imagen"
          >
            {imgLoading ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : imagenUrl ? (
              <img src={imagenUrl} alt="producto" className="w-full h-full object-cover" />
            ) : (
              <Camera size={22} className="text-slate-400" />
            )}
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-600">Imagen del producto</p>
              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">OPCIONAL</span>
            </div>
            <p>Haz clic en el cuadro para subir una imagen.</p>
            <p>Se comprime a 200×200 px automáticamente.</p>
            {imagenUrl && (
              <button
                type="button"
                onClick={() => setImagenUrl(null)}
                className="text-red-500 hover:underline"
              >
                Eliminar imagen
              </button>
            )}
          </div>
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

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

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Stock mínimo"
            type="number" step="0.01" min="0"
            placeholder="0"
            error={errors.stockMinimo?.message}
            {...register('stockMinimo')}
          />
          {!isEdit && (
            <Input
              label="Stock inicial"
              type="number" step="0.01" min="0"
              placeholder="0"
              {...register('stockInicial')}
            />
          )}
        </div>

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
  const [nombre, setNombre]   = useState('');
  const [err, setErr]         = useState('');
  const [editId, setEditId]   = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [searchCat, setSearchCat]   = useState('');
  const canEdit = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'almacenero']));
  const isAdmin = useAuthStore((s) => s.hasRole('administrador'));

  const createMut = useMutation({
    mutationFn: () => productsService.createCategory(nombre.trim()),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['categories'] }); setNombre(''); setErr(''); },
    onError:    (e: any) => setErr(e?.response?.data?.message ?? 'Error al crear'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, n }: { id: string; n: string }) => productsService.updateCategory(id, n),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => productsService.deleteCategory(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['categories'] }); setConfirmDel(null); },
    onError:    (e: any) => { alert(e?.response?.data?.message ?? 'No se puede eliminar'); setConfirmDel(null); },
  });

  const startEdit = (c: ProductCategory) => { setEditId(c.id); setEditVal(c.nombre); };

  const filtered = categories.filter(c =>
    c.nombre.toLowerCase().includes(searchCat.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm page-fade">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Tag size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">Categorías</h2>
              <p className="text-[11px] text-zinc-400">{categories.length} categorías registradas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Formulario nueva categoría */}
        {canEdit && (
          <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/60">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Nueva categoría</p>
            <div className="flex gap-2">
              <input
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); setErr(''); }}
                onKeyDown={(e) => e.key === 'Enter' && nombre.trim() && createMut.mutate()}
                placeholder="Ej: Bebidas, Snacks, Lácteos..."
                className={`flex-1 px-3.5 py-2.5 text-sm border rounded-xl outline-none transition-all ${
                  err ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-zinc-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
                }`}
              />
              <button
                onClick={() => nombre.trim() && createMut.mutate()}
                disabled={!nombre.trim() || createMut.isPending}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                {createMut.isPending
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Plus size={15} strokeWidth={2.5} />
                }
                Agregar
              </button>
            </div>
            {err && <p className="text-xs text-red-500 mt-1.5">{err}</p>}
          </div>
        )}

        {/* Buscador si hay muchas */}
        {categories.length > 6 && (
          <div className="px-6 pt-3 pb-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                value={searchCat}
                onChange={e => setSearchCat(e.target.value)}
                placeholder="Buscar categoría..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                <Tag size={20} className="text-zinc-300" />
              </div>
              <p className="text-sm text-zinc-400 font-medium">
                {searchCat ? 'Sin resultados' : 'Agrega la primera categoría'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {filtered.map((c, idx) => (
                <div
                  key={c.id}
                  className="row-enter flex items-center gap-3 py-3 group"
                  style={{ animationDelay: `${idx * 25}ms` }}
                >
                  {/* Número de orden */}
                  <span className="w-6 text-center text-[11px] font-bold text-zinc-300 flex-shrink-0 tabular-nums">
                    {idx + 1}
                  </span>

                  {/* Edición inline / nombre */}
                  {editId === c.id ? (
                    <input
                      autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editVal.trim()) updateMut.mutate({ id: c.id, n: editVal.trim() });
                        if (e.key === 'Escape') setEditId(null);
                      }}
                      className="flex-1 text-sm px-3 py-1.5 border border-blue-400 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 font-medium"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-semibold text-zinc-800 truncate">{c.nombre}</span>
                  )}

                  {/* Acciones */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {editId === c.id ? (
                      <>
                        <button
                          onClick={() => editVal.trim() && updateMut.mutate({ id: c.id, n: editVal.trim() })}
                          disabled={updateMut.isPending}
                          className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors cursor-pointer"
                          title="Guardar"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors cursor-pointer"
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        {canEdit && (
                          <button
                            onClick={() => startEdit(c)}
                            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-50 text-zinc-400 hover:text-blue-600 transition-all cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          confirmDel === c.id ? (
                            <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                              <span className="text-[11px] text-red-600 font-medium">¿Eliminar?</span>
                              <button
                                onClick={() => deleteMut.mutate(c.id)}
                                disabled={deleteMut.isPending}
                                className="p-1 rounded text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => setConfirmDel(null)}
                                className="p-1 rounded text-zinc-400 hover:bg-zinc-100 transition-colors cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDel(c.id)}
                              className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-all cursor-pointer"
                              title="Eliminar categoría"
                            >
                              <Trash2 size={14} />
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 bg-zinc-50/40">
          <p className="text-[11px] text-zinc-400">
            {filtered.length !== categories.length
              ? `Mostrando ${filtered.length} de ${categories.length}`
              : `${categories.length} categorías en total`
            }
          </p>
          <button onClick={onClose} className="text-xs font-bold text-zinc-400 hover:text-zinc-700 tracking-widest transition-colors cursor-pointer">
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton cell ────────────────────────────────────────────────────────────

function SkeletonRow({ cols = 6 }: { cols?: number }) {
  const widths = ['w-16', 'w-28', 'w-48', 'w-12', 'w-20', 'w-10'];
  return (
    <tr className="border-b border-zinc-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className={`h-3.5 shimmer-line ${widths[i] ?? 'w-20'}`} />
        </td>
      ))}
    </tr>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <tr>
      <td colSpan={6}>
        <div className="flex flex-col items-center justify-center py-20 gap-4 page-fade">
          <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <Package size={28} className="text-zinc-400" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-700">
              {hasFilters ? 'Sin resultados para esta búsqueda' : 'Aún no hay productos'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {hasFilters ? 'Prueba ajustando los filtros o el término de búsqueda' : 'Crea el primer producto con el botón de arriba'}
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Modal de filtro avanzado ─────────────────────────────────────────────────

interface FiltrosAvanzados {
  estado:    '' | 'true' | 'false';
  conStock:  boolean | null;
  enVenta:   boolean | null;
  promo:     boolean | null;
}

const DEFAULT_FILTROS: FiltrosAvanzados = { estado: '', conStock: null, enVenta: null, promo: null };

interface FiltroAvanzadoModalProps {
  open:     boolean;
  onClose:  () => void;
  initial:  FiltrosAvanzados;
  onApply:  (f: FiltrosAvanzados) => void;
}

function YesNoToggle({
  value, onChange,
}: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex rounded-xl border border-zinc-200 overflow-hidden flex-shrink-0">
      <button
        onClick={() => onChange(value === true ? null : true)}
        className={`px-6 py-2 text-sm font-semibold transition-all cursor-pointer ${
          value === true ? 'bg-blue-50 text-blue-700 border-r border-blue-200' : 'bg-white text-zinc-500 border-r border-zinc-200 hover:bg-zinc-50'
        }`}
      >
        Sí
      </button>
      <button
        onClick={() => onChange(value === false ? null : false)}
        className={`px-6 py-2 text-sm font-semibold transition-all cursor-pointer ${
          value === false ? 'bg-blue-50 text-blue-700' : 'bg-white text-zinc-500 hover:bg-zinc-50'
        }`}
      >
        No
      </button>
    </div>
  );
}

function FiltroAvanzadoModal({ open, onClose, initial, onApply }: FiltroAvanzadoModalProps) {
  const [local, setLocal] = useState<FiltrosAvanzados>(initial);

  useEffect(() => { if (open) setLocal(initial); }, [open]);

  const set = <K extends keyof FiltrosAvanzados>(key: K, val: FiltrosAvanzados[K]) =>
    setLocal(prev => ({ ...prev, [key]: val }));

  const limpiar = () => setLocal(DEFAULT_FILTROS);
  const aplicar = () => { onApply(local); onClose(); };

  const hasChanges = JSON.stringify(local) !== JSON.stringify(DEFAULT_FILTROS);

  if (!open) return null;

  const rows: { icon: React.ReactNode; label: string; desc: string; content: React.ReactNode }[] = [
    {
      icon: <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><Tag size={17} className="text-blue-500" /></div>,
      label: 'Estado',
      desc:  'Filtra por el estado del producto.',
      content: (
        <select
          value={local.estado}
          onChange={e => set('estado', e.target.value as FiltrosAvanzados['estado'])}
          className="min-w-[220px] border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-700 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
        >
          <option value="">Todos (Activo e Inactivo)</option>
          <option value="true">Solo Activos</option>
          <option value="false">Solo Inactivos</option>
        </select>
      ),
    },
    {
      icon: <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center"><Package size={17} className="text-emerald-500" /></div>,
      label: 'Disponible para venta',
      desc:  'Indica si el producto está disponible para la venta.',
      content: <YesNoToggle value={local.enVenta} onChange={v => set('enVenta', v)} />,
    },
    {
      icon: <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center"><Barcode size={17} className="text-orange-500" /></div>,
      label: 'Con stock',
      desc:  'Filtra productos que cuentan con stock disponible.',
      content: <YesNoToggle value={local.conStock} onChange={v => set('conStock', v)} />,
    },
    {
      icon: <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center"><Tag size={17} className="text-violet-500" /></div>,
      label: 'Producto promocional',
      desc:  'Filtra productos que están en promoción.',
      content: <YesNoToggle value={local.promo} onChange={v => set('promo', v)} />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm page-fade">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <SlidersHorizontal size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">Filtro avanzado</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Define los criterios para filtrar los productos.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors mt-0.5 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Sección Estado */}
        <div className="px-6 py-5 flex-1">
          <h3 className="text-sm font-bold text-zinc-800 mb-3">Estado</h3>
          <div className="border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                {row.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">{row.label}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{row.desc}</p>
                </div>
                {row.content}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
          <button
            onClick={limpiar}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:border-zinc-400 px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw size={14} /> Limpiar filtros
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-300 rounded-xl transition-all cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={aplicar}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                hasChanges
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 active:scale-[0.97]'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <SlidersHorizontal size={14} /> Aplicar filtros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal importar / exportar ────────────────────────────────────────────────

type TableTarget = 'productos' | 'clientes' | 'stock';

interface TableConfig {
  label:   string;
  icon:    React.ReactNode;
  columns: string[];
  desc:    string;
}

const TABLE_CONFIGS: Record<TableTarget, TableConfig> = {
  productos: {
    label: 'Productos',
    icon: <Package size={14} />,
    desc: 'Catálogo completo de productos con precios y stock',
    columns: ['id','activo','codbarra','nombre','categoria','medida','stock','precio','stock_minimo','margen','costo','tipoproducto','operacion','icbper','controstock'],
  },
  clientes: {
    label: 'Clientes',
    icon: <Users size={14} />,
    desc: 'Base de datos de clientes y créditos',
    columns: ['id','nombre','tipo_doc','documento','telefono','email','direccion','credito'],
  },
  stock: {
    label: 'Stock inicial',
    icon: <Layers size={14} />,
    desc: 'Carga masiva de stock inicial por producto',
    columns: ['codbarra','nombre','stock'],
  },
};

type ImportStep = 'idle' | 'preview' | 'importing' | 'done';

function ImportExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [tabla, setTabla]       = useState<TableTarget>('productos');
  const [step, setStep]         = useState<ImportStep>('idle');
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importErrors, setImportErrors]     = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const cfg = TABLE_CONFIGS[tabla];

  // Cuenta de registros actuales
  const { data: prodTotal }   = useQuery({ queryKey: ['products-count-all'], queryFn: () => productsService.getAll({ limit: 1 }), staleTime: 60_000, enabled: open });
  const { data: clientTotal } = useQuery({ queryKey: ['customers-count'],    queryFn: () => customersService.getAll({ limit: 1 }), staleTime: 60_000, enabled: open });

  const registros = tabla === 'productos' ? (prodTotal?.total ?? 0) : tabla === 'clientes' ? (clientTotal?.total ?? 0) : 0;

  // ── FORMATO: descarga plantilla vacía ────────────────────────────────────
  const handleFormato = async () => {
    const XLSX = await import('xlsx');
    const ws   = XLSX.utils.aoa_to_sheet([cfg.columns]);
    ws['!cols'] = cfg.columns.map(() => ({ wch: 18 }));
    // Estilo encabezado
    cfg.columns.forEach((_, i) => {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
      if (cell) cell.s = { fill: { fgColor: { rgb: '1E40AF' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.label);
    XLSX.writeFile(wb, `formato-${tabla}-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // ── EXPORTAR: descarga todos los datos ───────────────────────────────────
  const handleExportar = async () => {
    const XLSX = await import('xlsx');
    let rows: Record<string, unknown>[] = [];

    if (tabla === 'productos') {
      const res = await productsService.getAll({ limit: 9999 });
      rows = res.data.map(p => ({
        id:           p.codigoInterno ?? '',
        activo:       p.isActive ? 'SI' : 'NO',
        codbarra:     p.codigoBarras ?? '',
        nombre:       p.nombre,
        categoria:    p.category?.nombre ?? '',
        medida:       p.unidadMedida ?? '',
        stock:        Number(p.stockActual),
        precio:       Number(p.precioVenta),
        stock_minimo: Number(p.stockMinimo ?? 0),
        margen:       p.precioCompra ? +((Number(p.precioVenta) - Number(p.precioCompra)) / Number(p.precioVenta) * 100).toFixed(2) : 0,
        costo:        Number(p.precioCompra ?? 0),
        tipoproducto: p.igvTipo ?? '',
        operacion:    '',
        icbper:       '',
        controstock:  '',
      }));
    } else if (tabla === 'clientes') {
      const res = await customersService.getAll({ limit: 9999 });
      rows = (res.data ?? []).map((c: any) => ({
        id:       c.id,
        nombre:   c.nombreCompleto,
        tipo_doc: c.tipoDocumento,
        documento:c.numeroDocumento,
        telefono: c.telefono ?? '',
        email:    c.email ?? '',
        direccion:c.direccion ?? '',
        credito:  c.creditoLimite ?? 0,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(rows, { header: cfg.columns });
    ws['!cols'] = cfg.columns.map(() => ({ wch: 18 }));
    cfg.columns.forEach((_, i) => {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
      if (cell) cell.s = { fill: { fgColor: { rgb: '1E40AF' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.label);
    XLSX.writeFile(wb, `export-${tabla}-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // ── IMPORTAR: leer archivo y mostrar preview ─────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const XLSX = await import('xlsx');
    const ab   = await file.arrayBuffer();
    const wb   = XLSX.read(ab, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
    setImportRows(data.slice(0, 200)); // máx 200 preview
    setStep('preview');
  };

  const handleConfirmImport = async () => {
    if (!importRows.length) return;
    setStep('importing');
    setImportErrors([]);
    let done = 0;
    const errs: string[] = [];

    for (const row of importRows) {
      try {
        if (tabla === 'productos') {
          await productsService.create({
            nombre:       String(row.nombre ?? ''),
            codigoBarras: row.codbarra || undefined,
            codigoInterno:row.id       || undefined,
            unidadMedida: row.medida   || undefined,
            precioVenta:  parseFloat(String(row.precio))  || 0,
            precioCompra: parseFloat(String(row.costo))   || undefined,
            stockMinimo:  parseFloat(String(row.stock_minimo)) || undefined,
            stockInicial: parseFloat(String(row.stock))   || undefined,
            igvTipo:      (row.tipoproducto as any) || 'gravado',
          });
        }
      } catch (err: any) {
        errs.push(`Fila ${done + 1} (${row.nombre ?? ''}): ${err?.response?.data?.message ?? 'Error'}`);
      }
      done++;
      setImportProgress(Math.round((done / importRows.length) * 100));
    }

    setImportErrors(errs);
    setStep('done');
    qc.refetchQueries({ queryKey: ['products'] });
  };

  const resetImport = () => { setStep('idle'); setImportRows([]); setImportProgress(0); setImportErrors([]); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm page-fade">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">Importar / exportar datos</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Trabaja con los campos actuales de productos, clientes o stock.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <span className="text-xs font-semibold border border-blue-300 text-blue-600 px-2.5 py-1 rounded-lg bg-blue-50">
              {cfg.label}
            </span>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Tabla destino + acciones */}
          <div className="px-6 py-5 border-b border-zinc-100">
            <div className="flex flex-wrap items-end gap-4">
              {/* Selector */}
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Tabla destino</label>
                <div className="relative">
                  <select
                    value={tabla}
                    onChange={e => { setTabla(e.target.value as TableTarget); resetImport(); }}
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-800 bg-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                  >
                    <option value="productos">Productos</option>
                    <option value="clientes">Clientes</option>
                    <option value="stock">Stock inicial</option>
                  </select>
                  <ChevronRight size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 rotate-90 pointer-events-none" />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFormato}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  <FileText size={15} /> FORMATO
                </button>
                <button
                  onClick={handleExportar}
                  disabled={tabla === 'stock'}
                  className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 active:scale-[0.97] disabled:opacity-40 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet size={15} /> EXPORTAR
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  <Upload size={15} /> IMPORTAR
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
          </div>

          {/* Info chips */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-100">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full">
              <FileSpreadsheet size={12} /> {cfg.columns.length} columnas
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <Package size={12} /> {registros} registros actuales
            </span>
          </div>

          {/* Estado del import / preview / done */}
          {step === 'idle' && (
            <div className="px-6 py-5">
              <h3 className="text-sm font-bold text-zinc-800 mb-3">Columnas permitidas</h3>
              <div className="border border-zinc-200 rounded-2xl p-4 flex flex-wrap gap-2">
                {cfg.columns.map(col => (
                  <span key={col} className="px-2.5 py-1 text-xs font-mono font-medium text-zinc-600 bg-zinc-100 border border-zinc-200 rounded-lg">
                    {col}
                  </span>
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-3">
                Descarga el <button onClick={handleFormato} className="text-blue-600 underline cursor-pointer font-medium">formato vacío</button> para conocer la estructura exacta del archivo.
              </p>
            </div>
          )}

          {step === 'preview' && (
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800">Vista previa del archivo</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{importRows.length} filas detectadas — se importarán todas</p>
                </div>
                <button onClick={resetImport} className="text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer transition-colors">
                  Cancelar
                </button>
              </div>
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-48">
                  <table className="text-xs w-full">
                    <thead className="sticky top-0 bg-zinc-800 text-white">
                      <tr>
                        {Object.keys(importRows[0] ?? {}).map(k => (
                          <th key={k} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {importRows.slice(0, 8).map((row, i) => (
                        <tr key={i} className="hover:bg-zinc-50">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-3 py-2 text-zinc-700 whitespace-nowrap max-w-[120px] truncate">{String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 8 && (
                  <p className="text-center text-[11px] text-zinc-400 py-2 border-t border-zinc-100">
                    +{importRows.length - 8} filas más…
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="px-6 py-10 flex flex-col items-center gap-4">
              <div className="w-full max-w-xs">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-zinc-700">Importando registros…</p>
                  <span className="text-sm font-bold text-blue-600">{importProgress}%</span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-400">{Math.round(importRows.length * importProgress / 100)} de {importRows.length} filas procesadas</p>
            </div>
          )}

          {step === 'done' && (
            <div className="px-6 py-6">
              <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${importErrors.length ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${importErrors.length ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                  {importErrors.length ? <AlertTriangle size={16} className="text-amber-600" /> : <Check size={16} className="text-emerald-600" />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${importErrors.length ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {importErrors.length
                      ? `${importRows.length - importErrors.length} filas importadas, ${importErrors.length} con errores`
                      : `${importRows.length} filas importadas correctamente`
                    }
                  </p>
                </div>
              </div>
              {importErrors.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 max-h-32 overflow-y-auto">
                  {importErrors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 py-0.5">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 flex-shrink-0">
          <p className="text-[11px] text-zinc-400">Formatos soportados: .xlsx, .xls, .csv</p>
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <button
                onClick={handleConfirmImport}
                className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Check size={14} /> Confirmar importación
              </button>
            )}
            {step === 'done' && (
              <button
                onClick={resetImport}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw size={14} /> Nueva importación
              </button>
            )}
            <button onClick={onClose} className="text-xs font-bold text-zinc-400 hover:text-zinc-700 tracking-widest transition-colors cursor-pointer">
              CERRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal de reporte stock mínimo ────────────────────────────────────────────

type StockFilter = 'bajo' | 'sinstock' | 'conminimo';

function StockMinimoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [filtro, setFiltro] = useState<StockFilter>('bajo');

  const { data, isLoading } = useQuery({
    queryKey: ['products-stock-minimo'],
    queryFn: () => productsService.getAll({ limit: 9999, isActive: true }),
    enabled: open,
    staleTime: 60_000,
  });

  const all = (data?.data ?? []).filter(p => Number(p.stockMinimo) > 0);

  const bajominimo = all.filter(p => Number(p.stockActual) <= Number(p.stockMinimo) && Number(p.stockActual) > 0);
  const sinStock   = all.filter(p => Number(p.stockActual) === 0);
  const conMinimo  = all;

  const filas = filtro === 'bajo' ? bajominimo : filtro === 'sinstock' ? sinStock : conMinimo;
  const totalAlertas = bajominimo.length + sinStock.length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm page-fade">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header ámbar */}
        <div className="flex items-center justify-between px-5 py-4 bg-amber-400 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors cursor-pointer">
              <X size={18} />
            </button>
            <h2 className="text-white font-semibold text-base tracking-tight">Reporte de stock mínimo</h2>
          </div>
          {totalAlertas > 0 && (
            <span className="bg-white text-amber-600 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
              {totalAlertas} alertas
            </span>
          )}
        </div>

        {/* Chips filtro */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100 flex-shrink-0">
          <button
            onClick={() => setFiltro('bajo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              filtro === 'bajo' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-amber-300'
            }`}>
            <AlertTriangle size={12} /> Bajo mínimo: {bajominimo.length}
          </button>
          <button
            onClick={() => setFiltro('sinstock')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              filtro === 'sinstock' ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-red-300'
            }`}>
            <X size={12} strokeWidth={2.5} /> Sin stock: {sinStock.length}
          </button>
          <button
            onClick={() => setFiltro('conminimo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              filtro === 'conminimo' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-blue-300'
            }`}>
            <Package size={12} /> Con mínimo: {conMinimo.length}
          </button>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-zinc-100 z-10">
              <tr>
                <th className="text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wide px-5 py-3">Producto</th>
                <th className="text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wide px-5 py-3">Categoría</th>
                <th className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wide px-5 py-3">Stock</th>
                <th className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wide px-5 py-3">Mínimo</th>
                <th className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wide px-5 py-3">Faltante</th>
                <th className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-wide px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-3 shimmer-line rounded" /></td></tr>
                  ))
                : filas.length === 0
                  ? (
                    <tr><td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 gap-3 page-fade">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                          <Package size={22} className="text-zinc-300" />
                        </div>
                        <p className="text-sm text-zinc-400 font-medium">Sin productos en esta categoría</p>
                      </div>
                    </td></tr>
                  )
                  : filas.map((p, idx) => {
                      const stock    = Number(p.stockActual);
                      const minimo   = Number(p.stockMinimo);
                      const faltante = Math.max(0, minimo - stock);
                      const sinStk   = stock === 0;
                      return (
                        <tr key={p.id} className="row-enter hover:bg-zinc-50 transition-colors" style={{ animationDelay: `${idx * 30}ms` }}>
                          <td className="px-5 py-3.5">
                            <p className="font-bold text-zinc-900 text-sm">{p.nombre}</p>
                            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">#{p.codigoInterno ?? p.id.slice(0, 8)}</p>
                          </td>
                          <td className="px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                            {p.category?.nombre ?? '—'}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`font-bold text-base tabular-nums ${sinStk ? 'text-red-500' : 'text-zinc-800'}`}>{stock}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center text-zinc-500 tabular-nums">{minimo}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`font-bold tabular-nums text-base ${faltante === 0 ? 'text-zinc-400' : faltante <= 5 ? 'text-red-500' : faltante <= 20 ? 'text-orange-500' : 'text-amber-500'}`}>
                              {faltante}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              sinStk
                                ? 'bg-red-50 border-red-200 text-red-600'
                                : 'bg-amber-50 border-amber-300 text-amber-700'
                            }`}>
                              {sinStk ? 'Sin stock' : 'Bajo mínimo'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 flex-shrink-0">
          <p className="text-[11px] text-zinc-400">Solo se consideran productos activos con stock mínimo mayor a 0.</p>
          <button onClick={onClose} className="text-xs font-bold text-zinc-400 hover:text-zinc-700 tracking-widest transition-colors cursor-pointer">
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de estadísticas de inventario ──────────────────────────────────────

function EstadisticaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['products-stats-all'],
    queryFn: () => productsService.getAll({ limit: 9999 }),
    enabled: open,
    staleTime: 60_000,
  });

  const products = data?.data ?? [];

  const stockTotal  = products.reduce((a, p) => a + Number(p.stockActual), 0);
  const costoValo   = products.reduce((a, p) => a + Number(p.stockActual) * Number(p.precioCompra ?? 0), 0);
  const precioValo  = products.reduce((a, p) => a + Number(p.stockActual) * Number(p.precioVenta), 0);

  const byCategory = products.reduce<Record<string, { nombre: string; stock: number; costo: number; precio: number }>>((acc, p) => {
    const key = p.category?.nombre ?? 'Sin categoría';
    if (!acc[key]) acc[key] = { nombre: key, stock: 0, costo: 0, precio: 0 };
    acc[key].stock  += Number(p.stockActual);
    acc[key].costo  += Number(p.stockActual) * Number(p.precioCompra ?? 0);
    acc[key].precio += Number(p.stockActual) * Number(p.precioVenta);
    return acc;
  }, {});
  const catRows = Object.values(byCategory).sort((a, b) => b.precio - a.precio);

  const exportXLSX = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Título
    const titulo = [['ESTADÍSTICA DE INVENTARIO'], [`Generado: ${new Date().toLocaleDateString('es-PE', { dateStyle: 'long' })}`], []];

    // Encabezados + datos
    const header = [['Categoría', 'Cantidad', 'Costo', 'Precio']];
    const filas  = catRows.map(r => [r.nombre, r.stock, r.costo, r.precio]);
    const vacio  = [[]];
    const total  = [['TOTAL', stockTotal, costoValo, precioValo]];

    const wsData = [...titulo, ...header, ...filas, ...vacio, ...total];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Anchos de columnas
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];

    // Estilo encabezado (fila 4 = índice 3)
    const headerRow = 3;
    ['A', 'B', 'C', 'D'].forEach(col => {
      const cell = ws[`${col}${headerRow}`];
      if (cell) {
        cell.s = {
          fill:  { fgColor: { rgb: '1E40AF' } },
          font:  { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          alignment: { horizontal: 'center' },
          border: { bottom: { style: 'thin', color: { rgb: 'FFFFFF' } } },
        };
      }
    });

    // Estilo filas de datos (alternar)
    filas.forEach((_, i) => {
      const rowIdx = headerRow + 1 + i;
      const isEven = i % 2 === 0;
      ['A', 'B', 'C', 'D'].forEach((col, ci) => {
        const cell = ws[`${col}${rowIdx}`];
        if (!cell) return;
        cell.s = {
          fill: { fgColor: { rgb: isEven ? 'F8FAFC' : 'FFFFFF' } },
          font: { sz: 10, bold: ci === 0 },
          alignment: { horizontal: ci === 0 ? 'left' : 'right' },
          numFmt: ci === 0 ? '@' : '#,##0.00',
        };
      });
    });

    // Estilo fila TOTAL
    const totalRow = headerRow + filas.length + 2;
    ['A', 'B', 'C', 'D'].forEach((col, ci) => {
      const cell = ws[`${col}${totalRow}`];
      if (!cell) return;
      cell.s = {
        fill: { fgColor: { rgb: '0F172A' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        alignment: { horizontal: ci === 0 ? 'left' : 'right' },
        numFmt: ci === 0 ? '@' : '#,##0.00',
      };
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, `estadistica-inventario-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm page-fade">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header azul */}
        <div className="flex items-center justify-between px-5 py-4 bg-blue-600 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors cursor-pointer">
              <X size={18} />
            </button>
            <h2 className="text-white font-semibold text-base tracking-tight">Estadistica de inventario</h2>
          </div>
          <button
            onClick={exportXLSX}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            title="Exportar a Excel"
          >
            <FileDown size={14} />
            Excel
          </button>
        </div>

        {/* Tarjetas de totales */}
        <div className="grid grid-cols-3 gap-3 p-5 border-b border-zinc-100 flex-shrink-0">
          <div className="border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Package size={15} className="text-blue-500" />
              <span className="text-[11px] text-zinc-500 font-medium">Stock total</span>
            </div>
            <p className="text-xl font-bold text-zinc-900 tabular-nums">
              {isLoading ? <span className="shimmer-line h-5 w-24 block rounded" /> : stockTotal.toFixed(2)}
            </p>
          </div>
          <div className="border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart2 size={15} className="text-amber-500" />
              <span className="text-[11px] text-zinc-500 font-medium">Costo valorizado</span>
            </div>
            <p className="text-xl font-bold text-zinc-900 tabular-nums">
              {isLoading ? <span className="shimmer-line h-5 w-28 block rounded" /> : `S/ ${costoValo.toFixed(2)}`}
            </p>
          </div>
          <div className="border border-zinc-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={15} className="text-emerald-500" />
              <span className="text-[11px] text-zinc-500 font-medium">Precio valorizado</span>
            </div>
            <p className="text-xl font-bold text-zinc-900 tabular-nums">
              {isLoading ? <span className="shimmer-line h-5 w-28 block rounded" /> : `S/ ${precioValo.toFixed(2)}`}
            </p>
          </div>
        </div>

        {/* Tabla por categoría */}
        <div className="flex flex-col flex-1 overflow-hidden p-5">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800">Consolidado por categoria</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Resumen calculado con el inventario actual</p>
            </div>
            <span className="text-xs font-medium bg-zinc-100 border border-zinc-200 rounded-full px-3 py-1 text-zinc-600">
              {catRows.length} categorías
            </span>
          </div>
          <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-zinc-100 z-10">
                <tr>
                  <th className="text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-4 py-2.5">Categoría</th>
                  <th className="text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-4 py-2.5">Stock</th>
                  <th className="text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-4 py-2.5">Costo</th>
                  <th className="text-right text-[10px] font-semibold text-zinc-400 uppercase tracking-wide px-4 py-2.5">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}><td colSpan={4} className="px-4 py-3"><div className="h-3 shimmer-line rounded" /></td></tr>
                    ))
                  : catRows.map((row) => (
                      <tr key={row.nombre} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-zinc-800">{row.nombre}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center justify-center border border-blue-200 text-blue-600 text-xs font-medium px-2.5 py-0.5 rounded-full tabular-nums">
                            {row.stock.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-zinc-500 tabular-nums">S/ {row.costo.toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-600 tabular-nums">S/ {row.precio.toFixed(2)}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-zinc-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-700 tracking-widest transition-colors cursor-pointer"
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const ROWS_OPTIONS = [10, 20, 50];

export default function ProductsPage() {
  const canEdit   = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'almacenero']));
  const showCosto = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'contabilidad']));

  // Filtros
  const [search, setSearch]         = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activeFilter]               = useState<'' | 'true' | 'false'>('');
  const [page, setPage]             = useState(1);
  const [limit, setLimit]           = useState(10);
  const [filtros, setFiltros]       = useState<FiltrosAvanzados>(DEFAULT_FILTROS);

  // Modales
  const [prodModal, setProdModal]           = useState(false);
  const [catModal, setCatModal]             = useState(false);
  const [barcodeModal, setBarcodeModal]     = useState(false);
  const [opcionesOpen, setOpcionesOpen]     = useState(false);
  const [statsModal, setStatsModal]         = useState(false);
  const [stockModal, setStockModal]         = useState(false);
  const [filtroModal, setFiltroModal]       = useState(false);
  const [importModal, setImportModal]       = useState(false);
  const [editing, setEditing]               = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [viewerImg, setViewerImg]           = useState<{ src: string; alt: string } | null>(null);

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn:  productsService.getCategories,
    staleTime: 10 * 60 * 1000,
  });
  const categories = catData ?? [];

  const efectivoActive = filtros.estado !== '' ? filtros.estado : (activeFilter !== '' ? activeFilter : undefined);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', { search, categoryId, efectivoActive, page, limit }],
    queryFn:  () => productsService.getAll({
      search:     search || undefined,
      categoryId: categoryId || undefined,
      isActive:   efectivoActive === undefined ? undefined : efectivoActive === 'true',
      page,
      limit,
    }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  // Counts para chips
  const { data: totalData }    = useQuery({ queryKey: ['products-count-all'],      queryFn: () => productsService.getAll({ limit: 1 }),                   staleTime: 60_000 });
  const { data: activeData }   = useQuery({ queryKey: ['products-count-active'],   queryFn: () => productsService.getAll({ isActive: true,  limit: 1 }), staleTime: 60_000 });
  const { data: inactiveData } = useQuery({ queryKey: ['products-count-inactive'], queryFn: () => productsService.getAll({ isActive: false, limit: 1 }), staleTime: 60_000 });

  const totalCount    = totalData?.total    ?? 0;
  const activeCount   = activeData?.total   ?? 0;
  const inactiveCount = inactiveData?.total ?? 0;
  const lowStockCount = (data?.data ?? []).filter((p) => Number(p.stockActual) <= Number(p.stockMinimo) && Number(p.stockMinimo) > 0).length;


  const openCreate  = () => { setEditing(null); setProdModal(true); };
  const openEdit    = (p: Product) => { setEditing(p); setProdModal(true); };
  const openBarcode = (p: Product) => { setBarcodeProduct(p); setBarcodeModal(true); };

  const rawProducts = data?.data ?? [];
  const products = rawProducts.filter(p => {
    if (filtros.conStock === true  && Number(p.stockActual) <= 0) return false;
    if (filtros.conStock === false && Number(p.stockActual) >  0) return false;
    if (filtros.enVenta  === true  && p.isActive === false)       return false;
    if (filtros.enVenta  === false && p.isActive === true)        return false;
    return true;
  });
  const total      = data?.total ?? 0;
  const from       = (page - 1) * limit + 1;
  const to         = Math.min(page * limit, total);
  const totalPages = data?.totalPages ?? 1;

  const hasFilters = !!(search || categoryId);

  return (
    <div className="min-h-full bg-zinc-50 page-fade">

      {/* ── Header asimétrico ── */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4 gap-4">
        {/* Izquierda: icono + título + conteo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Package size={20} className="text-white" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 tracking-tight leading-none">Productos</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              {isFetching ? 'Actualizando…' : `${totalCount} registros en total`}
            </p>
          </div>
        </div>

        {/* Derecha: acciones */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Botón Opciones con menú */}
          <div className="relative">
            <button
              onClick={() => setOpcionesOpen((v) => !v)}
              className="flex items-center gap-1.5 border border-zinc-300 hover:border-zinc-400 bg-white text-zinc-700 font-medium text-sm px-3 py-2 rounded-lg transition-all hover:shadow-sm cursor-pointer">
              <Settings size={14} className="text-zinc-500" />
              <span>Opciones</span>
            </button>

            {opcionesOpen && (
              <>
                {/* Overlay para cerrar */}
                <div className="fixed inset-0 z-10" onClick={() => setOpcionesOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-zinc-200 rounded-2xl shadow-2xl z-20 py-2 min-w-[240px] overflow-hidden">

                  {/* Sección: Gestión */}
                  <p className="px-4 pt-1 pb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Gestión y herramientas</p>

                  <button
                    onClick={() => { setStatsModal(true); setOpcionesOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                      <BarChart2 size={15} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-zinc-800">Ver estadística</p>
                      <p className="text-[11px] text-zinc-400">Ver reportes detallados</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setFiltroModal(true); setOpcionesOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0 group-hover:bg-zinc-200 transition-colors">
                      <SlidersHorizontal size={15} className="text-zinc-600" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-zinc-800">Filtro avanzado</p>
                      <p className="text-[11px] text-zinc-400">Búsqueda avanzada</p>
                    </div>
                    {JSON.stringify(filtros) !== JSON.stringify(DEFAULT_FILTROS) && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </button>

                  <button
                    onClick={() => { setStockModal(true); setOpcionesOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                      <AlertTriangle size={15} className="text-amber-500" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-zinc-800">Reporte stock mínimo</p>
                      <p className="text-[11px] text-zinc-400">Productos bajo el mínimo</p>
                    </div>
                    {lowStockCount > 0 && (
                      <span className="bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                        {lowStockCount}
                      </span>
                    )}
                  </button>

                  {/* Divider */}
                  <div className="mx-4 my-2 border-t border-zinc-100" />

                  {/* Sección: Configuración */}
                  <p className="px-4 pb-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Configuración</p>

                  <button
                    onClick={() => { setCatModal(true); setOpcionesOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0 group-hover:bg-zinc-200 transition-colors">
                      <Tag size={15} className="text-zinc-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-zinc-800">Categorias</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { setImportModal(true); setOpcionesOpen(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-50 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                      <FileDown size={15} className="text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-zinc-800">Importar / exportar</p>
                      <p className="text-[11px] text-zinc-400">Descargar datos actuales</p>
                    </div>
                  </button>

                  <div className="pb-1" />
                </div>
              </>
            )}
          </div>

          {canEdit && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all shadow-sm shadow-blue-200 cursor-pointer">
              <Plus size={15} strokeWidth={2.5} />
              Nuevo producto
            </button>
          )}
        </div>
      </div>

      {/* ── Chips informativos de estadísticas ── */}
      <div className="flex flex-wrap items-center gap-2 px-6 pb-4">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700">
          <Package size={12} strokeWidth={2} /> Todos · {isFetching ? '…' : totalCount}
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 stock-dot-live" />
          Activos · {activeCount}
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-300 text-slate-600">
          <X size={12} strokeWidth={2.5} /> Inactivos · {inactiveCount}
        </span>
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
          lowStockCount > 0 ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-zinc-100 border-zinc-200 text-zinc-400'
        }`}>
          <AlertTriangle size={12} strokeWidth={2} /> Bajo mínimo · {lowStockCount}
        </span>
      </div>

      {/* ── Buscador + Filtro ── */}
      <div className="flex gap-3 px-6 pb-5">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, código…"
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-zinc-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-zinc-400"
          />
        </div>
        <div className="relative w-52">
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
            className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm text-zinc-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 appearance-none transition-all cursor-pointer">
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <ChevronRight size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 rotate-90 pointer-events-none" />
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="mx-6 mb-4 bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-5 py-3.5">Código</th>
                <th className="text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-5 py-3.5">Categoría</th>
                <th className="text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-5 py-3.5">Nombre</th>
                <th className="text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-5 py-3.5">Stock</th>
                <th className="text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-5 py-3.5">Precio venta</th>
                {showCosto && <th className="text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-5 py-3.5">Costo / Margen</th>}
                <th className="text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wide px-5 py-3.5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={showCosto ? 7 : 6} />)
                : products.length === 0
                  ? <EmptyState hasFilters={hasFilters} />
                  : products.map((p, idx) => {
                      const stock  = Number(p.stockActual);
                      const minimo = Number(p.stockMinimo);
                      const isCrit = stock <= minimo && minimo > 0;
                      const isEmpty = stock === 0;
                      return (
                        <tr
                          key={p.id}
                          className="group row-enter border-l-[3px] border-l-transparent hover:border-l-blue-500 hover:bg-blue-50/40 transition-all duration-150"
                          style={{ animationDelay: `${idx * 35}ms` }}
                        >
                          {/* Código */}
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                              {p.codigoInterno ?? `#${from + idx}`}
                            </span>
                          </td>
                          {/* Categoría */}
                          <td className="px-5 py-3.5">
                            {p.category
                              ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">{p.category.nombre}</span>
                              : <span className="text-zinc-300 text-xs">—</span>}
                          </td>
                          {/* Nombre */}
                          <td className="px-5 py-3.5 max-w-[260px]">
                            <div className="flex items-center gap-2.5">
                              {p.imagenUrl
                                ? <img
                                    src={p.imagenUrl}
                                    alt={p.nombre}
                                    onClick={() => setViewerImg({ src: p.imagenUrl!, alt: p.nombre })}
                                    className="w-8 h-8 rounded-lg object-cover border border-zinc-200 cursor-zoom-in flex-shrink-0 hover:scale-105 transition-transform"
                                  />
                                : <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
                                    <Package size={13} className="text-zinc-300" />
                                  </div>
                              }
                              <span className="text-zinc-800 font-medium text-sm leading-snug line-clamp-1">{p.nombre}</span>
                            </div>
                          </td>
                          {/* Stock */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isEmpty ? 'bg-red-400' : isCrit ? 'bg-amber-400 stock-dot-live' : 'bg-emerald-400'}`} />
                              <span className={`font-semibold tabular-nums ${isEmpty ? 'text-red-500' : isCrit ? 'text-amber-600' : 'text-zinc-700'}`}>
                                {stock}
                              </span>
                              {isCrit && !isEmpty && (
                                <AlertTriangle size={12} className="text-amber-400" />
                              )}
                            </div>
                          </td>
                          {/* Precio */}
                          <td className="px-5 py-3.5">
                            <span className="font-bold text-zinc-900 tabular-nums">S/ {Number(p.precioVenta).toFixed(2)}</span>
                          </td>
                          {/* Costo / Margen — solo roles financieros */}
                          {showCosto && (() => {
                            const costo  = Number(p.precioCompra ?? 0);
                            const venta  = Number(p.precioVenta);
                            const margen = costo > 0 && venta > 0 ? ((venta - costo) / venta * 100) : null;
                            return (
                              <td className="px-5 py-3.5">
                                {costo > 0 ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-semibold text-zinc-600 tabular-nums">S/ {costo.toFixed(2)}</span>
                                    {margen !== null && (
                                      <span className={`text-[11px] font-bold tabular-nums ${margen >= 20 ? 'text-emerald-600' : margen >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                                        {margen.toFixed(1)}% margen
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-zinc-300 text-xs">—</span>
                                )}
                              </td>
                            );
                          })()}
                          {/* Acciones — visibles solo en hover */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              <button
                                onClick={() => openEdit(p)}
                                className="p-1.5 rounded-lg hover:bg-blue-100 text-zinc-400 hover:text-blue-600 transition-colors cursor-pointer"
                                title="Editar producto"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => openBarcode(p)}
                                className="p-1.5 rounded-lg hover:bg-violet-100 text-zinc-400 hover:text-violet-600 transition-colors cursor-pointer"
                                title="Código de barras / QR"
                              >
                                <Barcode size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </div>

        {/* ── Paginación ── */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Filas por página:</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-blue-400 cursor-pointer"
              >
                {ROWS_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 tabular-nums">{from}–{to} de {total}</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-zinc-200 disabled:opacity-25 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={15} className="text-zinc-600" />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg hover:bg-zinc-200 disabled:opacity-25 transition-colors cursor-pointer"
                >
                  <ChevronRight size={15} className="text-zinc-600" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modales ── */}
      <ProductModal
        key={editing?.id ?? 'new'}
        open={prodModal}
        onClose={() => { setProdModal(false); setEditing(null); }}
        product={editing}
        categories={categories}
      />
      <CategoriesModal open={catModal} onClose={() => setCatModal(false)} categories={categories} />
      <BarcodeModal
        open={barcodeModal}
        onClose={() => { setBarcodeModal(false); setBarcodeProduct(null); }}
        product={barcodeProduct}
      />
      {viewerImg && <ImageViewer src={viewerImg.src} alt={viewerImg.alt} onClose={() => setViewerImg(null)} />}
      <EstadisticaModal open={statsModal} onClose={() => setStatsModal(false)} />
      <StockMinimoModal open={stockModal} onClose={() => setStockModal(false)} />
      <ImportExportModal open={importModal} onClose={() => setImportModal(false)} />
      <FiltroAvanzadoModal
        open={filtroModal}
        onClose={() => setFiltroModal(false)}
        initial={filtros}
        onApply={(f) => { setFiltros(f); setPage(1); }}
      />
    </div>
  );
}
