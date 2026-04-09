import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Pencil, Trash2, History, Truck } from 'lucide-react';
import { suppliersService } from '@/services/suppliers.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Supplier } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
import { useFormPersist } from '@/hooks/useFormPersist';

const schema = z.object({
  razonSocial:     z.string().min(2, 'Mínimo 2 caracteres'),
  ruc:             z.string().regex(/^\d{11}$/, 'RUC debe tener exactamente 11 dígitos').optional().or(z.literal('')),
  nombreContacto:  z.string().max(100)
    .refine(v => !v || !/^\d+$/.test(v) || v.length === 9, 'Si es número debe tener exactamente 9 dígitos')
    .optional().or(z.literal('')),
  telefono:        z.string().regex(/^\d{9}$/, 'El teléfono debe tener exactamente 9 dígitos').optional().or(z.literal('')),
  email:           z.string().email('Email inválido').optional().or(z.literal('')),
  direccion:       z.string().optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

function SupplierModal({ open, onClose, supplier }: { open: boolean; onClose: () => void; supplier?: Supplier | null }) {
  const qc = useQueryClient();
  const isEdit = !!supplier;
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const { clearPersisted } = useFormPersist('proveedores', watch, reset, open, isEdit);

  useEffect(() => {
    if (open) {
      reset(supplier ? {
        razonSocial:    supplier.razonSocial,
        ruc:            supplier.ruc ?? '',
        nombreContacto: supplier.nombreContacto ?? '',
        telefono:       supplier.telefono ?? '',
        email:          supplier.email ?? '',
        direccion:      supplier.direccion ?? '',
      } : {
        razonSocial: '', ruc: '', nombreContacto: '',
        telefono: '', email: '', direccion: '',
      });
    }
  }, [open, supplier]);

  const saveMut = useMutation({
    mutationFn: (d: FormData) => {
      const payload = {
        razonSocial:    d.razonSocial,
        ruc:            d.ruc            || undefined,
        nombreContacto: d.nombreContacto || undefined,
        telefono:       d.telefono       || undefined,
        email:          d.email          || undefined,
        direccion:      d.direccion      || undefined,
      };
      return isEdit ? suppliersService.update(supplier!.id, payload) : suppliersService.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); clearPersisted(); reset(); onClose(); },
  });

  const err = (saveMut.error as any)?.response?.data?.message;

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'} size="md"
      footer={<>
        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
        <Button loading={saveMut.isPending || isSubmitting} onClick={handleSubmit((d) => saveMut.mutate(d))}>
          {isEdit ? 'Guardar' : 'Crear'}
        </Button>
      </>}
    >
      <div className="space-y-4">
        {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{Array.isArray(err) ? err.join(', ') : err}</div>}
        <Input label="Razón Social *" {...register('razonSocial')} error={errors.razonSocial?.message} />
        <Input label="RUC" placeholder="20000000001" maxLength={11} {...register('ruc')} error={errors.ruc?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Contacto" {...register('nombreContacto')} error={errors.nombreContacto?.message} />
          <Input label="Teléfono" placeholder="987654321" maxLength={15} {...register('telefono')} error={errors.telefono?.message} />
        </div>
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input label="Dirección" {...register('direccion')} />
      </div>
    </Modal>
  );
}

function DeleteSupplierModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const qc = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: () => suppliersService.delete(supplier.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Eliminar Proveedor">
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          ¿Eliminar a <strong>{supplier.razonSocial}</strong>? Esta acción no se puede deshacer.
        </p>
        {deleteMut.error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {(deleteMut.error as any)?.response?.data?.message ?? 'Error al eliminar'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={deleteMut.isPending}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
            {deleteMut.isPending ? <Spinner size="sm" /> : <Trash2 size={15} />}
            {deleteMut.isPending ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function HistorialModal({ open, onClose, supplier }: { open: boolean; onClose: () => void; supplier: Supplier | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplier-historial', supplier?.id],
    queryFn:  () => suppliersService.getHistorial(supplier!.id),
    enabled:  open && !!supplier,
  });

  return (
    <Modal open={open} onClose={onClose} title={`Compras: ${supplier?.razonSocial ?? ''}`} size="lg">
      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b">
            <th className="text-left py-2 px-3 text-xs text-slate-500">Fecha</th>
            <th className="text-left py-2 px-3 text-xs text-slate-500">Documento</th>
            <th className="text-right py-2 px-3 text-xs text-slate-500">Total</th>
            <th className="text-center py-2 px-3 text-xs text-slate-500">Pago</th>
          </tr></thead>
          <tbody>
            {data?.map((p: any) => (
              <tr key={p.id} className="border-b hover:bg-slate-50">
                <td className="py-2 px-3">{formatDate(p.fecha)}</td>
                <td className="py-2 px-3 text-slate-500">{p.numeroDocumento ?? '—'}</td>
                <td className="py-2 px-3 text-right font-semibold">{formatCurrency(Number(p.total))}</td>
                <td className="py-2 px-3 text-center">
                  <Badge variant={p.estadoPago === 'pagado' ? 'success' : p.estadoPago === 'parcial' ? 'warning' : 'danger'}>{p.estadoPago}</Badge>
                </td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={4} className="py-8 text-center text-slate-400">Sin compras</td></tr>}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export default function ProveedoresPage() {
  const canEdit = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor']));
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState(false);
  const [editing, setEditing]     = useState<Supplier | null>(null);
  const [historial, setHistorial] = useState<Supplier | null>(null);
  const [toDelete, setToDelete]   = useState<Supplier | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', search],
    queryFn:  () => suppliersService.getAll(search),
    placeholderData: (p) => p,
  });

  // Backend devuelve array directo o paginado
  const suppliers = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <Input placeholder="Buscar proveedor o RUC..." icon={<Search size={15} />} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {canEdit && <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setModal(true); }}>Nuevo Proveedor</Button>}
      </div>

      <Card padding="none">
        <div className="flex items-center gap-2 px-5 py-3 border-b">
          <Truck size={15} className="text-slate-400" />
          <span className="text-sm text-slate-600"><strong>{suppliers.length}</strong> proveedores</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b">
              {['Razón Social', 'RUC', 'Contacto', 'Teléfono', 'Email', 'Deuda Pendiente', 'Acciones'].map((h) => (
                <th key={h} className="text-xs font-semibold text-slate-500 px-4 py-3 text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : suppliers.map((s) => (
                <tr key={s.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.razonSocial}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{s.ruc ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{s.nombreContacto ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{s.telefono ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{s.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    {Number(s.deudaPendiente) > 0
                      ? <span className="font-bold text-red-600">{formatCurrency(Number(s.deudaPendiente))}</span>
                      : <Badge variant="success">Al día</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setHistorial(s)} className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600" title="Historial"><History size={15} /></button>
                      {canEdit && <>
                        <button onClick={() => { setEditing(s); setModal(true); }} className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="Editar"><Pencil size={15} /></button>
                        <button onClick={() => setToDelete(s)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="Eliminar"><Trash2 size={15} /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && suppliers.length === 0 && <tr><td colSpan={7} className="py-16 text-center text-slate-400">Sin proveedores</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <SupplierModal open={modal} onClose={() => { setModal(false); setEditing(null); }} supplier={editing} />
      <HistorialModal open={!!historial} onClose={() => setHistorial(null)} supplier={historial} />
      {toDelete && <DeleteSupplierModal supplier={toDelete} onClose={() => setToDelete(null)} />}
    </div>
  );
}