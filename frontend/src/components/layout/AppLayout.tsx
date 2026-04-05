import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const PAGE_TITLES: Record<string, string> = {
  '/':           'Dashboard',
  '/ventas':     'Ventas (POS)',
  '/productos':  'Productos',
  '/inventario': 'Inventario',
  '/clientes':   'Clientes',
  '/proveedores':'Proveedores',
  '/compras':    'Compras',
  '/gastos':     'Gastos',
  '/caja':       'Caja',
  '/reportes':   'Reportes',
  '/auditoria':  'Auditoría',
  '/usuarios':   'Usuarios',
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Cierra el sidebar móvil en navegación
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const title = PAGE_TITLES[location.pathname] ?? 'VendaCore';

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar desktop — siempre visible */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Sidebar móvil — overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
