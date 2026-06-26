import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, MessageCircle, X, CheckCircle2, Copy, Phone, Zap } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { queryClient } from '@/lib/queryClient';
import { productsService } from '@/services/products.service';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER?.trim() ?? '51928141669';
const YAPE_NUMBER = '928 141 669';

interface Subscription {
  estado: string;
  fechaFin: string | null;
  daysLeft: number | null;
  plan: { nombre: string; precio: number } | null;
}

// ── Planes estáticos para mostrar en el modal ─────────────────────────────────
const PLANES = [
  {
    nombre: 'Básico',
    precio: 49,
    color: 'blue',
    features: ['2 usuarios', '500 productos', 'Ventas ilimitadas', 'Reportes básicos'],
  },
  {
    nombre: 'Profesional',
    precio: 89,
    color: 'violet',
    popular: true,
    features: ['5 usuarios', '2 000 productos', 'Comprobantes SUNAT', 'Reportes avanzados'],
  },
  {
    nombre: 'Empresarial',
    precio: 149,
    color: 'emerald',
    features: ['Usuarios ilimitados', 'Productos ilimitados', 'Comprobantes SUNAT', 'Soporte prioritario'],
  },
];

// ── Modal bloqueante cuando suscripción vence ─────────────────────────────────
function SubscriptionExpiredModal({
  businessName,
  email,
}: {
  businessName?: string;
  email?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('928141669').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const waText = encodeURIComponent(
    `Hola VendaCore, quiero renovar mi suscripción.\n\nNegocio: ${businessName ?? ''}\nEmail: ${email ?? ''}`
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 mb-4">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Tu suscripción venció</h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Renueva tu plan para volver a acceder a VendaCore. El proceso es rápido — en menos de 2 horas tu cuenta estará activa.
          </p>
        </div>

        {/* Planes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {PLANES.map((plan) => (
            <div
              key={plan.nombre}
              className={`relative rounded-2xl border p-4 ${
                plan.popular
                  ? 'bg-violet-600/20 border-violet-500/50'
                  : 'bg-slate-800/60 border-slate-700/60'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-violet-500 text-white px-3 py-0.5 rounded-full uppercase tracking-wide">
                  Popular
                </span>
              )}
              <p className="text-sm font-semibold text-slate-300 mb-1">{plan.nombre}</p>
              <p className="text-3xl font-bold text-white mb-3">
                S/. {plan.precio}
                <span className="text-sm font-normal text-slate-400">/mes</span>
              </p>
              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Cómo pagar */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            Cómo renovar en 3 pasos
          </h2>
          <div className="space-y-3">
            {/* Paso 1 */}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-blue-400">1</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-300 mb-1">Yapea el monto del plan que elijas</p>
                <div className="flex items-center gap-2 bg-slate-700/60 rounded-xl px-3 py-2">
                  <Phone size={13} className="text-purple-400" />
                  <span className="text-sm font-bold text-white tracking-widest">{YAPE_NUMBER}</span>
                  <span className="text-xs text-slate-400 ml-0.5">· Willy Fernandez</span>
                  <button
                    onClick={handleCopy}
                    className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    {copied ? (
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    ) : (
                      <Copy size={12} />
                    )}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-blue-400">2</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300">Toma una captura de tu boucher de Yape</p>
                <p className="text-xs text-slate-500">Guarda el comprobante para enviarlo</p>
              </div>
            </div>

            {/* Paso 3 */}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-blue-400">3</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-300">Envía el boucher por WhatsApp e indica tu plan</p>
                <p className="text-xs text-slate-500">Activamos tu cuenta en menos de 2 horas hábiles</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botón WhatsApp */}
        <a
          href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-sm transition-colors"
        >
          <MessageCircle size={18} />
          Enviar boucher por WhatsApp
        </a>

        <p className="text-center text-xs text-slate-600 mt-3">
          ¿Problemas? Escríbenos al +51 {YAPE_NUMBER} · Horario: Lun–Sáb 9 am – 6 pm
        </p>
      </div>
    </div>
  );
}

// ── Banner de aviso (1–7 días restantes) ─────────────────────────────────────
function ExpiryBanner({ daysLeft, businessName, email }: { daysLeft: number; businessName?: string; email?: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || daysLeft <= 0) return null;

  const critical = daysLeft <= 3;

  const waText = encodeURIComponent(
    `Hola VendaCore, mi período de prueba vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'} y quiero renovar mi plan.\n\nNegocio: ${businessName ?? ''}\nEmail: ${email ?? ''}`
  );

  return (
    <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 text-sm ${
      critical ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 border-b border-amber-200'
    }`}>
      <AlertTriangle size={15} className="flex-shrink-0" />
      <span className="flex-1">
        Tu período de prueba vence en <strong>{daysLeft} día{daysLeft === 1 ? '' : 's'}</strong>. Renueva para no perder el acceso.
      </span>
      <a
        href={`https://wa.me/${WA_NUMBER}?text=${waText}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors ${
          critical ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
        }`}
      >
        <MessageCircle size={13} />
        Renovar
      </a>
      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 rounded hover:opacity-70 flex-shrink-0"
        title="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Layout principal ──────────────────────────────────────────────────────────
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role?.name === 'super_admin';

  const { data: subscription } = useQuery<Subscription | null>({
    queryKey: ['my-subscription'],
    queryFn: () => api.get('/business/subscription').then((r) => r.data),
    enabled: !isSuperAdmin && !!user,
    staleTime: 1000 * 60 * 15,
  });

  const daysLeft = subscription?.daysLeft ?? null;
  const showExpiredModal = !isSuperAdmin && daysLeft !== null && daysLeft <= 0;
  const showBanner = !isSuperAdmin && !showExpiredModal && daysLeft !== null && daysLeft <= 7;

  const businessName = (user as any)?.business?.nombreComercial
    ?? (user as any)?.business?.razonSocial
    ?? user?.nombre;

  // Precarga categorías y productos en cuanto el layout monta (despierta la DB)
  useEffect(() => {
    queryClient.prefetchQuery({ queryKey: ['categories'], queryFn: productsService.getCategories });
    queryClient.prefetchQuery({ queryKey: ['pos-products', undefined, ''], queryFn: () => productsService.getAll({ limit: 100 }) });
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      {showBanner && (
        <ExpiryBanner
          daysLeft={daysLeft!}
          businessName={businessName}
          email={user?.email}
        />
      )}

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Modal bloqueante de suscripción vencida */}
      {showExpiredModal && (
        <SubscriptionExpiredModal
          businessName={businessName}
          email={user?.email}
        />
      )}

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
