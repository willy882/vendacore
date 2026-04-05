import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, ArchiveX,
  Users, Truck, ClipboardList, DollarSign, Landmark,
  BarChart2, ScrollText, Settings, LogOut, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';

interface NavItem {
  label:    string;
  to:       string;
  icon:     React.ReactNode;
  roles?:   string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    to: '/',             icon: <LayoutDashboard size={18} /> },
  { label: 'Ventas (POS)', to: '/ventas',        icon: <ShoppingCart size={18} /> },
  { label: 'Productos',    to: '/productos',     icon: <Package size={18} /> },
  { label: 'Inventario',   to: '/inventario',    icon: <ArchiveX size={18} /> },
  { label: 'Clientes',     to: '/clientes',      icon: <Users size={18} /> },
  { label: 'Proveedores',  to: '/proveedores',   icon: <Truck size={18} /> },
  { label: 'Compras',      to: '/compras',       icon: <ClipboardList size={18} />, roles: ['administrador','supervisor','almacenero','contabilidad'] },
  { label: 'Gastos',       to: '/gastos',        icon: <DollarSign size={18} />, roles: ['administrador','supervisor','contabilidad'] },
  { label: 'Caja',         to: '/caja',          icon: <Landmark size={18} /> },
  { label: 'Reportes',     to: '/reportes',      icon: <BarChart2 size={18} />, roles: ['administrador','supervisor','contabilidad','auditor'] },
  { label: 'Auditoría',    to: '/auditoria',     icon: <ScrollText size={18} />, roles: ['administrador','auditor'] },
  { label: 'Usuarios',     to: '/usuarios',      icon: <Settings size={18} />, roles: ['administrador'] },
];

interface Props {
  onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
  const { user, hasRoles } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.logout();
    useAuthStore.getState().logout();
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || hasRoles(item.roles),
  );

  return (
    <aside className="flex flex-col h-full w-64 bg-slate-900 text-slate-100">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          V
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">VendaCore</p>
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
          <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {user ? `${user.nombre[0]}${user.apellido[0]}` : '??'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {user ? `${user.nombre} ${user.apellido}` : '—'}
            </p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
