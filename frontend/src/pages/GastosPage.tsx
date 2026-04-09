import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Tag, DollarSign } from 'lucide-react';
import { expensesService } from '@/services/expenses.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, currentMonthRange } from '@/lib/utils';
import type { Expense, ExpenseCategory } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
import { useFormPersist } from '@/hooks/useFormPersist';

const schema = z.object({
  descripcion:  z.string().min(2, 'Requerido'),
  monto:        z.string().min(1, 'Requerido'),
  fecha:        z.string().min(1, 'Requerido'),
  categoryId:   z.string().optional(),
  observaciones: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function ExpenseModal({ open, onClose, expense, categories }: { open: boolean; onClose: () => void; expense?: Expense | null; categories: ExpenseCategory[] }) {
  const qc = useQueryClient();
  const isEdit = !!expense;
  const today = new Date().toISOString().split('T')[0];
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const { clearPersisted } = useFormPersist('gastos', watch, reset, open, isEdit);

  useEffect(() => {
    if (open) {
      reset(expense ? {
        descripcion:   expense.descripcion,
        monto:         String(expense.monto),
        fecha:         expense.fecha.split('T')[0],
        categoryId:    expense.categoryId ?? '',
        observaciones: expense.observaciones ?? '',
      } : { fecha: today, descripcion: '', monto: '', categoryId: '', observaciones: '' });
    }
  }, [open, expense]);

  const saveMut = useMutation({
    mutationFn: (d: FormData) => {
      const payload = { ...d, monto: parseFloat(d.monto), categoryId: d.categoryId || undefined };
      return isEdit ? expensesService.update(expense!.id, payload) : expensesService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      clearPersisted();
      reset();
      onClose();
    },
  });

  const catOptions = [{ value: '', label: '— Sin categoría —' }, ...categories.map((c) => ({ value: c.id, label: c.nombre }))];

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={isEdit ? 'Editar Gasto' : 'Nuevo Gasto'} size="md"
      footer={<>
        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
        <Button loading={saveMut.isPending} onClick={handleSubmit((d) => saveMut.mutate(d))}>{isEdit ? 'Guardar' : 'Registrar'}</Button>
      </>}
    >
      <div className="space-y-4">
        <Input label="Descripción *" placeholder="Ej: Pago de luz, Alquiler..." {...register('descripcion')} error={errors.descripcion?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Monto (S/) *" type="number" step="0.01" min="0" {...register('monto')} error={errors.monto?.message} />
          <Input label="Fecha *" type="date" {...register('fecha')} error={errors.fecha?.message} />
        </div>
        <Select label="Categoría" options={catOptions} {...register('categoryId')} />
        <Textarea label="Observaciones" placeholder="Notas adicionales..." {...register('observaciones')} />
      </div>
    </Modal>
  );
}

const LIMIT = 20;

export default function GastosPage() {
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'contabilidad']));
  const range = currentMonthRange();
  const [from, setFrom]       = useState(range.from);
  const [to, setTo]           = useState(range.to);
  const [catFilter, setCatFilter] = useState('');
  const [page, setPage]       = useState(1);
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat]   = useState('');

  const { data: cats } = useQuery({ queryKey: ['expense-categories'], queryFn: expensesService.getCategories });
  const categories = cats ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', { from, to, catFilter, page }],
    queryFn:  () => expensesService.getAll({ from, to, categoryId: catFilter || undefined, page, limit: LIMIT }),
    placeholderData: (p) => p,
  });

  const { data: summary } = useQuery({
    queryKey: ['expense-summary', from, to],
    queryFn:  () => expensesService.getSummary(from, to),
  });

  const deleteMut = useMutation({
    mutationFn: expensesService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const addCatMut = useMutation({
    mutationFn: () => expensesService.createCategory(newCat.trim()),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['expense-categories'] }); setNewCat(''); },
  });

  const expenses   = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Input label="Desde" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-36" />
        <Input label="Hasta" type="date" value={to}   onChange={(e) => { setTo(e.target.value);   setPage(1); }} className="w-36" />
        <Select options={[{ value: '', label: 'Todas las categorías' }, ...categories.map((c) => ({ value: c.id, label: c.nombre }))]}
          value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }} className="w-44" label="Categoría" />
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" icon={<Tag size={15} />} onClick={() => setCatModal(true)}>Categorías</Button>
          {canEdit && <Button icon={<Plus size={15} />} onClick={() => { setEditing(null); setModal(true); }}>Nuevo Gasto</Button>}
        </div>
      </div>

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="flex items-center gap-3">
            <DollarSign size={18} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Total Gastos</p>
              <p className="font-bold text-red-600">{formatCurrency(summary.total ?? 0)}</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <Tag size={18} className="text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500">Registros</p>
              <p className="font-bold text-slate-800">{summary.count ?? expenses.length}</p>
            </div>
          </Card>
        </div>
      )}

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b">
              {['Fecha', 'Descripción', 'Categoría', 'Monto', 'Observaciones', 'Acciones'].map((h) => (
                <th key={h} className="text-xs font-semibold text-slate-500 px-4 py-3 text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-slate-400">Sin gastos en el período</td></tr>
              ) : expenses.map((e) => (
                <tr key={e.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatDate(e.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{e.descripcion}</td>
                  <td className="px-4 py-3">{e.category ? <Badge variant="info">{e.category.nombre}</Badge> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3 font-bold text-red-600">{formatCurrency(Number(e.monto))}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.observaciones ?? '—'}</td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditing(e); setModal(true); }} className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => confirm('¿Eliminar gasto?') && deleteMut.mutate(e.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
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

      <ExpenseModal open={modal} onClose={() => { setModal(false); setEditing(null); }} expense={editing} categories={categories} />

      {/* Modal categorías */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title="Categorías de Gasto" size="sm">
        <div className="flex gap-2 mb-4">
          <Input placeholder="Nueva categoría..." value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button onClick={() => newCat.trim() && addCatMut.mutate()} loading={addCatMut.isPending} icon={<Plus size={15} />} className="flex-shrink-0">Añadir</Button>
        </div>
        <ul className="space-y-1">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 text-sm">
              <Tag size={13} className="text-slate-400" /> {c.nombre}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
