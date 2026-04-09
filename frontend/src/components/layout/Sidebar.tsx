import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, ArchiveX,
  Users, Truck, ClipboardList, DollarSign, Landmark,
  BarChart2, ScrollText, Settings, LogOut, ChevronRight, History,
  FileText, CreditCard, Wrench, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import api from '@/lib/api';

// ── Modal cambio de contraseña ────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const handleSubmit = async () => {
    if (!current || !next || !confirm) { setErr('Completa todos los campos'); return; }
    if (next.length < 6) { setErr('La nueva contraseña debe tener al menos 6 caracteres'); return; }
    if (next !== confirm) { setErr('Las contraseñas no coinciden'); return; }
    setErr(''); setLoading(true);
    try {
      await api.post('/users/me/change-password', { currentPassword: current, newPassword: next });
      setOk(true);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-blue-600" />
          <h2 className="text-base font-semibold text-slate-800">Cambiar contraseña</h2>
        </div>

        {ok ? (
          <p className="text-sm text-emerald-600 text-center py-4">Contraseña actualizada correctamente</p>
        ) : (
          <>
            <div className="space-y-3">
              {/* Contraseña actual */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña actual</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    className="w-full px-3 py-2 pr-9 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {/* Nueva contraseña */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showNext ? 'text' : 'password'}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    className="w-full px-3 py-2 pr-9 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={() => setShowNext(!showNext)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {/* Confirmar */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors font-medium"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface NavItem {
  label:    string;
  to:       string;
  icon:     React.ReactNode;
  roles?:   string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    to: '/',             icon: <LayoutDashboard size={18} /> },
  { label: 'Ventas (POS)', to: '/ventas',          icon: <ShoppingCart size={18} /> },
  { label: 'Historial Ventas', to: '/historial-ventas', icon: <History size={18} /> },
  { label: 'Productos',    to: '/productos',     icon: <Package size={18} /> },
  { label: 'Inventario',   to: '/inventario',    icon: <ArchiveX size={18} /> },
  { label: 'Clientes',     to: '/clientes',      icon: <Users size={18} /> },
  { label: 'Proveedores',  to: '/proveedores',   icon: <Truck size={18} /> },
  { label: 'Compras',      to: '/compras',       icon: <ClipboardList size={18} />, roles: ['administrador','supervisor','almacenero','contabilidad'] },
  { label: 'Gastos',       to: '/gastos',        icon: <DollarSign size={18} />, roles: ['administrador','supervisor','contabilidad'] },
  { label: 'Caja',         to: '/caja',          icon: <Landmark size={18} /> },
  { label: 'Reportes',     to: '/reportes',      icon: <BarChart2 size={18} />, roles: ['administrador','supervisor','contabilidad','auditor'] },
  { label: 'Comprobantes', to: '/comprobantes',  icon: <FileText size={18} />, roles: ['administrador','supervisor','cajero','contabilidad'] },
  { label: 'Cobranzas',   to: '/cobranzas',     icon: <CreditCard size={18} />, roles: ['administrador','supervisor','cajero'] },
  { label: 'Auditoría',   to: '/auditoria',     icon: <ScrollText size={18} />, roles: ['administrador','auditor'] },
  { label: 'Usuarios',    to: '/usuarios',      icon: <Settings size={18} />, roles: ['administrador'] },
  { label: 'Configuración', to: '/configuracion', icon: <Wrench size={18} />, roles: ['administrador'] },
];

interface Props {
  onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
  const { user, hasRoles } = useAuthStore();
  const navigate = useNavigate();
  const [showChangePwd, setShowChangePwd] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    useAuthStore.getState().logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || hasRoles(item.roles),
  );

  return (
    <>
    <aside className="flex flex-col h-full w-64 bg-slate-900 text-slate-100">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/50">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0 p-1">
          <img src="/logo.png" alt="Ozzo Coffee" className="w-full h-full object-contain" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">Ozzo Coffee</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[140px]">
            {user?.role?.name ?? 'Sistema'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 mb-0.5',
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight size={14} className="text-blue-200" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700/50 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg mb-1">
          <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden">
            {(user as any)?.avatarUrl
              ? <img src={(user as any).avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : user ? `${user.nombre[0]}${user.apellido[0]}` : '??'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {user ? `${user.nombre} ${user.apellido}` : '—'}
            </p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => setShowChangePwd(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <KeyRound size={16} />
          Cambiar contraseña
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>

    {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  );
}
