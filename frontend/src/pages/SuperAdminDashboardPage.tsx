import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, UserCheck, Clock, Ban, Eye, ToggleLeft, ToggleRight, X, AlertTriangle, KeyRound, EyeOff, MessageCircle,
  Settings, Check, Trash2, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { formatNumber } from '@/lib/utils';

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? '51999000000';

interface ExpiringSubscription {
  id: string;
  fechaFin: string;
  notas: string | null;
  business: { id: string; razonSocial: string; nombreComercial: string | null; ruc: string; status: string };
  plan: { nombre: string; precio: number } | null;
}

type BusinessStatus = 'pendiente' | 'activo' | 'suspendido' | 'cancelado';

interface UserRecord {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  isActive: boolean;
  role: { name: string };
}

interface BusinessRecord {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  telefono: string | null;
  status: BusinessStatus;
  createdAt: string;
  nubefactToken: string | null;
  sunatMode: string | null;
  subscription: {
    estado: string;
    fechaInicio: string;
    fechaFin: string;
    plan: { id: string; nombre: string; precio: number } | null;
  } | null;
  users: UserRecord[];
}

interface Overview {
  total: number;
  activos: number;
  pendientes: number;
  suspendidos: number;
}

const STATUS_BADGE: Record<BusinessStatus, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string }> = {
  activo:     { variant: 'success', label: 'Activo' },
  pendiente:  { variant: 'warning', label: 'Pendiente' },
  suspendido: { variant: 'danger',  label: 'Suspendido' },
  cancelado:  { variant: 'default', label: 'Cancelado' },
};

function KpiCard({ label, value, icon, iconBg }: { label: string; value: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <Card className="flex gap-4 items-center">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
      </div>
    </Card>
  );
}

function UsersModal({ business, onClose, onDelete }: { business: BusinessRecord; onClose: () => void; onDelete: () => void }) {
  const qc = useQueryClient();
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [loadingPwd, setLoadingPwd] = useState<Record<string, boolean>>({});
  const [visiblePwd, setVisiblePwd] = useState<Record<string, boolean>>({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sa-businesses'] });
    qc.invalidateQueries({ queryKey: ['sa-overview'] });
  };

  const fetchPassword = async (userId: string) => {
    if (passwords[userId]) {
      setVisiblePwd((p) => ({ ...p, [userId]: !p[userId] }));
      return;
    }
    setLoadingPwd((p) => ({ ...p, [userId]: true }));
    try {
      const { data } = await api.get(`/super-admin/users/${userId}/password`);
      setPasswords((p) => ({ ...p, [userId]: data.password || '(sin contraseña guardada)' }));
      setVisiblePwd((p) => ({ ...p, [userId]: true }));
    } catch {
      setPasswords((p) => ({ ...p, [userId]: '(error al obtener)' }));
      setVisiblePwd((p) => ({ ...p, [userId]: true }));
    } finally {
      setLoadingPwd((p) => ({ ...p, [userId]: false }));
    }
  };

  const toggleUserMut = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.put(`/users/${userId}`, { isActive }),
    onSuccess: () => invalidate(),
  });

  const suspendMut = useMutation({
    mutationFn: () =>
      api.patch(`/super-admin/businesses/${business.id}/status`, { status: 'suspendido' }),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const activateMut = useMutation({
    mutationFn: () =>
      api.post(`/super-admin/businesses/${business.id}/activate`, {}),
    onSuccess: () => { invalidate(); onClose(); },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Usuarios — ${business.nombreComercial ?? business.razonSocial}`}
      size="lg"
      footer={
        <div className="flex gap-2 w-full flex-wrap">
          {(business.status === 'activo' || business.status === 'pendiente') && (
            <Button variant="outline" size="sm" icon={<ToggleLeft size={14} />} loading={suspendMut.isPending} onClick={() => suspendMut.mutate()}>
              Suspender
            </Button>
          )}
          {(business.status === 'suspendido' || business.status === 'cancelado') && (
            <Button size="sm" icon={<ToggleRight size={14} />} loading={activateMut.isPending} onClick={() => activateMut.mutate()}>
              Activar
            </Button>
          )}
          <button
            onClick={() => { onClose(); onDelete(); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Trash2 size={13} />
            Eliminar negocio
          </button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose} icon={<X size={14} />}>Cerrar</Button>
        </div>
      }
    >
      <div className="space-y-2">
        {business.users.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">Sin usuarios registrados</p>
        )}
        {business.users.map((u) => (
          <div key={u.id} className="rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 p-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                {u.nombre[0]}{u.apellido[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{u.nombre} {u.apellido}</p>
                <p className="text-xs text-slate-400">{u.email} · {u.role.name}</p>
              </div>
              <Badge variant={u.isActive ? 'success' : 'danger'}>
                {u.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
              <button
                onClick={() => fetchPassword(u.id)}
                disabled={loadingPwd[u.id]}
                title="Ver contraseña"
                className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
              >
                {visiblePwd[u.id] ? <EyeOff size={14} /> : <KeyRound size={14} />}
              </button>
              <button
                onClick={() => toggleUserMut.mutate({ userId: u.id, isActive: !u.isActive })}
                disabled={toggleUserMut.isPending}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                  u.isActive
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {u.isActive ? 'Desactivar' : 'Activar'}
              </button>
            </div>
            {visiblePwd[u.id] && passwords[u.id] && (
              <div className="px-3 pb-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <KeyRound size={12} className="text-amber-600 flex-shrink-0" />
                  <span className="text-xs text-slate-600">Contraseña:</span>
                  <span className="text-xs font-mono font-semibold text-amber-800 select-all">{passwords[u.id]}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {business.users.some((u) => !u.isActive) && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
          ⚠ Hay usuarios inactivos en este negocio — no podrán iniciar sesión.
        </p>
      )}
    </Modal>
  );
}

function SunatModal({ business, onClose }: { business: BusinessRecord; onClose: () => void }) {
  const qc = useQueryClient();
  const [token, setToken] = useState(business.nubefactToken ?? '');
  const [mode, setMode] = useState<'demo' | 'produccion'>((business.sunatMode as any) ?? 'demo');
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  const mut = useMutation({
    mutationFn: () => api.patch(`/super-admin/businesses/${business.id}/sunat`, { nubefactToken: token, sunatMode: mode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-businesses'] });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    },
  });

  const nombre = business.nombreComercial ?? business.razonSocial;

  return (
    <Modal open onClose={onClose} title={`Config SUNAT — ${nombre}`} size="md"
      footer={
        <div className="flex gap-2 w-full justify-end">
          <Button variant="outline" size="sm" onClick={onClose} icon={<X size={14} />}>Cancelar</Button>
          <Button
            size="sm"
            loading={mut.isPending}
            icon={saved ? <Check size={14} /> : <Settings size={14} />}
            className={saved ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            onClick={() => mut.mutate()}
          >
            {saved ? 'Guardado' : 'Guardar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{nombre}</span> · RUC: <span className="font-mono">{business.ruc}</span>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600 mb-2">Modo de operación</p>
          <div className="flex gap-2">
            {(['demo', 'produccion'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  mode === m
                    ? m === 'demo' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-emerald-50 border-emerald-400 text-emerald-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {m === 'demo' ? 'Demo / Pruebas' : 'Producción (SUNAT real)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Token empresa (APIs Peru)
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Pega el token JWT de esta empresa en APIs Peru..."
              className="w-full px-3 py-2 pr-10 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            APIs Peru → Lista de empresas → ojo → copiar token JWT
          </p>
        </div>

        {!token && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Sin token configurado — los comprobantes de este negocio no se enviarán a SUNAT.
          </p>
        )}
        {token && mode === 'produccion' && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            Los comprobantes de este negocio se enviarán a SUNAT con validez legal.
          </p>
        )}
      </div>
    </Modal>
  );
}

function RenewModal({ business, onClose, plans }: {
  business: BusinessRecord;
  onClose: () => void;
  plans: { id: string; nombre: string; precio: number; duracionDias?: number }[];
}) {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [planId, setPlanId] = useState(business.subscription?.plan?.id ?? '');
  const [notas, setNotas] = useState('');
  const [done, setDone] = useState(false);
  const [result, setResult] = useState('');

  const mut = useMutation({
    mutationFn: () => api.post(`/super-admin/businesses/${business.id}/renew`, {
      days,
      planId: planId || undefined,
      notas: notas || undefined,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sa-businesses'] });
      qc.invalidateQueries({ queryKey: ['sa-expiring'] });
      setResult(res.data.message);
      setDone(true);
    },
  });

  const nombre = business.nombreComercial ?? business.razonSocial;
  const sub = business.subscription;
  const currentEnd = sub?.fechaFin ? new Date(sub.fechaFin).toLocaleDateString('es-PE') : '—';

  const PRESETS = [30, 60, 90, 180, 365];

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex: 9999, background: 'rgba(10,14,26,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <RefreshCw size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Renovar suscripción</h3>
              <p className="text-xs text-slate-400">{nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Check size={22} className="text-emerald-600" />
            </div>
            <p className="font-semibold text-slate-800 mb-1">Renovación exitosa</p>
            <p className="text-sm text-slate-500 mb-5">{result}</p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="bg-slate-50 rounded-xl px-4 py-3 mb-5 text-xs text-slate-500 flex justify-between">
              <span>Vencimiento actual: <span className="font-semibold text-slate-700">{currentEnd}</span></span>
              <span>Estado: <span className={`font-semibold ${business.status === 'activo' ? 'text-emerald-600' : 'text-red-500'}`}>{business.status}</span></span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">Días a agregar</p>
                <div className="flex gap-2 flex-wrap">
                  {PRESETS.map((d) => (
                    <button key={d} onClick={() => setDays(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${days === d ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {d === 365 ? '1 año' : `${d}d`}
                    </button>
                  ))}
                </div>
                <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              {plans.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1.5">Plan (opcional)</p>
                  <select value={planId} onChange={(e) => setPlanId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Sin plan asignado</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre} — S/ {p.precio}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-slate-600 mb-1.5">Notas (opcional)</p>
                <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej. Pago Yape S/99 — comprobante recibido"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {mut.isPending ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <RefreshCw size={14} />}
                Renovar {days} días
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DeleteConfirmModal({ business, onClose, onConfirm, loading }: {
  business: BusinessRecord;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [typed, setTyped] = useState('');
  const name = business.nombreComercial ?? business.razonSocial;
  const match = typed.trim().toUpperCase() === name.toUpperCase();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 9999, background: 'rgba(10,14,26,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Eliminar negocio permanentemente</h3>
            <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700 space-y-1">
          <p>Se eliminarán todos los datos de <span className="font-semibold">{name}</span>:</p>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-red-600 mt-1">
            <li>Usuarios y credenciales</li>
            <li>Historial de auditoría</li>
            <li>Suscripción y plan</li>
          </ul>
        </div>

        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Escribe <span className="font-mono font-bold text-slate-800">{name.toUpperCase()}</span> para confirmar
        </label>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={name.toUpperCase()}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-5"
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!match || loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Trash2 size={14} />}
            Eliminar definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessRecord | null>(null);
  const [sunatBiz, setSunatBiz] = useState<BusinessRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessRecord | null>(null);
  const [renewTarget, setRenewTarget] = useState<BusinessRecord | null>(null);
  const qc = useQueryClient();

  const { data: overview, isLoading: loadingOverview } = useQuery<Overview>({
    queryKey: ['sa-overview'],
    queryFn: () => api.get('/super-admin/overview').then((r) => r.data),
  });

  const { data: businesses, isLoading: loadingBusinesses, isError, refetch } = useQuery<BusinessRecord[]>({
    queryKey: ['sa-businesses'],
    queryFn: () => api.get('/super-admin/businesses').then((r) => r.data),
  });

  const { data: plans = [] } = useQuery<{ id: string; nombre: string; precio: number }[]>({
    queryKey: ['sa-plans'],
    queryFn: () => api.get('/super-admin/plans').then((r) => r.data),
    staleTime: 1000 * 60 * 30,
  });

  const { data: expiring } = useQuery<ExpiringSubscription[]>({
    queryKey: ['sa-expiring'],
    queryFn: () => api.get('/super-admin/businesses/expiring-soon').then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['sa-businesses'] });
    qc.invalidateQueries({ queryKey: ['sa-overview'] });
  };

  const activateMut = useMutation({
    mutationFn: (id: string) =>
      api.post(`/super-admin/businesses/${id}/activate`, {}),
    onSuccess: () => invalidate(),
  });

  const suspendMut = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/super-admin/businesses/${id}/status`, { status: 'suspendido' }),
    onSuccess: () => invalidate(),
  });


  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/super-admin/businesses/${id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  const isLoading = loadingOverview || loadingBusinesses;

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  if (isError || !businesses) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <AlertTriangle size={32} className="text-amber-500" />
        <p className="text-sm">No se pudo cargar el dashboard.</p>
        <button onClick={() => refetch()} className="text-blue-600 text-sm hover:underline">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard — Vista Global</h1>
        <p className="text-sm text-slate-500 mt-0.5">Resumen de la plataforma VendaCore</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Negocios"
          value={formatNumber(overview?.total ?? 0, 0)}
          icon={<Building2 size={20} className="text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <KpiCard
          label="Negocios Activos"
          value={formatNumber(overview?.activos ?? 0, 0)}
          icon={<UserCheck size={20} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <KpiCard
          label="Pendientes de Activar"
          value={formatNumber(overview?.pendientes ?? 0, 0)}
          icon={<Clock size={20} className="text-amber-500" />}
          iconBg="bg-amber-50"
        />
        <KpiCard
          label="Suspendidos"
          value={formatNumber(overview?.suspendidos ?? 0, 0)}
          icon={<Ban size={20} className="text-red-500" />}
          iconBg="bg-red-50"
        />
      </div>

      <Card padding="none">
        <CardHeader className="p-5 pb-0">
          <CardTitle>Negocios Registrados</CardTitle>
          <span className="text-xs text-slate-400">{businesses.length} negocios</span>
        </CardHeader>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Negocio</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">RUC</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Plan</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Usuarios</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Estado</th>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {businesses.length > 0 ? businesses.map((b) => {
                const statusInfo = STATUS_BADGE[b.status] ?? STATUS_BADGE.cancelado;
                const planName = b.subscription?.plan?.nombre ?? '—';
                return (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{b.nombreComercial ?? b.razonSocial}</p>
                      {b.nombreComercial && (
                        <p className="text-xs text-slate-400">{b.razonSocial}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">{b.ruc}</td>
                    <td className="px-5 py-3 text-slate-600">{planName}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{b.users.length}</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" icon={<Eye size={13} />} onClick={() => setSelectedBusiness(b)}>
                          Ver usuarios
                        </Button>
                        <Button size="sm" variant="outline" icon={<Settings size={13} />} onClick={() => setSunatBiz(b)} title="Config SUNAT" />
                        <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={() => setRenewTarget(b)} title="Renovar suscripción" className="text-blue-600 hover:border-blue-400" />
                        {b.telefono && (
                          <a
                            href={`https://wa.me/${b.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${b.nombreComercial ?? b.razonSocial}, somos VendaCore. Te contactamos para configurar tu facturación electrónica con SUNAT. ¿Tienes un momento?`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Contactar cliente: ${b.telefono}`}
                            className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <MessageCircle size={13} />
                            {b.telefono}
                          </a>
                        )}
                        {(b.status === 'activo' || b.status === 'pendiente') && (
                          <Button size="sm" variant="danger" icon={<ToggleLeft size={13} />} loading={suspendMut.isPending} onClick={() => suspendMut.mutate(b.id)}>
                            Suspender
                          </Button>
                        )}
                        {b.status === 'suspendido' && (
                          <Button size="sm" icon={<ToggleRight size={13} />} loading={activateMut.isPending} onClick={() => activateMut.mutate(b.id)}>
                            Activar
                          </Button>
                        )}
                        {b.status === 'cancelado' && (
                          <Button size="sm" variant="outline" icon={<ToggleRight size={13} />} loading={activateMut.isPending} onClick={() => activateMut.mutate(b.id)}>
                            Reactivar
                          </Button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors"
                          title="Eliminar negocio"
                        >
                          <Trash2 size={13} />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">Sin negocios registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Negocios por vencer (próximos 7 días) */}
      {expiring && expiring.length > 0 && (
        <Card padding="none">
          <CardHeader className="p-5 pb-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <CardTitle>Suscripciones por vencer ({expiring.length})</CardTitle>
            </div>
            <span className="text-xs text-slate-400">Próximos 7 días</span>
          </CardHeader>
          <div className="divide-y divide-slate-50 mt-3">
            {expiring.map((sub) => {
              const daysLeft = Math.ceil(
                (new Date(sub.fechaFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              const biz = sub.business;
              const nombre = biz.nombreComercial ?? biz.razonSocial;
              const isTrial = !sub.plan;
              const waText = encodeURIComponent(
                `Hola ${nombre} (RUC: ${biz.ruc}), tu ${isTrial ? 'período de prueba' : `plan ${sub.plan?.nombre}`} vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}. ¿Deseas renovar?`
              );
              return (
                <div key={sub.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{nombre}</p>
                    <p className="text-xs text-slate-400">{biz.ruc} · {isTrial ? 'Prueba gratuita' : sub.plan?.nombre}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    daysLeft <= 1 ? 'bg-red-100 text-red-700' :
                    daysLeft <= 3 ? 'bg-orange-100 text-orange-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {daysLeft <= 0 ? 'Vencido' : `${daysLeft}d`}
                  </span>
                  <a
                    href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
                    title="Avisar por WhatsApp"
                  >
                    <MessageCircle size={13} />
                    Avisar
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const found = businesses?.find((b) => b.id === biz.id);
                      if (found) setSelectedBusiness(found);
                    }}
                  >
                    Ver
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {selectedBusiness && (
        <UsersModal
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
          onDelete={() => { setDeleteTarget(selectedBusiness); setSelectedBusiness(null); }}
        />
      )}

      {sunatBiz && (
        <SunatModal
          business={sunatBiz}
          onClose={() => setSunatBiz(null)}
        />
      )}

      {renewTarget && (
        <RenewModal
          business={renewTarget}
          plans={plans}
          onClose={() => setRenewTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          business={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMut.mutate(deleteTarget.id)}
          loading={deleteMut.isPending}
        />
      )}
    </div>
  );
}
