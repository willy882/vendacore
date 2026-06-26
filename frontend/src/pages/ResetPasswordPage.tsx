import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';

const schema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm:  z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm'],
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [showPwd, setShowPwd]     = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [success, setSuccess]     = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setServerError(Array.isArray(msg) ? msg[0] : (msg ?? 'Error al restablecer la contraseña.'));
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-3 text-red-500" size={48} />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Enlace inválido</h2>
          <p className="text-slate-500 text-sm mb-5">
            Este enlace no es válido o ha expirado. Solicita uno nuevo.
          </p>
          <Link to="/forgot-password" className="text-blue-600 hover:underline text-sm font-medium">
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

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
          {success ? (
            <div className="text-center py-2">
              <CheckCircle2 className="mx-auto mb-3 text-green-500" size={48} />
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Contraseña actualizada</h2>
              <p className="text-slate-500 text-sm">
                Tu contraseña fue cambiada exitosamente. Redirigiendo al inicio de sesión...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Nueva contraseña</h2>
                <p className="text-slate-400 text-sm">Elige una contraseña segura para tu cuenta.</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="relative">
                  <Input
                    label="Nueva contraseña"
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

                <div className="relative">
                  <Input
                    label="Confirmar contraseña"
                    type={showConf ? 'text' : 'password'}
                    placeholder="Repite la contraseña"
                    icon={<Lock size={16} />}
                    error={errors.confirm?.message}
                    {...register('confirm')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConf((v) => !v)}
                    className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
                  >
                    {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {serverError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {serverError}
                  </div>
                )}

                <Button type="submit" loading={isSubmitting} fullWidth size="lg">
                  Cambiar contraseña
                </Button>
              </form>
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
