import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, Building2, User, Phone, Hash, CheckCircle2, MessageCircle, Clock } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? '51999000000';

const schema = z.object({
  nombreNegocio: z.string().min(2, 'Mínimo 2 caracteres'),
  ruc: z.string().regex(/^\d{11}$/, 'El RUC debe tener exactamente 11 dígitos'),
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  apellido: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  telefono: z.string().min(7, 'Ingresa tu número de WhatsApp').max(20),
});

type FormData = z.infer<typeof schema>;

type RegisteredData = {
  nombreNegocio: string;
  ruc: string;
  nombre: string;
  email: string;
  telefono: string;
};

export default function RegisterPage() {
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registeredData, setRegisteredData] = useState<RegisteredData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await authService.register(data);
      setRegisteredData({
        nombreNegocio: data.nombreNegocio,
        ruc: data.ruc,
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono,
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setServerError(Array.isArray(msg) ? msg[0] : (msg ?? 'Error al registrar. Intenta de nuevo.'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl shadow-lg mb-2 p-2" style={{ background: '#0d1117' }}>
            <img src="/wcode.png" alt="WCode" className="w-full h-full object-contain" />
          </div>
          <p className="text-blue-300/70 text-sm mt-1">Sistema de Gestión Comercial</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {success ? (
            <div className="py-2">
              <div className="text-center mb-5">
                <CheckCircle2 className="mx-auto mb-3 text-green-500" size={48} />
                <h2 className="text-xl font-semibold text-slate-800 mb-1">¡Registro exitoso!</h2>
                <p className="text-slate-500 text-sm">
                  Hola <span className="font-medium text-slate-700">{registeredData?.nombre}</span>, ya puedes usar
                  el sistema con tu negocio <span className="font-medium text-slate-700">{registeredData?.nombreNegocio}</span>.
                </p>
              </div>

              {/* Trial */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-blue-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-blue-800">30 días de prueba gratuita activos</p>
                </div>
                <p className="text-xs text-blue-600">
                  Tienes acceso completo al sistema. Al terminar el período, renueva tu plan para continuar.
                </p>
              </div>

              {/* SUNAT activation notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">Para activar tu facturación SUNAT</p>
                <p className="text-xs text-amber-700 mb-3">
                  Nuestro equipo te contactará al número <span className="font-semibold">{registeredData?.telefono}</span> para
                  solicitarte tus credenciales SOL de SUNAT y configurar tu facturación electrónica.
                </p>
                <a
                  href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
                    `Hola! Acabo de registrarme en VendaCore y quiero activar mi facturación SUNAT.\n\nNegocio: ${registeredData?.nombreNegocio}\nRUC: ${registeredData?.ruc}\nEmail: ${registeredData?.email}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                  <MessageCircle size={15} />
                  Escribirnos ahora por WhatsApp
                </a>
                <p className="text-xs text-amber-600 mt-2 text-center">
                  O espera — te contactaremos pronto al número que registraste
                </p>
              </div>

              <Link
                to="/login"
                className="block text-center text-sm text-blue-600 hover:underline font-medium"
              >
                Ingresar al sistema
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Crear cuenta</h2>
              <p className="text-slate-400 text-sm mb-6">Registra tu negocio — 30 días gratis, sin compromiso</p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Datos del negocio</p>

                <Input
                  label="Nombre del negocio *"
                  placeholder="Ej. Bodega Central"
                  icon={<Building2 size={16} />}
                  error={errors.nombreNegocio?.message}
                  {...register('nombreNegocio')}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="RUC *"
                    placeholder="20XXXXXXXXX"
                    icon={<Hash size={16} />}
                    error={errors.ruc?.message}
                    {...register('ruc')}
                  />
                  <Input
                    label="WhatsApp / Teléfono *"
                    placeholder="999 000 000"
                    icon={<Phone size={16} />}
                    error={errors.telefono?.message}
                    {...register('telefono')}
                  />
                </div>
                <p className="text-xs text-slate-400 -mt-2">
                  Te contactaremos a este número para configurar tu facturación SUNAT
                </p>

                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-1">Tu cuenta de acceso</p>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Nombre *"
                    placeholder="Juan"
                    icon={<User size={16} />}
                    error={errors.nombre?.message}
                    {...register('nombre')}
                  />
                  <Input
                    label="Apellido *"
                    placeholder="Pérez"
                    icon={<User size={16} />}
                    error={errors.apellido?.message}
                    {...register('apellido')}
                  />
                </div>

                <Input
                  label="Correo electrónico *"
                  type="email"
                  placeholder="admin@minegocio.com"
                  icon={<Mail size={16} />}
                  error={errors.email?.message}
                  {...register('email')}
                />

                <div className="relative">
                  <Input
                    label="Contraseña *"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    icon={<Lock size={16} />}
                    error={errors.password?.message}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {serverError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {serverError}
                  </div>
                )}

                <Button type="submit" loading={isSubmitting} fullWidth size="lg" className="mt-2">
                  Crear cuenta gratis
                </Button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-5">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-blue-600 hover:underline font-medium">
                  Inicia sesión
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          VendaCore © {new Date().getFullYear()} · by <span className="text-blue-400 font-medium">WCode</span>
        </p>
      </div>
    </div>
  );
}
