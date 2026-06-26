import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/auth.store';
import { AppLayout } from '@/components/layout/AppLayout';
import { Spinner }   from '@/components/ui/Spinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ── Carga diferida: cada página es un chunk separado ──────────────────────────
const LoginPage           = lazy(() => import('@/pages/LoginPage'));
const RegisterPage        = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage  = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage   = lazy(() => import('@/pages/ResetPasswordPage'));
const SuperAdminComprasPage   = lazy(() => import('@/pages/SuperAdminComprasPage'));
const DashboardPage  = lazy(() => import('@/pages/DashboardPage'));
const SuperAdminDashboardPage    = lazy(() => import('@/pages/SuperAdminDashboardPage'));
const SuperAdminCobranzasPage    = lazy(() => import('@/pages/SuperAdminCobranzasPage'));
const SuperAdminComprobantesPage = lazy(() => import('@/pages/SuperAdminComprobantesPage'));
const SuperAdminSistemasPage     = lazy(() => import('@/pages/SuperAdminSistemasPage'));
const VentasPage     = lazy(() => import('@/pages/VentasPage'));
const ProductsPage   = lazy(() => import('@/pages/ProductsPage'));
const InventarioPage = lazy(() => import('@/pages/InventarioPage'));
const ClientesPage   = lazy(() => import('@/pages/ClientesPage'));
const ProveedoresPage= lazy(() => import('@/pages/ProveedoresPage'));
const ComprasPage    = lazy(() => import('@/pages/ComprasPage'));
const GastosPage     = lazy(() => import('@/pages/GastosPage'));
const CajaPage       = lazy(() => import('@/pages/CajaPage'));
const ReportesPage          = lazy(() => import('@/pages/ReportesPage'));
const VentasDashboardPage   = lazy(() => import('@/pages/VentasDashboardPage'));
const AuditoriaPage  = lazy(() => import('@/pages/AuditoriaPage'));
const UsuariosPage         = lazy(() => import('@/pages/UsuariosPage'));
const HistorialVentasPage  = lazy(() => import('@/pages/HistorialVentasPage'));
const ConfiguracionPage    = lazy(() => import('@/pages/ConfiguracionPage'));
const ComprobantesPage     = lazy(() => import('@/pages/ComprobantesPage'));
const CobranzasPage        = lazy(() => import('@/pages/CobranzasPage'));
const PuntoVentaPage       = lazy(() => import('@/pages/PuntoVentaPage'));
const ProformasPage        = lazy(() => import('@/pages/ProformasPage'));
const ProformaFormPage     = lazy(() => import('@/pages/ProformaFormPage'));
const KardexPage           = lazy(() => import('@/pages/KardexPage'));
const DevolucionesPage     = lazy(() => import('@/pages/DevolucionesPage'));
const SunatBoletasPage     = lazy(() => import('@/pages/SunatBoletasPage'));
const SunatNotaCreditoPage = lazy(() => import('@/pages/SunatNotaCreditoPage'));
const SunatResumenBajasPage= lazy(() => import('@/pages/SunatResumenBajasPage'));
const SunatTicketsPage     = lazy(() => import('@/pages/SunatTicketsPage'));
const ReporteProductosPage = lazy(() => import('@/pages/ReporteProductosPage'));
const ReporteUsuarioPage        = lazy(() => import('@/pages/ReporteUsuarioPage'));
const RegistrosContablesPage    = lazy(() => import('@/pages/RegistrosContablesPage'));

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

function DashboardRoute() {
  const hasRole = useAuthStore((s) => s.hasRole);
  if (hasRole('super_admin')) return <SuperAdminDashboardPage />;
  return <DashboardPage />;
}

function CobranzasRoute() {
  const hasRole = useAuthStore((s) => s.hasRole);
  if (hasRole('super_admin')) return <SuperAdminCobranzasPage />;
  return <CobranzasPage />;
}

function ComprobantesRoute() {
  const hasRole = useAuthStore((s) => s.hasRole);
  if (hasRole('super_admin')) return <SuperAdminComprobantesPage />;
  return <ComprobantesPage />;
}

function SistemasRoute() {
  const hasRole = useAuthStore((s) => s.hasRole);
  if (hasRole('super_admin')) return <SuperAdminSistemasPage />;
  return <InventarioPage />;
}

function ComprasRoute() {
  const hasRole = useAuthStore((s) => s.hasRole);
  if (hasRole('super_admin')) return <SuperAdminComprasPage />;
  return <ComprasPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />

            <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
              <Route index              element={<ErrorBoundary><DashboardRoute /></ErrorBoundary>} />
              <Route path="ventas"      element={<ErrorBoundary><VentasPage /></ErrorBoundary>} />
              <Route path="productos"   element={<ErrorBoundary><ProductsPage /></ErrorBoundary>} />
              <Route path="inventario"  element={<ErrorBoundary><SistemasRoute /></ErrorBoundary>} />
              <Route path="clientes"    element={<ErrorBoundary><ClientesPage /></ErrorBoundary>} />
              <Route path="proveedores" element={<ErrorBoundary><ProveedoresPage /></ErrorBoundary>} />
              <Route path="compras"     element={<ErrorBoundary><ComprasRoute /></ErrorBoundary>} />
              <Route path="gastos"      element={<ErrorBoundary><GastosPage /></ErrorBoundary>} />
              <Route path="caja"        element={<ErrorBoundary><CajaPage /></ErrorBoundary>} />
              <Route path="punto-venta" element={<ErrorBoundary><PuntoVentaPage /></ErrorBoundary>} />
              <Route path="reportes"          element={<ErrorBoundary><ReportesPage /></ErrorBoundary>} />
              <Route path="dashboard-ventas" element={<ErrorBoundary><VentasDashboardPage /></ErrorBoundary>} />
              <Route path="auditoria"   element={<ErrorBoundary><AuditoriaPage /></ErrorBoundary>} />
              <Route path="usuarios"         element={<ErrorBoundary><UsuariosPage /></ErrorBoundary>} />
              <Route path="historial-ventas" element={<ErrorBoundary><HistorialVentasPage /></ErrorBoundary>} />
              <Route path="comprobantes"    element={<ErrorBoundary><ComprobantesRoute /></ErrorBoundary>} />
              <Route path="cobranzas"       element={<ErrorBoundary><CobranzasRoute /></ErrorBoundary>} />
              <Route path="configuracion"   element={<ErrorBoundary><ConfiguracionPage /></ErrorBoundary>} />
              <Route path="proformas"           element={<ErrorBoundary><ProformasPage /></ErrorBoundary>} />
              <Route path="proformas/nueva"     element={<ErrorBoundary><ProformaFormPage /></ErrorBoundary>} />
              <Route path="proformas/:id/editar" element={<ErrorBoundary><ProformaFormPage /></ErrorBoundary>} />
              <Route path="kardex"              element={<ErrorBoundary><KardexPage /></ErrorBoundary>} />
              <Route path="devoluciones"        element={<ErrorBoundary><DevolucionesPage /></ErrorBoundary>} />
              <Route path="sunat/boletas"       element={<ErrorBoundary><SunatBoletasPage /></ErrorBoundary>} />
              <Route path="sunat/nota-credito"  element={<ErrorBoundary><SunatNotaCreditoPage /></ErrorBoundary>} />
              <Route path="sunat/resumen-bajas" element={<ErrorBoundary><SunatResumenBajasPage /></ErrorBoundary>} />
              <Route path="sunat/tickets"       element={<ErrorBoundary><SunatTicketsPage /></ErrorBoundary>} />
              <Route path="reportes/productos"  element={<ErrorBoundary><ReporteProductosPage /></ErrorBoundary>} />
              <Route path="reportes/usuario"    element={<ErrorBoundary><ReporteUsuarioPage /></ErrorBoundary>} />
              <Route path="reportes/contable"   element={<ErrorBoundary><RegistrosContablesPage /></ErrorBoundary>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

