import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Bell, Menu, RefreshCw, AlertTriangle, Package, X, LogOut, User, KeyRound, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface LowStockProduct {
  id: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
}

interface ProfileForm {
  nombre:      string;
  apellido:    string;
  email:       string;
  newPassword: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: cerrar al clic fuera
// ─────────────────────────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, onClose]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de notificaciones
// ─────────────────────────────────────────────────────────────────────────────

function NotifPanel({ onClose }: { onClose: () => void }) {
  const { data: alerts = [], isLoading } = useQuery<LowStockProduct[]>({
    queryKey: ['low-stock-alerts'],
    queryFn:  () => api.get<LowStockProduct[]>('/products/alerts/low-stock').then(r => r.data),
    staleTime: 60_000,
  });

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Notificaciones</span>
          {alerts.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
          <X size={14} />
        </button>
      </div>

      {/* Lista */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-400">Cargando...</div>
        ) : alerts.length === 0 ? (
          <div className="py-8 text-center">
            <Check size={24} className="mx-auto text-green-500 mb-2" />
            <p className="text-sm text-slate-500">Todo en orden</p>
            <p className="text-xs text-slate-400 mt-1">Sin alertas de stock bajo</p>
          </div>
        ) : (
          <div>
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                <AlertTriangle size={13} />
                {alerts.length} producto{alerts.length !== 1 ? 's' : ''} con stock crítico
              </p>
            </div>
            {alerts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Package size={14} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
                  <p className="text-xs text-red-600">
                    Stock: <strong>{p.stockActual}</strong> / Mín: {p.stockMinimo}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de perfil
// ─────────────────────────────────────────────────────────────────────────────

function ProfilePanel({ onClose }: { onClose: () => void }) {
  const user   = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved]     = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } =
    useForm<ProfileForm>({
      defaultValues: {
        nombre:      user?.nombre ?? '',
        apellido:    user?.apellido ?? '',
        email:       user?.email ?? '',
        newPassword: '',
      },
    });

  const updateMut = useMutation({
    mutationFn: (data: Partial<ProfileForm>) =>
      api.patch('/users/me', data).then(r => r.data),
    onSuccess: (updated) => {
      // Actualizar el store con los nuevos datos
      setAuth({ ...user!, ...updated }, useAuthStore.getState().accessToken!, useAuthStore.getState().refreshToken!);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const onSubmit = (data: ProfileForm) => {
    const payload: Partial<ProfileForm> = {
      nombre:   data.nombre,
      apellido: data.apellido,
      email:    data.email,
    };
    if (data.newPassword) payload.newPassword = data.newPassword;
    updateMut.mutate(payload);
  };

  const initials = user ? `${user.nombre[0]}${user.apellido[0]}` : '?';

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
      {/* Cabecera */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-base font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{user?.nombre} {user?.apellido}</p>
            <p className="text-slate-300 text-xs truncate">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full capitalize">
              {user?.role?.name ?? 'usuario'}
            </span>
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="p-4">
        {saved && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            <Check size={14} /> Perfil actualizado
          </div>
        )}

        {!editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 py-1">
              <User size={14} className="text-slate-400" />
              <span>{user?.nombre} {user?.apellido}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 py-1">
              <span className="text-slate-400 text-xs w-[14px] text-center">@</span>
              <span className="truncate">{user?.email}</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Nombre</label>
                <input
                  {...register('nombre', { required: true })}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Apellido</label>
                <input
                  {...register('apellido', { required: true })}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Email</label>
              <input
                {...register('email', { required: true })}
                type="email"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Nueva contraseña <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                {...register('newPassword')}
                type="password"
                placeholder="Dejar en blanco para no cambiar"
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || updateMut.isPending}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
              >
                {updateMut.isPending ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); reset(); }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
            {updateMut.isError && (
              <p className="text-xs text-red-600">{(updateMut.error as any)?.response?.data?.message ?? 'Error al guardar'}</p>
            )}
          </form>
        )}

        <div className="border-t border-slate-100 mt-3 pt-3 space-y-1">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <KeyRound size={14} className="text-slate-400" />
              Editar perfil / contraseña
            </button>
          )}
          <button
            onClick={() => { onClose(); logout(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header principal
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  title:        string;
  onMenuClick?: () => void;
  onRefresh?:   () => void;
  isRefreshing?: boolean;
}

export function Header({ title, onMenuClick, onRefresh, isRefreshing }: Props) {
  const user = useAuthStore((s) => s.user);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useClickOutside(notifRef,   () => setNotifOpen(false));
  useClickOutside(profileRef, () => setProfileOpen(false));

  // Contar alertas en tiempo real para el badge
  const { data: alerts = [] } = useQuery<LowStockProduct[]>({
    queryKey: ['low-stock-alerts'],
    queryFn:  () => api.get<LowStockProduct[]>('/products/alerts/low-stock').then(r => r.data),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,   // refresca cada 5 min en background
  });

  const initials = user ? `${user.nombre[0]}${user.apellido[0]}` : '?';

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center px-4 gap-3 flex-shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
      >
        <Menu size={20} />
      </button>

      {/* Title */}
      <h1 className="text-base font-semibold text-slate-800 flex-1">{title}</h1>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
          </button>
        )}

        {/* Notificaciones */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 relative"
            title="Notificaciones"
          >
            <Bell size={18} />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            )}
          </button>
          {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} />}
        </div>

        {/* Avatar / Perfil */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
            className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-semibold hover:bg-blue-800 transition-colors"
            title="Perfil"
          >
            {initials}
          </button>
          {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}
        </div>
      </div>
    </header>
  );
}
