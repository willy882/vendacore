import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Building2, Phone, Mail, MapPin, Camera, Save,
  CreditCard, Plus, Pencil, Check, X, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { businessService } from '@/services/business.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/auth.store';

const PAYMENT_TYPE_OPTIONS = [
  { value: 'efectivo',        label: 'Efectivo' },
  { value: 'yape',            label: 'Yape' },
  { value: 'plin',            label: 'Plin' },
  { value: 'transferencia',   label: 'Transferencia' },
  { value: 'tarjeta_debito',  label: 'Tarjeta Débito' },
  { value: 'tarjeta_credito', label: 'Tarjeta Crédito' },
  { value: 'otro',            label: 'Otro' },
];

function compressLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size <= 1 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 400;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Sección: Información del negocio ─────────────────────────────────────────

function BusinessInfoSection() {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.hasRole('administrador'));
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);

  const { data: biz, isLoading } = useQuery({
    queryKey: ['business-me'],
    queryFn: businessService.getMe,
    onSuccess: (d) => {
      reset({
        razonSocial:    d.razonSocial,
        nombreComercial: d.nombreComercial ?? '',
        direccion:      d.direccion ?? '',
        telefono:       d.telefono ?? '',
        email:          d.email ?? '',
      });
      setLogoUrl(d.logoUrl ?? null);
    },
  } as any);

  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm({
    defaultValues: { razonSocial: '', nombreComercial: '', direccion: '', telefono: '', email: '' },
  });

  const mut = useMutation({
    mutationFn: (data: any) => businessService.updateMe({ ...data, logoUrl: logoUrl ?? undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-me'] }),
  });

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoLoading(true);
    try { setLogoUrl(await compressLogo(file)); } catch { /* ignore */ }
    finally { setLogoLoading(false); e.target.value = ''; }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-800 mb-5 flex items-center gap-2">
        <Building2 size={18} className="text-blue-600" /> Información del negocio
      </h2>

      <form onSubmit={handleSubmit((d) => mut.mutate(d))} className="space-y-4">
        {/* Logo */}
        <div className="flex items-center gap-4 mb-2">
          <div
            onClick={() => isAdmin && logoRef.current?.click()}
            className={`w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0 ${isAdmin ? 'cursor-pointer hover:border-blue-400 transition-colors' : ''}`}
          >
            {logoLoading ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Camera size={22} className="text-slate-400" />
            )}
          </div>
          <div className="text-sm text-slate-500">
            <p className="font-medium text-slate-700">{biz?.razonSocial}</p>
            <p className="text-xs text-slate-400">RUC: {biz?.ruc}</p>
            {isAdmin && <p className="text-xs text-slate-400 mt-1">Haz clic en el logo para cambiarlo</p>}
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Razón social *" disabled={!isAdmin} {...register('razonSocial', { required: true })} />
          <Input label="Nombre comercial" disabled={!isAdmin} {...register('nombreComercial')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Teléfono" icon={<Phone size={14} />} disabled={!isAdmin} {...register('telefono')} />
          <Input label="Email" icon={<Mail size={14} />} disabled={!isAdmin} {...register('email')} />
        </div>
        <Input label="Dirección" icon={<MapPin size={14} />} disabled={!isAdmin} {...register('direccion')} />

        {isAdmin && (
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              icon={<Save size={15} />}
              loading={isSubmitting || mut.isPending}
              disabled={!isDirty && logoUrl === (biz?.logoUrl ?? null)}
            >
              Guardar cambios
            </Button>
          </div>
        )}

        {mut.isSuccess && (
          <p className="text-sm text-emerald-600 text-right">Cambios guardados correctamente</p>
        )}
      </form>
    </Card>
  );
}

// ── Sección: Métodos de pago ──────────────────────────────────────────────────

function PaymentMethodsSection() {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.hasRole('administrador'));
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newTipo, setNewTipo] = useState('otro');
  const [showAdd, setShowAdd] = useState(false);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['payment-methods-all'],
    queryFn: businessService.getPaymentMethods,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      businessService.updatePaymentMethod(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods-all'] }),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, nombre }: { id: string; nombre: string }) =>
      businessService.updatePaymentMethod(id, { nombre }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods-all'] }); setEditId(null); },
  });

  const createMut = useMutation({
    mutationFn: () => businessService.createPaymentMethod(newNombre.trim(), newTipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-methods-all'] });
      setNewNombre(''); setShowAdd(false);
    },
  });

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-800 mb-5 flex items-center gap-2">
        <CreditCard size={18} className="text-blue-600" /> Métodos de pago
      </h2>

      {isLoading ? <Spinner className="mx-auto" /> : (
        <ul className="space-y-2">
          {methods.map((m) => (
            <li key={m.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${m.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
              {editId === m.id ? (
                <>
                  <input
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editVal.trim()) renameMut.mutate({ id: m.id, nombre: editVal.trim() });
                      if (e.key === 'Escape') setEditId(null);
                    }}
                    className="flex-1 text-sm px-2 py-1 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={() => renameMut.mutate({ id: m.id, nombre: editVal.trim() })} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={15} /></button>
                  <button onClick={() => setEditId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={15} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-slate-700">{m.nombre}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{m.tipo}</span>
                  {isAdmin && (
                    <>
                      <button onClick={() => { setEditId(m.id); setEditVal(m.nombre); }} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Pencil size={14} /></button>
                      <button
                        onClick={() => toggleMut.mutate({ id: m.id, isActive: !m.isActive })}
                        className={`p-1 rounded transition-colors ${m.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                        title={m.isActive ? 'Desactivar' : 'Activar'}
                      >
                        {m.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <div className="mt-4">
          {showAdd ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                placeholder="Nombre del método"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newTipo}
                onChange={(e) => setNewTipo(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAYMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button size="sm" loading={createMut.isPending} disabled={!newNombre.trim()} onClick={() => createMut.mutate()}>Agregar</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(true)}>
              Nuevo método
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Configuración</h1>
        <p className="text-sm text-slate-500 mt-1">Administra los datos del negocio y métodos de pago</p>
      </div>
      <BusinessInfoSection />
      <PaymentMethodsSection />
    </div>
  );
}