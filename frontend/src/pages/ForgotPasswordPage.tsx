import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';

const schema = z.object({
  email: z.string().email('Ingresa un email válido'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setServerError(Array.isArray(msg) ? msg[0] : (msg ?? 'Error al procesar la solicitud.'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl shadow-lg mb-2 p-2" style={{ background: '#0d1117' }}>
            <img src="/wcode.png" alt="WCode" className="w-full h-full object-contain" />
          </div>
          <p className="text-blue-300/70 text-sm mt-1">Sistema de Gestión</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center py-2">
              <CheckCircle2 className="mx-auto mb-3 text-green-500" size={48} />
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Revisa tu correo</h2>
              <p className="text-slate-500 text-sm mb-6">
                Si existe una cuenta con ese email, te enviamos un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.
              </p>
              <Link to="/login" className="text-blue-600 hover:underline text-sm font-medium">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-1">¿Olvidaste tu contraseña?</h2>
                <p className="text-slate-400 text-sm">
                  Ingresa tu email y te enviaremos un enlace para restablecerla.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Correo electrónico"
                  type="email"
                  placeholder="admin@empresa.com"
                  icon={<Mail size={16} />}
                  error={errors.email?.message}
                  {...register('email')}
                />

                {serverError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {serverError}
                  </div>
                )}

                <Button type="submit" loading={isSubmitting} fullWidth size="lg">
                  Enviar enlace de recuperación
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                  <ArrowLeft size={14} />
                  Volver al inicio de sesión
                </Link>
              </div>
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
