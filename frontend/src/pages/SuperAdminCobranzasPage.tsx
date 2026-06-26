import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Users, CheckCircle2, AlertCircle, Clock, X,
  Eye, ToggleLeft, Plus, CreditCard, AlertTriangle, Pencil,
} from 'lucide-react';
import { superAdminService, type BusinessWithSub, type Plan } from '@/services/super-admin.service';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { formatNumber } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  activo: 'Activo',
  suspendido: 'Suspendido',
  cancelado: 'Cancelado',
};
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  pendiente: 'warning',
  activo: 'success',
  suspendido: 'danger',
  cancelado: 'danger',
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysLeft(fechaFin?: string): number | null {
  if (!fechaFin) return null;
  const diff = new Date(fechaFin).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── Modal Activar Negocio ─────────────────────────────────────────────────────

function ActivateModal({ business, plans, onClose }: {
  business: BusinessWithSub;
  plans: Plan[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [planId, setPlanId]           = useState(plans.find((p) => p.isActive)?.id ?? '');
  const [dias, setDias]               = useState('30');
  const [monto, setMonto]             = useState('');
  const [metodoPago, setMetodoPago]   = useState('Yape');
  const [referencia, setReferencia]   = useState('');
  const [notas, setNotas]             = useState('');
  const [error, setError]             = useState('');

  const activateMut = useMutation({
    mutationFn: () => superAdminService.activateBusiness(business.id, {
      planId:         planId || undefined,
      duracionDias:   parseInt(dias) || 30,
      montoPagado:    parseFloat(monto) || 0,
      metodoPago:     metodoPago || undefined,
      referenciaPago: referencia || undefined,
      notas:          notas || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-businesses'] }); onClose(); },
    onError:   (e: any) => setError(e?.response?.data?.message ?? 'Error al activar'),
  });

  const selectedPlan   = plans.find((p) => p.id === planId);
  const fechaVencimiento = new Date(Date.now() + parseInt(dias || '30') * 86400000).toISOString();

  return (
    <Modal
      open
      onClose={onClose}
      title={`Activar — ${business.nombreComercial ?? business.razonSocial}`}
      size="md"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button size="sm" variant="outline" icon={<X size={13} />} onClick={onClose}>Cancelar</Button>
          <Button size="sm" icon={<CheckCircle2 size={13} />} loading={activateMut.isPending} onClick={() => activateMut.mutate()}>
            Activar negocio
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-sm text-blue-800">
          <p className="font-medium">{business.razonSocial}</p>
          <p className="text-xs text-blue-600 mt-0.5">RUC: {business.ruc} · {business.email ?? 'Sin email'}</p>
        </div>

        {/* Plan + duración */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Plan de suscripción</label>
          <select
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              const p = plans.find((pl) => pl.id === e.target.value);
              if (p) setDias(String(p.duracionDias));
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {plans.filter((p) => p.isActive).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — S/. {Number(p.precio).toFixed(2)} / {p.duracionDias} días
              </option>
            ))}
            <option value="">Sin plan (acceso libre)</option>
          </select>
          {selectedPlan?.descripcion && (
            <p className="text-xs text-slate-400 mt-1">{selectedPlan.descripcion}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Duración (días)</label>
            <Input type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Vence el</label>
            <p className="text-sm text-slate-700 mt-2 font-semibold">{formatDate(fechaVencimiento)}</p>
          </div>
        </div>

        {/* Registro de pago */}
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Registro de pago</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monto recibido (S/.)</label>
              <Input
                type="number" min="0" step="0.01"
                placeholder={selectedPlan ? Number(selectedPlan.precio).toFixed(2) : '0.00'}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Método de pago</label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Yape</option>
                <option>Plin</option>
                <option>Transferencia</option>
                <option>Efectivo</option>
                <option>Otro</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">Referencia / Código de operación (opcional)</label>
            <Input
              placeholder="Ej: 123456789"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notas internas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Observaciones adicionales..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
      </div>
    </Modal>
  );
}

// ── Modal Detalle Negocio ─────────────────────────────────────────────────────

function BusinessDetailModal({ business, plans, onClose }: {
  business: BusinessWithSub;
  plans: Plan[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [showActivate, setShowActivate] = useState(false);

  const statusMut = useMutation({
    mutationFn: (status: string) => superAdminService.updateBusinessStatus(business.id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-businesses'] }); onClose(); },
  });

  const days = daysLeft(business.subscription?.fechaFin);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Detalle — ${business.nombreComercial ?? business.razonSocial}`}
        size="lg"
        footer={
          <div className="flex gap-2 w-full flex-wrap">
            {business.status !== 'activo' && (
              <Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setShowActivate(true)}>
                Activar
              </Button>
            )}
            {business.status === 'activo' && (
              <Button size="sm" variant="danger" icon={<ToggleLeft size={13} />} loading={statusMut.isPending}
                onClick={() => statusMut.mutate('suspendido')}>
                Suspender
              </Button>
            )}
            {business.status === 'suspendido' && (
              <Button size="sm" variant="danger" icon={<X size={13} />} loading={statusMut.isPending}
                onClick={() => statusMut.mutate('cancelado')}>
                Cancelar suscripción
              </Button>
            )}
            <div className="flex-1" />
            <Button size="sm" variant="outline" icon={<X size={13} />} onClick={onClose}>Cerrar</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Info del negocio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 col-span-2">
              <p className="text-xs text-slate-400 mb-1">Negocio</p>
              <p className="font-semibold text-slate-800">{business.razonSocial}</p>
              <p className="text-xs text-slate-500">RUC: {business.ruc}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Plan actual</p>
              <p className="font-semibold text-slate-700">
                {business.subscription?.plan?.nombre ?? 'Sin plan'}
              </p>
              {business.subscription?.plan && (
                <p className="text-xs text-slate-500">S/. {Number(business.subscription.plan.precio).toFixed(2)}/período</p>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">Vencimiento</p>
              <p className="font-semibold text-slate-700">{formatDate(business.subscription?.fechaFin)}</p>
              {days !== null && (
                <p className={`text-xs mt-0.5 ${days <= 7 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-slate-500'}`}>
                  {days > 0 ? `${days} días restantes` : `Venció hace ${Math.abs(days)} días`}
                </p>
              )}
            </div>
          </div>

          {/* Usuarios */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Usuarios ({business.users.length})</p>
            <div className="space-y-1.5">
              {business.users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                    {u.nombre[0]}{u.apellido[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{u.nombre} {u.apellido}</p>
                    <p className="text-xs text-slate-400">{u.email} · {u.role.name}</p>
                  </div>
                  <Badge variant={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Activo' : 'Inactivo'}</Badge>
                </div>
              ))}
              {business.users.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-3">Sin usuarios registrados</p>
              )}
            </div>
          </div>

          {business.subscription?.notas && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              <p className="font-medium mb-0.5">Notas internas</p>
              <p>{business.subscription.notas}</p>
            </div>
          )}
        </div>
      </Modal>

      {showActivate && (
        <ActivateModal
          business={business}
          plans={plans}
          onClose={() => { setShowActivate(false); onClose(); }}
        />
      )}
    </>
  );
}

// ── Modal Gestión de Planes ───────────────────────────────────────────────────

function PlansModal({ plans, onClose }: { plans: Plan[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm]   = useState({ nombre: '', descripcion: '', precio: '', duracionDias: '30' });
  const [error, setError] = useState('');

  const createMut = useMutation({
    mutationFn: () => superAdminService.createPlan({
      nombre: form.nombre,
      descripcion: form.descripcion || undefined,
      precio: parseFloat(form.precio),
      duracionDias: parseInt(form.duracionDias) || 30,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-plans'] });
      setForm({ nombre: '', descripcion: '', precio: '', duracionDias: '30' });
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Error al crear'),
  });

  const toggleMut = useMutation({
    mutationFn: (plan: Plan) => superAdminService.updatePlan(plan.id, { isActive: !plan.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-plans'] }),
  });

  const canCreate = form.nombre.trim() && parseFloat(form.precio) >= 0;

  return (
    <Modal open onClose={onClose} title="Gestión de Planes" size="lg"
      footer={<Button size="sm" variant="outline" icon={<X size={13} />} onClick={onClose}>Cerrar</Button>}
    >
      <div className="space-y-5">
        {/* Crear plan */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Nuevo plan</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Nombre *</label>
              <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Empresarial" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Precio S/. *</label>
              <Input type="number" min="0" step="0.01" value={form.precio} onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Duración (días)</label>
              <Input type="number" min="1" value={form.duracionDias} onChange={(e) => setForm((f) => ({ ...f, duracionDias: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
              <Input value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Características incluidas..." />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>}
          <Button size="sm" icon={<Plus size={13} />} disabled={!canCreate} loading={createMut.isPending} onClick={() => createMut.mutate()}>
            Crear plan
          </Button>
        </div>

        {/* Lista de planes */}
        <div className="space-y-2">
          {plans.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{p.nombre}</p>
                  <Badge variant={p.isActive ? 'success' : 'danger'}>{p.isActive ? 'Activo' : 'Inactivo'}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">S/. {Number(p.precio).toFixed(2)} · {p.duracionDias} días{p.descripcion ? ` · ${p.descripcion}` : ''}</p>
              </div>
              <button
                onClick={() => toggleMut.mutate(p)}
                disabled={toggleMut.isPending}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                  p.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {p.isActive ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
          {plans.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">Sin planes creados aún</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SuperAdminCobranzasPage() {
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithSub | null>(null);
  const [showPlans, setShowPlans]     = useState(false);
  const [showActivate, setShowActivate] = useState<BusinessWithSub | null>(null);

  const { data: businesses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['sa-businesses'],
    queryFn: superAdminService.getBusinesses,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['sa-plans'],
    queryFn: superAdminService.getPlans,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <AlertTriangle size={32} className="text-amber-500" />
        <p className="text-sm">No se pudo cargar la información.</p>
        <button onClick={() => refetch()} className="text-blue-600 text-sm hover:underline">Reintentar</button>
      </div>
    );
  }

  const totalClientes   = businesses.length;
  const activos         = businesses.filter((b) => b.status === 'activo').length;
  const pendientes      = businesses.filter((b) => b.status === 'pendiente').length;
  const suspendidos     = businesses.filter((b) => b.status === 'suspendido' || b.status === 'cancelado').length;

  const filtered = businesses.filter((b) => {
    const matchSearch = !search.trim() ||
      (b.nombreComercial ?? b.razonSocial).toLowerCase().includes(search.toLowerCase()) ||
      b.ruc.includes(search);
    const matchStatus = filterStatus === 'todos' || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cobranzas — Suscripciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">Control de clientes y planes de la plataforma VendaCore</p>
        </div>
        <Button icon={<CreditCard size={14} />} onClick={() => setShowPlans(true)}>
          Gestionar planes
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total clientes',  value: totalClientes, icon: <Building2 size={18} className="text-blue-600" />,    bg: 'bg-blue-50' },
          { label: 'Activos',         value: activos,       icon: <CheckCircle2 size={18} className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Pendientes',      value: pendientes,    icon: <Clock size={18} className="text-amber-600" />,        bg: 'bg-amber-50' },
          { label: 'Suspendidos',     value: suspendidos,   icon: <AlertCircle size={18} className="text-red-500" />,    bg: 'bg-red-50' },
        ].map(({ label, value, icon, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3 items-center">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div>
            <div>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-xl font-bold text-slate-900">{formatNumber(value, 0)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alertas de pendientes */}
      {pendientes > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Clock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{pendientes} negocio{pendientes > 1 ? 's' : ''}</strong> esperando activación.
            {' '}Filtra por "Pendientes" para activarlos.
          </span>
        </div>
      )}

      <Card padding="none">
        <CardHeader className="p-5 pb-4">
          <CardTitle>Negocios Registrados</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-56">
              <Input placeholder="Buscar negocio o RUC..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="activo">Activos</option>
              <option value="suspendido">Suspendidos</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Negocio</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">RUC</th>
                <th className="text-center text-xs font-medium text-slate-500 px-5 py-3">Usuarios</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Plan</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Estado</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Vencimiento</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map((b) => {
                const days = daysLeft(b.subscription?.fechaFin);
                const expiresoon = days !== null && days >= 0 && days <= 7;
                return (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {b.nombreComercial ?? b.razonSocial}
                    </td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{b.ruc}</td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-slate-600">
                        <Users size={13} className="text-slate-400" />
                        {b.users.length}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {b.subscription?.plan?.nombre ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={STATUS_VARIANT[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <span className={expiresoon ? 'text-red-500 font-semibold' : 'text-slate-500 text-xs'}>
                        {formatDate(b.subscription?.fechaFin)}
                      </span>
                      {expiresoon && <p className="text-xs text-red-400">{days}d restantes</p>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" icon={<Eye size={12} />}
                          onClick={() => setSelectedBusiness(b)}>
                          Ver
                        </Button>
                        {b.status !== 'activo' && (
                          <Button size="sm" icon={<CheckCircle2 size={12} />}
                            onClick={() => setShowActivate(b)}>
                            Activar
                          </Button>
                        )}
                        {b.status === 'activo' && (
                          <Button size="sm" variant="outline" icon={<Pencil size={12} />}
                            onClick={() => setShowActivate(b)}>
                            Renovar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    {search || filterStatus !== 'todos' ? 'Sin resultados para los filtros aplicados' : 'Sin clientes registrados'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedBusiness && (
        <BusinessDetailModal
          business={selectedBusiness}
          plans={plans}
          onClose={() => setSelectedBusiness(null)}
        />
      )}

      {showActivate && (
        <ActivateModal
          business={showActivate}
          plans={plans}
          onClose={() => setShowActivate(null)}
        />
      )}

      {showPlans && (
        <PlansModal plans={plans} onClose={() => setShowPlans(false)} />
      )}
    </div>
  );
}
