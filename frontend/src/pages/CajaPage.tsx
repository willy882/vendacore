import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Landmark, Plus, Lock, Unlock, TrendingUp,
  TrendingDown, RefreshCw,
} from 'lucide-react';
import { cashService } from '@/services/cash.service';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

// ── Open session modal ────────────────────────────────────────────────────────

const openSchema = z.object({ montoApertura: z.string().min(1, 'Requerido'), observaciones: z.string().optional() });
type OpenForm = z.infer<typeof openSchema>;

function OpenSessionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<OpenForm>({ resolver: zodResolver(openSchema) });

  const openMut = useMutation({
    mutationFn: (d: OpenForm) => cashService.open(parseFloat(d.montoApertura), d.observaciones),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['cash-active'] }); reset(); onClose(); },
  });

  const err = (openMut.error as any)?.response?.data?.message;

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Abrir Sesión de Caja" size="sm"
      footer={<>
        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
        <Button loading={openMut.isPending} onClick={handleSubmit((d) => openMut.mutate(d))} icon={<Unlock size={15} />}>Abrir Caja</Button>
      </>}
    >
      <div className="space-y-4">
        {err && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{Array.isArray(err) ? err.join(', ') : err}</div>}
        <Input label="Monto de apertura (S/) *" type="number" step="0.01" min="0" placeholder="0.00" {...register('montoApertura')} error={errors.montoApertura?.message} />
        <Input label="Observaciones" {...register('observaciones')} />
      </div>
    </Modal>
  );
}

// ── Close session modal ───────────────────────────────────────────────────────

const closeSchema = z.object({ montoCierreReal: z.string().min(1, 'Requerido'), observaciones: z.string().optional() });
type CloseForm = z.infer<typeof closeSchema>;

function CloseSessionModal({ open, onClose, sessionId, saldoSistema }: {
  open: boolean; onClose: () => void; sessionId: string; saldoSistema: number;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CloseForm>({ resolver: zodResolver(closeSchema) });
  const realVal = parseFloat(watch('montoCierreReal') || '0') || 0;
  const diferencia = realVal - saldoSistema;

  const closeMut = useMutation({
    mutationFn: (d: CloseForm) => cashService.close(sessionId, parseFloat(d.montoCierreReal), d.observaciones),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['cash-active'] }); qc.invalidateQueries({ queryKey: ['cash-sessions'] }); reset(); onClose(); },
  });

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Cerrar Sesión de Caja" size="sm"
      footer={<>
        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
        <Button variant="danger" loading={closeMut.isPending} onClick={handleSubmit((d) => closeMut.mutate(d))} icon={<Lock size={15} />}>Cerrar Caja</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-500">Saldo según sistema:</span><span className="font-bold">{formatCurrency(saldoSistema)}</span></div>
        </div>
        <Input label="Monto real en caja (S/) *" type="number" step="0.01" min="0" placeholder="0.00" {...register('montoCierreReal')} error={errors.montoCierreReal?.message} />
        {realVal > 0 && (
          <div className={`rounded-lg px-3 py-2 text-sm ${diferencia === 0 ? 'bg-emerald-50 text-emerald-700' : diferencia > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
            {diferencia === 0 ? 'Caja cuadrada ✓' : diferencia > 0 ? `Sobrante: ${formatCurrency(diferencia)}` : `Faltante: ${formatCurrency(Math.abs(diferencia))}`}
          </div>
        )}
        <Input label="Observaciones" {...register('observaciones')} />
      </div>
    </Modal>
  );
}

// ── Add movement modal ────────────────────────────────────────────────────────

const movSchema = z.object({
  tipo:       z.enum(['ingreso', 'egreso']),
  monto:      z.string().min(1, 'Requerido'),
  concepto:   z.string().min(2, 'Requerido'),
  referencia: z.string().optional(),
});
type MovForm = z.infer<typeof movSchema>;

function MovementModal({ open, onClose, sessionId }: { open: boolean; onClose: () => void; sessionId: string }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MovForm>({
    resolver: zodResolver(movSchema),
    defaultValues: { tipo: 'ingreso' },
  });

  const movMut = useMutation({
    mutationFn: (d: MovForm) => cashService.addMovement(sessionId, {
      tipo: d.tipo, monto: parseFloat(d.monto), concepto: d.concepto, referencia: d.referencia,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-active'] }); reset(); onClose(); },
  });

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Registrar Movimiento" size="sm"
      footer={<>
        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
        <Button loading={movMut.isPending} onClick={handleSubmit((d) => movMut.mutate(d))}>Registrar</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          {['ingreso', 'egreso'].map((t) => (
            <label key={t} className="flex-1 cursor-pointer">
              <input type="radio" value={t} {...register('tipo')} className="sr-only" />
              <div className={`py-2.5 rounded-lg border text-sm font-medium text-center transition-colors ${t === 'ingreso' ? 'peer-checked:bg-emerald-600' : 'peer-checked:bg-red-600'}`}>
                {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
              </div>
            </label>
          ))}
          <Select options={[{ value: 'ingreso', label: '↑ Ingreso' }, { value: 'egreso', label: '↓ Egreso' }]}
            {...register('tipo')} className="flex-1" />
        </div>
        <Input label="Monto (S/) *" type="number" step="0.01" min="0.01" {...register('monto')} error={errors.monto?.message} />
        <Input label="Concepto *" placeholder="Ej: Pago arriendo, Préstamo..." {...register('concepto')} error={errors.concepto?.message} />
        <Input label="Referencia" placeholder="N° documento, etc." {...register('referencia')} />
      </div>
    </Modal>
  );
}

// ── Arqueo modal ──────────────────────────────────────────────────────────────

function ArqueoModal({ open, onClose, sessionId }: { open: boolean; onClose: () => void; sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['arqueo', sessionId],
    queryFn:  () => cashService.getArqueo(sessionId),
    enabled:  open && !!sessionId,
  });

  return (
    <Modal open={open} onClose={onClose} title="Arqueo de Caja" size="lg">
      {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Apertura',   value: data.montoApertura, color: 'text-slate-700' },
              { label: 'Ingresos',   value: data.totalIngresos, color: 'text-emerald-600' },
              { label: 'Egresos',    value: data.totalEgresos,  color: 'text-red-600' },
              { label: 'Ventas',     value: data.totalVentas,   color: 'text-blue-600' },
              { label: 'Saldo',      value: data.saldoActual,   color: 'text-slate-900' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`font-bold text-base ${color}`}>{formatCurrency(Number(value ?? 0))}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <p className="text-sm font-semibold text-slate-700 mb-2">Movimientos</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-slate-50">
                <th className="text-left px-3 py-2 text-xs text-slate-500">Hora</th>
                <th className="text-left px-3 py-2 text-xs text-slate-500">Concepto</th>
                <th className="text-center px-3 py-2 text-xs text-slate-500">Tipo</th>
                <th className="text-right px-3 py-2 text-xs text-slate-500">Monto</th>
              </tr></thead>
              <tbody>
                {data.movimientos?.map((m: any) => (
                  <tr key={m.id} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 text-xs">{formatDateTime(m.createdAt)}</td>
                    <td className="px-3 py-2 text-slate-700">{m.concepto}</td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={m.tipo === 'ingreso' ? 'success' : 'danger'}>{m.tipo}</Badge>
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.tipo === 'egreso' ? '−' : '+'}{formatCurrency(Number(m.monto))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function CajaPage() {
  const canOperate = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'cajero']));

  const [openModal, setOpenModal]   = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [movModal, setMovModal]     = useState(false);
  const [arqueoModal, setArqueoModal] = useState(false);

  const { data: session, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cash-active'],
    queryFn:  cashService.getActive,
    refetchInterval: 30_000,
  });

  const { data: sessions } = useQuery({
    queryKey: ['cash-sessions'],
    queryFn:  () => cashService.getSessions(),
  });

  const isOpen = session?.estado === 'abierta';

  return (
    <div className="space-y-5">
      {/* Estado actual */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sesión activa */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Landmark size={18} className="text-blue-600" />
              <CardTitle>Estado de Caja</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
              </button>
              {isOpen
                ? <Badge variant="success">Abierta</Badge>
                : <Badge variant="danger">Cerrada</Badge>}
            </div>
          </CardHeader>

          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : isOpen && session ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Apertura',    value: session.montoApertura, color: 'text-slate-700' },
                  { label: 'Saldo actual',value: session.saldoActual ?? 0, color: 'text-blue-700' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{formatCurrency(Number(value))}</p>
                  </div>
                ))}
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Abierta por</p>
                  <p className="text-sm font-semibold text-slate-800">{session.user.nombre} {session.user.apellido}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Desde</p>
                  <p className="text-sm font-semibold text-slate-800">{formatDateTime(session.fechaApertura)}</p>
                </div>
              </div>

              {canOperate && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" icon={<Plus size={14} />} onClick={() => setMovModal(true)}>
                    Movimiento
                  </Button>
                  <Button size="sm" variant="outline" icon={<Landmark size={14} />} onClick={() => setArqueoModal(true)}>
                    Ver Arqueo
                  </Button>
                  <Button size="sm" variant="danger" icon={<Lock size={14} />} onClick={() => setCloseModal(true)}>
                    Cerrar Caja
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                <Lock size={24} className="text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-slate-700 font-medium">No hay sesión activa</p>
                <p className="text-sm text-slate-400 mt-1">Abra la caja para comenzar a operar</p>
              </div>
              {canOperate && (
                <Button icon={<Unlock size={16} />} onClick={() => setOpenModal(true)}>
                  Abrir Caja
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* KPIs rápidos */}
        <div className="space-y-3">
          {isOpen && session && (
            <>
              <Card className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Ingresos sesión</p>
                  <p className="font-bold text-emerald-700">{formatCurrency(Number((session as any).totalIngresos ?? 0))}</p>
                </div>
              </Card>
              <Card className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <TrendingDown size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Egresos sesión</p>
                  <p className="font-bold text-red-600">{formatCurrency(Number((session as any).totalEgresos ?? 0))}</p>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Historial de sesiones */}
      <Card padding="none">
        <CardHeader className="px-5 py-4 border-b">
          <CardTitle>Historial de Sesiones</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b">
              {['Apertura', 'Cierre', 'Usuario', 'Monto Apertura', 'Saldo Sistema', 'Saldo Real', 'Diferencia', 'Estado'].map((h) => (
                <th key={h} className="text-xs font-semibold text-slate-500 px-4 py-3 text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sessions?.data?.map((s: any) => {
                const dif = Number(s.diferencia ?? 0);
                return (
                  <tr key={s.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 text-xs">{formatDateTime(s.fechaApertura)}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{s.fechaCierre ? formatDateTime(s.fechaCierre) : '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{s.user.nombre} {s.user.apellido}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(s.montoApertura))}</td>
                    <td className="px-4 py-3">{s.montoCierreSistema ? formatCurrency(Number(s.montoCierreSistema)) : '—'}</td>
                    <td className="px-4 py-3">{s.montoCierreReal ? formatCurrency(Number(s.montoCierreReal)) : '—'}</td>
                    <td className="px-4 py-3">
                      {s.diferencia != null ? (
                        <span className={dif === 0 ? 'text-emerald-600' : dif > 0 ? 'text-blue-600' : 'text-red-600'}>
                          {dif > 0 ? '+' : ''}{formatCurrency(dif)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.estado === 'abierta' ? 'success' : 'outline'}>{s.estado}</Badge>
                    </td>
                  </tr>
                );
              })}
              {!sessions?.data?.length && <tr><td colSpan={8} className="py-10 text-center text-slate-400">Sin sesiones registradas</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modales */}
      <OpenSessionModal open={openModal} onClose={() => setOpenModal(false)} />
      {isOpen && session && (
        <>
          <CloseSessionModal open={closeModal} onClose={() => setCloseModal(false)} sessionId={session.id} saldoSistema={Number(session.saldoActual ?? 0)} />
          <MovementModal open={movModal} onClose={() => setMovModal(false)} sessionId={session.id} />
          <ArqueoModal open={arqueoModal} onClose={() => setArqueoModal(false)} sessionId={session.id} />
        </>
      )}
    </div>
  );
}
