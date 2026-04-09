import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { AppLayout } from '@/components/layout/AppLayout';
import { Spinner }   from '@/components/ui/Spinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ── Carga diferida: cada página es un chunk separado ──────────────────────────
const LoginPage      = lazy(() => import('@/pages/LoginPage'));
const DashboardPage  = lazy(() => import('@/pages/DashboardPage'));
const VentasPage     = lazy(() => import('@/pages/VentasPage'));
const ProductsPage   = lazy(() => import('@/pages/ProductsPage'));
const InventarioPage = lazy(() => import('@/pages/InventarioPage'));
const ClientesPage   = lazy(() => import('@/pages/ClientesPage'));
const ProveedoresPage= lazy(() => import('@/pages/ProveedoresPage'));
const ComprasPage    = lazy(() => import('@/pages/ComprasPage'));
const GastosPage     = lazy(() => import('@/pages/GastosPage'));
const CajaPage       = lazy(() => import('@/pages/CajaPage'));
const ReportesPage   = lazy(() => import('@/pages/ReportesPage'));
const AuditoriaPage  = lazy(() => import('@/pages/AuditoriaPage'));
const UsuariosPage         = lazy(() => import('@/pages/UsuariosPage'));
const HistorialVentasPage  = lazy(() => import('@/pages/HistorialVentasPage'));

// ── QueryClient: caché agresivo para menos peticiones ─────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60 * 1000,       // datos frescos por 2 minutos
      gcTime:    10 * 60 * 1000,       // mantiene caché 10 minutos
      refetchOnWindowFocus: false,     // no refetch al cambiar ventana/tab
      refetchOnReconnect: true,
    },
  },
});

// ── Spinner de carga de página ─────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

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
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

            <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
              <Route index              element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="ventas"      element={<ErrorBoundary><VentasPage /></ErrorBoundary>} />
              <Route path="productos"   element={<ErrorBoundary><ProductsPage /></ErrorBoundary>} />
              <Route path="inventario"  element={<ErrorBoundary><InventarioPage /></ErrorBoundary>} />
              <Route path="clientes"    element={<ErrorBoundary><ClientesPage /></ErrorBoundary>} />
              <Route path="proveedores" element={<ErrorBoundary><ProveedoresPage /></ErrorBoundary>} />
              <Route path="compras"     element={<ErrorBoundary><ComprasPage /></ErrorBoundary>} />
              <Route path="gastos"      element={<ErrorBoundary><GastosPage /></ErrorBoundary>} />
              <Route path="caja"        element={<ErrorBoundary><CajaPage /></ErrorBoundary>} />
              <Route path="reportes"    element={<ErrorBoundary><ReportesPage /></ErrorBoundary>} />
              <Route path="auditoria"   element={<ErrorBoundary><AuditoriaPage /></ErrorBoundary>} />
              <Route path="usuarios"         element={<ErrorBoundary><UsuariosPage /></ErrorBoundary>} />
              <Route path="historial-ventas" element={<ErrorBoundary><HistorialVentasPage /></ErrorBoundary>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

