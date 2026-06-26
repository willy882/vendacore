import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, ShoppingCart, Package, Users,
  // UserCog, — re-habilitar cuando se active el módulo Empleados
  TrendingUp, List, Stamp, BarChart2, Settings, LogOut,
  ChevronDown, ChevronRight, KeyRound, Eye, EyeOff,
  // super admin
  LayoutDashboard, Server, CreditCard, ClipboardList, FileText, Wrench, ImageIcon,
  // sub-ítems
  Receipt, NotebookText, LineChart, HandCoins,
  UserSearch, History,
  // ClipboardCheck, CalendarCheck, — re-habilitar con módulo Empleados
  ArrowLeftRight, ArrowUpDown, RotateCcw,
  ScrollText, Globe, Landmark,
  PieChart, UserRoundSearch, BookOpen, Archive,
  Wallet, ShieldCheck,
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
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña actual</label>
                <div className="relative">
                  <input type={showCurrent ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)}
                    className="w-full px-3 py-2 pr-9 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input type={showNext ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)}
                    className="w-full px-3 py-2 pr-9 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowNext(!showNext)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Confirmar contraseña</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors font-medium">
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Super Admin nav (sin cambios) ─────────────────────────────────────────────

const SUPER_ADMIN_ITEMS = [
  { label: 'Dashboard',     to: '/',             icon: <LayoutDashboard size={18} /> },
  { label: 'Mis Sistemas',  to: '/inventario',   icon: <Server size={18} /> },
  { label: 'Cobranzas',     to: '/cobranzas',    icon: <CreditCard size={18} /> },
  { label: 'Proveedores',   to: '/proveedores',  icon: <Package size={18} /> },
  { label: 'Compras',       to: '/compras',      icon: <ClipboardList size={18} /> },
  { label: 'Reportes',      to: '/reportes',     icon: <BarChart2 size={18} /> },
  { label: 'Comprobantes',  to: '/comprobantes', icon: <ImageIcon size={18} /> },
  { label: 'Usuarios',      to: '/usuarios',     icon: <Users size={18} /> },
  { label: 'Configuración', to: '/configuracion', icon: <Wrench size={18} /> },
  { label: 'Comprobantes SUNAT', to: '/comprobantes', icon: <FileText size={18} /> },
];

// ── Tipos ─────────────────────────────────────────────────────────────────────

// roles: si está definido, solo se muestra para esos roles. Si omitido, todos.
interface SubItem {
  label: string;
  to:    string;
  icon?: React.ReactNode;
  roles?: string[];
}

interface SidebarSection {
  label:       string;
  icon:        React.ReactNode;
  standalone?: string;
  items?:      SubItem[];
  action?:     () => void;
  roles?:      string[];
}

// ── Sección colapsable ────────────────────────────────────────────────────────

function Section({ section, defaultOpen, onClose, hasRoles }: {
  section:    SidebarSection;
  defaultOpen: boolean;
  onClose?:   () => void;
  hasRoles:   (roles: string[]) => boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (section.standalone) {
    return (
      <NavLink
        to={section.standalone}
        end={section.standalone === '/'}
        onClick={onClose}
        className={({ isActive }) =>
          cn('flex items-center gap-3 px-4 py-3 text-sm transition-colors',
            isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-50')
        }
      >
        <span className="text-slate-500 w-5 flex-shrink-0">{section.icon}</span>
        <span className="flex-1">{section.label}</span>
      </NavLink>
    );
  }

  if (section.action) {
    return (
      <button onClick={section.action}
        className="flex items-center gap-3 px-4 py-3 w-full text-sm text-slate-700 hover:bg-slate-50 transition-colors">
        <span className="text-slate-500 w-5 flex-shrink-0">{section.icon}</span>
        <span className="flex-1 text-left">{section.label}</span>
      </button>
    );
  }

  // Filtrar sub-ítems por rol
  const visibleItems = (section.items ?? []).filter(
    (item) => !item.roles || hasRoles(item.roles),
  );
  if (visibleItems.length === 0) return null;

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 px-4 py-3 w-full text-sm text-slate-700 hover:bg-slate-50 transition-colors">
        <span className="text-slate-500 w-5 flex-shrink-0">{section.icon}</span>
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown size={15} className={cn('text-slate-400 transition-transform', open ? '' : '-rotate-90')} />
      </button>
      {open && (
        <div className="bg-slate-50 border-b border-slate-100">
          {visibleItems.map((item) => (
            <NavLink key={item.label} to={item.to} onClick={onClose}
              className={({ isActive }) =>
                cn('flex items-center gap-3 px-6 py-2.5 text-sm transition-colors',
                  isActive ? 'text-blue-600 font-semibold bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex-shrink-0', isActive ? 'text-blue-500' : 'text-slate-400')}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar principal ─────────────────────────────────────────────────────────

interface Props { onClose?: () => void; }

export function Sidebar({ onClose }: Props) {
  const { user, hasRole, hasRoles } = useAuthStore();
  const isSuperAdmin = hasRole('super_admin');
  const navigate = useNavigate();
  const location = useLocation();
  const [showChangePwd, setShowChangePwd] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    useAuthStore.getState().logout();
    navigate('/login');
  };

  const S = 15; // tamaño de íconos sub-ítem

  // Roles de referencia
  const ADMIN_SUP   = ['administrador', 'supervisor'];
  const ADMIN_ONLY  = ['administrador'];
  const VENTAS_ROLES = ['administrador', 'supervisor', 'cajero', 'vendedor'];
  const FINANZAS_ROLES = ['administrador', 'supervisor', 'contabilidad'];
  const ALMACEN_ROLES  = ['administrador', 'supervisor', 'almacenero'];
  const SUNAT_ROLES    = ['administrador', 'supervisor', 'contabilidad', 'auditor'];
  const REPORTE_ROLES  = ['administrador', 'supervisor', 'contabilidad', 'auditor'];

  const SECTIONS: SidebarSection[] = [
    { label: 'Home', icon: <Home size={18} />, standalone: '/' },

    // ── Venta: cajeros y vendedores ──────────────────────────────────────
    { label: 'Venta', icon: <ShoppingCart size={18} />, roles: VENTAS_ROLES, items: [
        { label: 'Punto de Venta', to: '/punto-venta',     icon: <Receipt      size={S} />, roles: VENTAS_ROLES },
        { label: 'Proformas',      to: '/proformas',        icon: <NotebookText size={S} />, roles: [...ADMIN_SUP, 'vendedor'] },
        { label: 'Flujo de Caja',  to: '/caja',            icon: <LineChart    size={S} />, roles: [...ADMIN_SUP, 'cajero', 'contabilidad'] },
      ]},

    // ── Productos: almacén, vendedores ───────────────────────────────────
    { label: 'Productos', icon: <Package size={18} />, roles: [...ALMACEN_ROLES, 'vendedor'], items: [
        { label: 'Productos',   to: '/productos',   icon: <Package      size={S} /> },
        { label: 'Inventario',  to: '/inventario',  icon: <ArrowUpDown  size={S} />, roles: ALMACEN_ROLES },
      ]},

    // ── Clientes: ventas y admin ─────────────────────────────────────────
    { label: 'Clientes', icon: <Users size={18} />, roles: [...VENTAS_ROLES, 'contabilidad', 'auditor'], items: [
        { label: 'Lista Clientes',   to: '/clientes',         icon: <UserSearch size={S} /> },
        { label: 'Historial Compra', to: '/historial-ventas', icon: <History    size={S} />, roles: VENTAS_ROLES },
      ]},

    // ── Finanzas: admin, supervisor, contabilidad ────────────────────────
    { label: 'Finanzas', icon: <TrendingUp size={18} />, roles: FINANZAS_ROLES, items: [
        { label: 'Gastos',     to: '/gastos',    icon: <Wallet     size={S} /> },
        { label: 'C x Cobrar', to: '/cobranzas', icon: <HandCoins  size={S} /> },
      ]},

    // ── Kardex: almacén, admin ───────────────────────────────────────────
    { label: 'Kardex', icon: <List size={18} />, roles: [...ALMACEN_ROLES, 'auditor'], items: [
        { label: 'Kardex',       to: '/kardex',       icon: <ArrowLeftRight size={S} /> },
        { label: 'Devoluciones', to: '/devoluciones', icon: <RotateCcw      size={S} />, roles: ALMACEN_ROLES },
      ]},

    // ── SUNAT: admin, contabilidad, auditor ──────────────────────────────
    { label: 'SUNAT', icon: <Stamp size={18} />, roles: SUNAT_ROLES, items: [
        { label: 'Boletas, Facturas', to: '/sunat/boletas',       icon: <ScrollText size={S} /> },
        { label: 'N.Credito',         to: '/sunat/nota-credito',  icon: <Landmark   size={S} /> },
        { label: 'Resumen Bajas',     to: '/sunat/resumen-bajas', icon: <Archive    size={S} /> },
        { label: 'Tickets',           to: '/sunat/tickets',       icon: <Globe      size={S} />, roles: ADMIN_SUP },
      ]},

    // ── Reportes: admin, supervisor, contabilidad, auditor ───────────────
    { label: 'REPORTES', icon: <BarChart2 size={18} />, roles: REPORTE_ROLES, items: [
        { label: 'Comprobantes',    to: '/comprobantes',       icon: <FileText        size={S} /> },
        { label: 'Ranking Semanal', to: '/dashboard-ventas',   icon: <PieChart        size={S} />, roles: ADMIN_SUP },
        { label: 'X Producto',      to: '/reportes/productos', icon: <BookOpen        size={S} />, roles: [...ADMIN_SUP, 'contabilidad'] },
        { label: 'X Usuario',       to: '/reportes/usuario',   icon: <UserRoundSearch size={S} />, roles: ADMIN_SUP },
        { label: 'Reg. Contable',   to: '/reportes/contable',  icon: <NotebookText    size={S} />, roles: REPORTE_ROLES },
      ]},

    // ── Administración: solo admin y auditor ─────────────────────────────
    { label: 'Administración', icon: <ShieldCheck size={18} />, roles: [...ADMIN_SUP, 'auditor'], items: [
        { label: 'Configuración', to: '/configuracion', icon: <Settings    size={S} />, roles: ADMIN_ONLY },
        { label: 'Usuarios',      to: '/usuarios',      icon: <Users       size={S} />, roles: ADMIN_ONLY },
        { label: 'Auditoría',     to: '/auditoria',     icon: <ClipboardList size={S} />, roles: [...ADMIN_SUP, 'auditor'] },
      ]},

    { label: 'Cerrar Sesion', icon: <LogOut size={18} />, action: handleLogout },
  ];

  const isGroupActive = (section: SidebarSection) =>
    !!section.items?.some((item) => location.pathname.startsWith(item.to));

  return (
    <>
    <aside className="flex flex-col h-screen bg-white border-r border-slate-200 overflow-hidden"
      style={{ width: '260px' }}>

      {/* ── Cabecera ── */}
      {isSuperAdmin ? (
        // Super admin: logo W_Code original
        <div className="flex items-center gap-3 px-4 py-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/wcode.png" alt="WCode" className="w-full h-full object-contain p-0.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-none">WCode</p>
            <p className="text-xs text-slate-400 mt-0.5">Super Admin</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      ) : (
        // Usuarios normales: negocio + usuario
        <div className="flex items-center gap-3 px-4 py-4 bg-slate-800 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
            {(user as any)?.avatarUrl
              ? <img src={(user as any).avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : (user as any)?.business?.nombreComercial
                ? (user as any).business.nombreComercial[0].toUpperCase()
                : user ? `${user.nombre[0]}` : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate leading-tight">
              {(user as any)?.business?.nombreComercial?.toUpperCase()
                ?? (user as any)?.business?.razonSocial?.toUpperCase()
                ?? '—'}
            </p>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              {user ? `${user.nombre} ${user.apellido}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Navegación ── */}
      <nav className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {isSuperAdmin ? (
          // Super admin: lista plana original
          SUPER_ADMIN_ITEMS.map((item) => (
            <NavLink key={item.to + item.label} to={item.to} end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn('flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                  isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-700 hover:bg-slate-50')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={14} className="text-blue-200" />}
                </>
              )}
            </NavLink>
          ))
        ) : (
          // Usuarios normales: secciones colapsables filtradas por rol
          SECTIONS
            .filter((s) => !s.roles || hasRoles(s.roles))
            .map((section) => (
              <Section
                key={section.label}
                section={section}
                defaultOpen={isGroupActive(section)}
                onClose={onClose}
                hasRoles={hasRoles}
              />
            ))
        )}

        <button onClick={() => setShowChangePwd(true)}
          className="flex items-center gap-3 px-4 py-3 w-full text-sm text-slate-500 hover:bg-slate-50 transition-colors">
          <KeyRound size={16} className="w-5 flex-shrink-0" />
          <span>Cambiar contraseña</span>
        </button>

        <button onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-sm text-red-500 hover:bg-red-50 transition-colors">
          <LogOut size={16} className="w-5 flex-shrink-0" />
          <span>Cerrar sesión</span>
        </button>
      </nav>
    </aside>

    {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  );
}
