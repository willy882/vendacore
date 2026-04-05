import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { AppLayout }      from '@/components/layout/AppLayout';
import LoginPage          from '@/pages/LoginPage';
import DashboardPage      from '@/pages/DashboardPage';
import ProductsPage       from '@/pages/ProductsPage';
import VentasPage         from '@/pages/VentasPage';
import ClientesPage       from '@/pages/ClientesPage';
import InventarioPage     from '@/pages/InventarioPage';
import GastosPage         from '@/pages/GastosPage';
import ProveedoresPage    from '@/pages/ProveedoresPage';
import ComprasPage        from '@/pages/ComprasPage';
import CajaPage           from '@/pages/CajaPage';
import ReportesPage       from '@/pages/ReportesPage';
import AuditoriaPage      from '@/pages/AuditoriaPage';
import UsuariosPage       from '@/pages/UsuariosPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn());
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn());
  return isLoggedIn ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

          <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route index               element={<DashboardPage />} />
            <Route path="ventas"       element={<VentasPage />} />
            <Route path="productos"    element={<ProductsPage />} />
            <Route path="inventario"   element={<InventarioPage />} />
            <Route path="clientes"     element={<ClientesPage />} />
            <Route path="proveedores"  element={<ProveedoresPage />} />
            <Route path="compras"      element={<ComprasPage />} />
            <Route path="gastos"       element={<GastosPage />} />
            <Route path="caja"         element={<CajaPage />} />
            <Route path="reportes"     element={<ReportesPage />} />
            <Route path="auditoria"    element={<AuditoriaPage />} />
            <Route path="usuarios"     element={<UsuariosPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
