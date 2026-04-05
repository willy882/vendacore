import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, ChevronLeft, ChevronRight,
  ClipboardList, CheckCircle, Trash2, AlertCircle,
} from 'lucide-react';
import { purchasesService } from '@/services/purchases.service';
import { suppliersService } from '@/services/suppliers.service';
import { productsService } from '@/services/products.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, currentMonthRange } from '@/lib/utils';
import type { Purchase } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

// ── Schema ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  productId:    z.string().min(1, 'Seleccione producto'),
  cantidad:     z.string().min(1, 'Requerido'),
  costoUnitario: z.string().min(1, 'Requerido'),
});

const schema = z.object({
  supplierId:       z.string().min(1, 'Seleccione proveedor'),
  fecha:            z.string().min(1, 'Requerido'),
  tipoDocumento:    z.string().optional(),
  numeroDocumento:  z.string().optional(),
  estadoPago:       z.enum(['pendiente', 'parcial', 'pagado']),
  observaciones:    z.string().optional(),
  items: z.array(itemSchema).min(1, 'Agregue al menos un producto'),
});

type FormData = z.infer<typeof schema>;

// ── Modal nueva compra ────────────────────────────────────────────────────────

function PurchaseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, control, watch, reset, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        fecha:      today,
        estadoPago: 'pendiente',
        items:      [{ productId: '', cantidad: '', costoUnitario: '' }],
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn:  () => suppliersService.getAll(),
    enabled:  open,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', { isActive: true }],
    queryFn:  () => productsService.getAll({ isActive: true, limit: 200 }),
    enabled:  open,
  });

  const saveMut = useMutation({
    mutationFn: (d: FormData) =>
      purchasesService.create({
        supplierId:       d.supplierId,
        fecha:            d.fecha,
        tipoDocumento:    d.tipoDocumento || undefined,
        numeroDocumento:  d.numeroDocumento || undefined,
        estadoPago:       d.estadoPago,
        observaciones:    d.observaciones || undefined,
        items: d.items.map((i) => ({
          productId:    i.productId,
          cantidad:     parseFloat(i.cantidad),
          costoUnitario: parseFloat(i.costoUnitario),
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      reset();
      onClose();
    },
  });

  const watchedItems = watch('items');
  const subtotal = watchedItems.reduce((a, i) => {
    const qty  = parseFloat(i.cantidad)      || 0;
    const cost = parseFloat(i.costoUnitario) || 0;
    return a + qty * cost;
  }, 0);
  const igv   = subtotal * 0.18;
  const total = subtotal + igv;

  const supplierOptions = (suppliers?.data ?? []).map((s) => ({ value: s.id, label: `${s.razonSocial} (${s.ruc})` }));
  const productOptions  = (productsData?.data ?? []).map((p) => ({ value: p.id, label: `${p.codigoInterno ?? '?'} — ${p.nombre}` }));
  const errMsg = (saveMut.error as any)?.response?.data?.message;

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Nueva Compra"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button loading={saveMut.isPending} onClick={handleSubmit((d) => saveMut.mutate(d))}>
            Registrar Compra
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errMsg && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            {Array.isArray(errMsg) ? errMsg.join(', ') : errMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Select label="Proveedor *" options={supplierOptions} placeholder="— Seleccione —"
            {...register('supplierId')} error={errors.supplierId?.message} />
          <Input label="Fecha *" type="date" {...register('fecha')} error={errors.fecha?.message} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Select label="Tipo Doc." options={[
            { value: 'FACTURA', label: 'Factura' },
            { value: 'BOLETA',  label: 'Boleta' },
            { value: 'GUIA',    label: 'Guía de Remisión' },
          ]} placeholder="— Ninguno —" {...register('tipoDocumento')} />
          <Input label="N° Documento" placeholder="F001-00001" {...register('numeroDocumento')} />
          <Select label="Estado Pago *" options={[
            { value: 'pendiente', label: 'Pendiente' },
            { value: 'parcial',   label: 'Parcial' },
            { value: 'pagado',    label: 'Pagado' },
          ]} {...register('estadoPago')} />
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Productos *</p>
            <Button size="sm" variant="outline" icon={<Plus size={13} />}
              onClick={() => append({ productId: '', cantidad: '', costoUnitario: '' })}>
              Añadir línea
            </Button>
          </div>

          <div className="space-y-2">
            {fields.map((field, idx) => (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Select options={productOptions} placeholder="— Producto —"
                    {...register(`items.${idx}.productId`)}
                    error={errors.items?.[idx]?.productId?.message} />
                </div>
                <div className="w-24">
                  <Input type="number" step="0.01" min="0.01" placeholder="Cant."
                    {...register(`items.${idx}.cantidad`)}
                    error={errors.items?.[idx]?.cantidad?.message} />
                </div>
                <div className="w-28">
                  <Input type="number" step="0.0001" min="0" placeholder="Costo"
                    {...register(`items.${idx}.costoUnitario`)}
                    error={errors.items?.[idx]?.costoUnitario?.message} />
                </div>
                <div className="w-28 pt-0.5">
                  <p className="text-xs text-slate-500 text-right">
                    {formatCurrency((parseFloat(watchedItems[idx]?.cantidad) || 0) * (parseFloat(watchedItems[idx]?.costoUnitario) || 0))}
                  </p>
                </div>
                {fields.length > 1 && (
                  <button onClick={() => remove(idx)} className="p-2 text-slate-400 hover:text-red-500 mt-0.5">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {errors.items?.root && (
              <p className="text-xs text-red-600">{errors.items.root.message}</p>
            )}
          </div>

          {/* Totales */}
          <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-1 text-sm text-right">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span><span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>IGV (18%):</span><span>{formatCurrency(igv)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-800 text-base pt-1 border-t">
              <span>Total:</span><span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <Input label="Observaciones" {...register('observaciones')} />
      </div>
    </Modal>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

const LIMIT = 20;

export default function ComprasPage() {
  const qc = useQueryClient();
  const canCreate = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'almacenero', 'contabilidad']));
  const range = currentMonthRange();

  const [from, setFrom]       = useState(range.from);
  const [to, setTo]           = useState(range.to);
  const [page, setPage]       = useState(1);
  const [modal, setModal]     = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', { from, to, page }],
    queryFn:  () => purchasesService.getAll({ from, to, page, limit: LIMIT }),
    placeholderData: (p) => p,
  });

  const { data: pending } = useQuery({
    queryKey: ['purchases-pending'],
    queryFn:  purchasesService.getPending,
  });

  const markPaidMut = useMutation({
    mutationFn: purchasesService.markPaid,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['purchases-pending'] });
    },
  });

  const purchases  = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const estadoVariant = (e: string) =>
    e === 'pagado' ? 'success' : e === 'parcial' ? 'warning' : 'danger';

  return (
    <div className="space-y-4">
      {/* Pendientes de pago */}
      {!!pending?.length && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-3 flex items-center gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{pending.length}</strong> compra(s) pendientes de pago por un total de{' '}
            <strong>{formatCurrency(pending.reduce((a: number, p: Purchase) => a + Number(p.total), 0))}</strong>
          </p>
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-end">
        <Input label="Desde" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-36" />
        <Input label="Hasta" type="date" value={to}   onChange={(e) => { setTo(e.target.value);   setPage(1); }} className="w-36" />
        <div className="ml-auto">
          {canCreate && (
            <Button icon={<Plus size={16} />} onClick={() => setModal(true)}>Nueva Compra</Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <Card padding="none">
        <div className="flex items-center gap-2 px-5 py-3 border-b">
          <ClipboardList size={15} className="text-slate-400" />
          <span className="text-sm text-slate-600"><strong>{data?.total ?? 0}</strong> compras</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Fecha', 'Proveedor', 'Documento', 'Subtotal', 'IGV', 'Total', 'Estado', 'Registrado por', 'Acción'].map((h) => (
                  <th key={h} className="text-xs font-semibold text-slate-500 px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-slate-400">Sin compras en el período</td></tr>
              ) : purchases.map((p) => (
                <tr key={p.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.supplier.razonSocial}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.tipoDocumento && `${p.tipoDocumento} `}{p.numeroDocumento ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(Number(p.subtotal))}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(Number(p.igv))}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(Number(p.total))}</td>
                  <td className="px-4 py-3">
                    <Badge variant={estadoVariant(p.estadoPago)}>{p.estadoPago}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">—</td>
                  <td className="px-4 py-3">
                    {p.estadoPago !== 'pagado' && canCreate && (
                      <button
                        onClick={() => confirm('¿Marcar como pagado?') && markPaidMut.mutate(p.id)}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                      >
                        <CheckCircle size={13} /> Pagar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-3 border-t">
            <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" icon={<ChevronLeft size={14} />} disabled={page === 1} onClick={() => setPage((p) => p - 1)} />
              <Button variant="outline" size="sm" icon={<ChevronRight size={14} />} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} />
            </div>
          </div>
        )}
      </Card>

      <PurchaseModal open={modal} onClose={() => setModal(false)} />
    </div>
  );
}
