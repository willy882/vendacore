import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight, Users, History } from 'lucide-react';
import { customersService } from '@/services/customers.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Customer } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
import { useFormPersist } from '@/hooks/useFormPersist';

const schema = z.object({
  nombreCompleto:  z.string().min(2, 'Requerido'),
  tipoDocumento:   z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE']),
  numeroDocumento: z.string().min(8, 'Mínimo 8 caracteres').max(15),
  telefono:        z.string().optional(),
  email:           z.string().email('Email inválido').optional().or(z.literal('')),
  direccion:       z.string().optional(),
  limiteCredito:   z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function CustomerModal({ open, onClose, customer }: { open: boolean; onClose: () => void; customer?: Customer | null }) {
  const qc = useQueryClient();
  const isEdit = !!customer;
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipoDocumento: 'DNI' as const },
  });
  const { clearPersisted } = useFormPersist('clientes', watch, reset, open, isEdit);

  // Cada vez que se abre el modal, poblar (o limpiar) el formulario
  useEffect(() => {
    if (open) {
      reset(customer ? {
        nombreCompleto:  customer.nombreCompleto,
        tipoDocumento:   customer.tipoDocumento as any,
        numeroDocumento: customer.numeroDocumento,
        telefono:        customer.telefono ?? '',
        email:           customer.email ?? '',
        direccion:       customer.direccion ?? '',
        limiteCredito:   String(customer.creditoLimite ?? 0),
      } : {
        nombreCompleto: '', tipoDocumento: 'DNI', numeroDocumento: '',
        telefono: '', email: '', direccion: '', limiteCredito: '',
      });
    }
  }, [open, customer]);

  const saveMut = useMutation({
    mutationFn: (data: FormData) => {
      const { limiteCredito, ...rest } = data;
      const payload = { ...rest, creditoLimite: limiteCredito ? parseFloat(limiteCredito) : undefined };
      return isEdit ? customersService.update(customer!.id, payload) : customersService.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); clearPersisted(); reset(); onClose(); },
  });

  const err = (saveMut.error as any)?.response?.data?.message;

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={isEdit ? 'Editar Cliente' : 'Nuevo Cliente'} size="md"
      footer={<>
        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
        <Button loading={saveMut.isPending || isSubmitting} onClick={handleSubmit((d) => saveMut.mutate(d))}>
          {isEdit ? 'Guardar' : 'Crear'}
        </Button>
      </>}
    >
      <div className="space-y-4">
        {err && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{Array.isArray(err) ? err.join(', ') : err}</div>}
        <Input label="Nombre completo *" {...register('nombreCompleto')} error={errors.nombreCompleto?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Tipo documento *" options={[
            { value: 'DNI', label: 'DNI' }, { value: 'RUC', label: 'RUC' },
            { value: 'CE', label: 'Carné Extranjería' }, { value: 'PASAPORTE', label: 'Pasaporte' },
          ]} {...register('tipoDocumento')} error={errors.tipoDocumento?.message} />
          <Input label="N° Documento *" {...register('numeroDocumento')} error={errors.numeroDocumento?.message} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Teléfono" {...register('telefono')} />
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        </div>
        <Input label="Dirección" {...register('direccion')} />
        <Input label="Límite de crédito (S/)" type="number" step="0.01" min="0" {...register('limiteCredito')} />
      </div>
    </Modal>
  );
}

function HistorialModal({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: Customer | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['customer-historial', customer?.id],
    queryFn:  () => customersService.getHistorial(customer!.id),
    enabled:  open && !!customer,
  });

  return (
    <Modal open={open} onClose={onClose} title={`Historial: ${customer?.nombreCompleto ?? ''}`} size="lg">
      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 px-3 text-xs text-slate-500">Fecha</th>
              <th className="text-right py-2 px-3 text-xs text-slate-500">Total</th>
              <th className="text-center py-2 px-3 text-xs text-slate-500">Tipo</th>
              <th className="text-center py-2 px-3 text-xs text-slate-500">Estado</th>
            </tr></thead>
            <tbody>
              {data?.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-slate-50">
                  <td className="py-2 px-3 text-slate-600">{formatDate(s.fecha)}</td>
                  <td className="py-2 px-3 text-right font-semibold">{formatCurrency(Number(s.total))}</td>
                  <td className="py-2 px-3 text-center"><Badge variant="info">{s.tipoVenta}</Badge></td>
                  <td className="py-2 px-3 text-center">
                    <Badge variant={s.estado === 'activa' ? 'success' : 'danger'}>{s.estado}</Badge>
                  </td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={4} className="text-center py-8 text-slate-400">Sin historial</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function DeleteModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const qc = useQueryClient();
  const deleteMut = useMutation({
    mutationFn: () => customersService.delete(customer.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Eliminar Cliente">
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          ¿Eliminar a <strong>{customer.nombreCompleto}</strong>? Esta acción no se puede deshacer.
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

const LIMIT = 20;

export default function ClientesPage() {
  const canEdit = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor']));
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<Customer | null>(null);
  const [historial, setHistorial] = useState<Customer | null>(null);
  const [toDelete, setToDelete] = useState<Customer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, page }],
    queryFn:  () => customersService.getAll({ search, page, limit: LIMIT }),
    placeholderData: (p) => p,
  });

  // El backend devuelve array directo (sin paginar)
  const customers  = Array.isArray(data) ? data : (data?.data ?? []);
  const totalPages = Array.isArray(data) ? 1 : (data?.totalPages ?? 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Buscar cliente o documento..." icon={<Search size={15} />} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {canEdit && <Button icon={<Plus size={16} />} onClick={() => { setEditing(null); setModal(true); }}>Nuevo Cliente</Button>}
      </div>

      <Card padding="none">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <Users size={15} className="text-slate-400" />
          <span className="text-sm text-slate-600"><strong>{customers.length}</strong> clientes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b">
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Nombre</th>
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Documento</th>
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Contacto</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Crédito usado</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Límite</th>
              <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Acciones</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-slate-400">Sin clientes</td></tr>
              ) : customers.map((c) => {
                const deuda = Number(c.creditoUsado);
                return (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.nombreCompleto}</td>
                    <td className="px-4 py-3 text-slate-500">{c.tipoDocumento}: {c.numeroDocumento}</td>
                    <td className="px-4 py-3 text-slate-500">{c.telefono ?? c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {deuda > 0 ? <span className="text-red-600 font-semibold">{formatCurrency(deuda)}</span> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.creditoLimite > 0 ? formatCurrency(Number(c.creditoLimite)) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setHistorial(c)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600" title="Historial">
                          <History size={15} />
                        </button>
                        {canEdit && <>
                          <button onClick={() => { setEditing(c); setModal(true); }} className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="Editar">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setToDelete(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" title="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t">
            <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" icon={<ChevronLeft size={14} />} disabled={page === 1} onClick={() => setPage((p) => p - 1)} />
              <Button variant="outline" size="sm" icon={<ChevronRight size={14} />} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} />
            </div>
          </div>
        )}
      </Card>

      <CustomerModal open={modal} onClose={() => { setModal(false); setEditing(null); }} customer={editing} />
      <HistorialModal open={!!historial} onClose={() => setHistorial(null)} customer={historial} />
      {toDelete && <DeleteModal customer={toDelete} onClose={() => setToDelete(null)} />}
    </div>
  );
}
