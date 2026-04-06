import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, ArrowUpDown, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { inventoryService } from '@/services/inventory.service';
import { productsService } from '@/services/products.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatNumber, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

// ── Adjustment modal ────────────────────────────────────────────────��─────────

const adjSchema = z.object({
  productId:     z.string().min(1, 'Seleccione un producto'),
  tipo:          z.enum(['ajuste_entrada', 'ajuste_salida']),
  cantidad:      z.string().min(1, 'Ingrese la cantidad'),
  motivo:        z.string().optional(),
  costoUnitario: z.string().optional(),
});
type AdjForm = z.infer<typeof adjSchema>;

function AdjustModal({ open, onClose, products }: { open: boolean; onClose: () => void; products: any[] }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdjForm>({
    resolver: zodResolver(adjSchema),
    defaultValues: { tipo: 'ajuste_entrada' },
  });

  const adjMut = useMutation({
    mutationFn: (d: AdjForm) => inventoryService.adjust({
      productId:     d.productId,
      tipo:          d.tipo,
      cantidad:      parseFloat(d.cantidad),
      motivo:        d.motivo || undefined,
      costoUnitario: d.costoUnitario ? parseFloat(d.costoUnitario) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['valorizado'] });
      reset();
      onClose();
    },
  });

  const prodOptions = products.map((p) => ({ value: p.id, label: `${p.codigoInterno ?? '?'} — ${p.nombre}` }));
  const errMsg = (adjMut.error as any)?.response?.data?.message;

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Ajuste de Inventario" size="md"
      footer={<>
        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
        <Button loading={adjMut.isPending} onClick={handleSubmit((d) => adjMut.mutate(d))}>Registrar Ajuste</Button>
      </>}
    >
      <div className="space-y-4">
        {errMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {Array.isArray(errMsg) ? errMsg.join(', ') : errMsg}
          </div>
        )}
        <Select label="Producto *" options={prodOptions} placeholder="— Seleccione un producto —" {...register('productId')} error={errors.productId?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Tipo *" options={[
            { value: 'ajuste_entrada', label: '↑ Entrada / Incremento' },
            { value: 'ajuste_salida',  label: '↓ Salida / Decremento' },
          ]} {...register('tipo')} />
          <Input label="Cantidad *" type="number" step="0.01" min="0.01" placeholder="0" {...register('cantidad')} error={errors.cantidad?.message} />
        </div>
        <Input label="Costo unitario (S/) — opcional" type="number" step="0.0001" min="0" placeholder="0.00" {...register('costoUnitario')} />
        <Input label="Motivo / Observación" placeholder="Ej: Stock inicial, Merma, Error de conteo..." {...register('motivo')} />
      </div>
    </Modal>
  );
}

// ── Kardex modal ──────────────────────────────────────────────────────────────

function KardexModal({ open, onClose, product }: { open: boolean; onClose: () => void; product: any }) {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['kardex', product?.id, from, to],
    queryFn:  () => inventoryService.getKardex(product!.id, from || undefined, to || undefined),
    enabled:  open && !!product,
  });

  const movTypes: Record<string, { label: string; color: string }> = {
    entrada_compra: { label: 'Compra',    color: 'success' },
    salida_venta:   { label: 'Venta',     color: 'danger'  },
    ajuste_entrada: { label: 'Ajuste +',  color: 'info'    },
    ajuste_salida:  { label: 'Ajuste −',  color: 'warning' },
    devolucion:     { label: 'Devolución',color: 'default' },
  };

  return (
    <Modal open={open} onClose={onClose} title={`Kardex: ${product?.nombre ?? ''}`} size="xl">
      <div className="flex gap-3 mb-4">
        <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Hasta" type="date" value={to}   onChange={(e) => setTo(e.target.value)} />
      </div>
      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b">
              {['Fecha/Hora', 'Tipo', 'Entrada', 'Salida', 'Stock', 'Costo Unit.', 'Usuario'].map((h) => (
                <th key={h} className="text-xs font-semibold text-slate-500 px-3 py-2 text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data?.map((m: any) => {
                const mt = movTypes[m.tipo] ?? { label: m.tipo, color: 'default' };
                const isIn = ['entrada_compra', 'ajuste_entrada', 'devolucion'].includes(m.tipo);
                return (
                  <tr key={m.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 text-xs">{formatDateTime(m.createdAt)}</td>
                    <td className="px-3 py-2"><Badge variant={mt.color as any}>{mt.label}</Badge></td>
                    <td className="px-3 py-2 text-emerald-600 font-medium">{isIn ? formatNumber(Number(m.cantidad)) : '—'}</td>
                    <td className="px-3 py-2 text-red-600 font-medium">{!isIn ? formatNumber(Number(m.cantidad)) : '—'}</td>
                    <td className="px-3 py-2 font-bold text-slate-800">{formatNumber(Number(m.stockDespues))}</td>
                    <td className="px-3 py-2 text-slate-600">{m.costoUnitario ? formatCurrency(Number(m.costoUnitario)) : '—'}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{m.user ? `${m.user.nombre} ${m.user.apellido}` : '—'}</td>
                  </tr>
                );
              })}
              {!data?.length && <tr><td colSpan={7} className="text-center py-8 text-slate-400">Sin movimientos en el período</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const canAdjust = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'almacenero']));
  const [search, setSearch]       = useState('');
  const [adjModal, setAdjModal]   = useState(false);
  const [kardexProd, setKardex]   = useState<any>(null);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', { search, isActive: true }],
    queryFn:  () => productsService.getAll({ search, isActive: true, limit: 200 }),
    placeholderData: (p) => p,
  });

  const { data: valorizado } = useQuery({
    queryKey: ['valorizado'],
    queryFn:  inventoryService.getValorizado,
  });

  const products = productsData?.data ?? [];
  const totalValorizado = valorizado?.totalValorizado ?? 0;
  const criticos = products.filter((p) => Number(p.stockActual) <= Number(p.stockMinimo)).length;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <BarChart3 size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Valor del Inventario</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(totalValorizado)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Productos Activos</p>
            <p className="text-xl font-bold text-slate-800">{products.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <TrendingDown size={20} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Stock Crítico</p>
            <p className="text-xl font-bold text-red-600">{criticos}</p>
          </div>
        </Card>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Buscar producto..." icon={<Search size={15} />} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canAdjust && <Button icon={<ArrowUpDown size={16} />} onClick={() => setAdjModal(true)}>Ajuste de Stock</Button>}
      </div>

      {/* Tabla */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b">
              {['Código', 'Producto', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Estado', 'Costo Unit.', 'Precio Venta', 'Valorizado', 'Movimientos'].map((h) => (
                <th key={h} className="text-xs font-semibold text-slate-500 px-4 py-3 text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : products.map((p) => {
                const stock    = Number(p.stockActual);
                const minStock = Number(p.stockMinimo);
                const costo    = Number(p.precioCompra ?? 0);
                const critico  = stock <= minStock;
                return (
                  <tr key={p.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.codigoInterno ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.nombre}</td>
                    <td className="px-4 py-3">{p.category ? <Badge variant="info">{p.category.nombre}</Badge> : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${critico ? 'text-red-600' : 'text-slate-800'}`}>{formatNumber(stock)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatNumber(minStock)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={critico ? 'danger' : 'success'}>{critico ? 'Crítico' : 'Normal'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{costo > 0 ? formatCurrency(costo) : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{formatCurrency(Number(p.precioVenta))}</td>
                    <td className="px-4 py-3 text-slate-600">{costo > 0 ? formatCurrency(stock * costo) : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setKardex(p)} className="text-xs text-blue-600 hover:underline font-medium">Ver Kardex</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AdjustModal open={adjModal} onClose={() => setAdjModal(false)} products={products} />
      <KardexModal open={!!kardexProd} onClose={() => setKardex(null)} product={kardexProd} />
    </div>
  );
}
