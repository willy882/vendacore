import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  Landmark, Lock, Unlock, SlidersHorizontal,
  Monitor, Pencil, Eye, RefreshCw, ArrowLeftRight,
  History, BarChart2, FileText, X, Printer,
} from 'lucide-react';
import { cashService } from '@/services/cash.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/auth.store';

// ── Helpers ───────────────────────────────────────────────────────────────────

const METHOD_KEYS: Record<string, string> = {
  efectivo: 'EFEC', yape: 'YAPE', plin: 'PLIN',
  tarjeta: 'TARJ', transferencia: 'TRAN',
  efec: 'EFEC', tarj: 'TARJ', tran: 'TRAN',
};

function normalizeMethod(key: string): string {
  return METHOD_KEYS[key.toLowerCase()] ?? key.toUpperCase().slice(0, 4);
}

const METHOD_ORDER = ['EFEC', 'YAPE', 'PLIN', 'TARJ', 'TRAN'];

const fmtS = (v: number) =>
  `S/.${Math.abs(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | Date) => {
  const dt = new Date(d);
  const day  = String(dt.getDate()).padStart(2, '0');
  const mon  = String(dt.getMonth() + 1).padStart(2, '0');
  const h    = dt.getHours();
  const m    = String(dt.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${day}/${mon} ${String(h12).padStart(2, '0')}:${m} ${ampm}`;
};

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
  const realVal   = parseFloat(watch('montoCierreReal') || '0') || 0;
  const diferencia = realVal - saldoSistema;
  const [resumen, setResumen] = useState<any>(null);

  const closeMut = useMutation({
    mutationFn: (d: CloseForm) => cashService.close(sessionId, parseFloat(d.montoCierreReal), d.observaciones),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cash-active'] });
      qc.invalidateQueries({ queryKey: ['cash-sessions'] });
      setResumen(data.resumen);
    },
  });

  const handleClose = () => { reset(); setResumen(null); onClose(); };

  if (resumen) {
    const dif = Number(resumen.diferencia ?? 0);
    return (
      <Modal open={open} onClose={handleClose} title="Resumen de Cierre" size="sm"
        footer={<Button onClick={handleClose}>Aceptar</Button>}
      >
        <div className="space-y-3 text-sm">
          {[
            { label: 'Apertura',       value: resumen.montoApertura,      color: 'text-slate-700' },
            { label: 'Total ingresos', value: resumen.totalIngresos,      color: 'text-emerald-600' },
            { label: 'Total egresos',  value: resumen.totalEgresos,       color: 'text-red-600' },
            { label: 'Saldo sistema',  value: resumen.montoCierreSistema, color: 'text-slate-800' },
            { label: 'Saldo real',     value: resumen.montoCierreReal,    color: 'text-slate-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between border-b pb-2">
              <span className="text-slate-500">{label}</span>
              <span className={`font-semibold ${color}`}>{fmtS(Number(value ?? 0))}</span>
            </div>
          ))}
          <div className={`flex justify-between rounded-lg px-3 py-2 font-bold ${dif === 0 ? 'bg-emerald-50 text-emerald-700' : dif > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
            <span>{dif === 0 ? 'Caja cuadrada' : dif > 0 ? 'Sobrante' : 'Faltante'}</span>
            <span>{dif === 0 ? '✓' : fmtS(Math.abs(dif))}</span>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Cerrar Sesión de Caja" size="sm"
      footer={<>
        <Button variant="outline" onClick={handleClose}>Cancelar</Button>
        <Button variant="danger" loading={closeMut.isPending} onClick={handleSubmit((d) => closeMut.mutate(d))} icon={<Lock size={15} />}>Cerrar Caja</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Saldo según sistema:</span><span className="font-bold">{fmtS(saldoSistema)}</span></div>
        </div>
        <Input label="Monto real en caja (S/) *" type="number" step="0.01" min="0" placeholder="0.00" {...register('montoCierreReal')} error={errors.montoCierreReal?.message} />
        {realVal > 0 && (
          <div className={`rounded-lg px-3 py-2 text-sm ${diferencia === 0 ? 'bg-emerald-50 text-emerald-700' : diferencia > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
            {diferencia === 0 ? 'Caja cuadrada ✓' : diferencia > 0 ? `Sobrante: ${fmtS(diferencia)}` : `Faltante: ${fmtS(Math.abs(diferencia))}`}
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-active'] });
      qc.invalidateQueries({ queryKey: ['arqueo', sessionId] });
      reset();
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Registrar Movimiento" size="sm"
      footer={<>
        <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
        <Button loading={movMut.isPending} onClick={handleSubmit((d) => movMut.mutate(d))}>Registrar</Button>
      </>}
    >
      <div className="space-y-4">
        <Select options={[{ value: 'ingreso', label: '↑ Ingreso' }, { value: 'egreso', label: '↓ Egreso' }]}
          label="Tipo" {...register('tipo')} />
        <Input label="Monto (S/) *" type="number" step="0.01" min="0.01" {...register('monto')} error={errors.monto?.message} />
        <Input label="Concepto *" placeholder="Ej: Pago arriendo, Préstamo..." {...register('concepto')} error={errors.concepto?.message} />
        <Input label="Referencia" placeholder="N° documento, etc." {...register('referencia')} />
      </div>
    </Modal>
  );
}

// ── Modal historial de sesiones ───────────────────────────────────────────────

function HistorialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cash-sessions'],
    queryFn:  () => cashService.getSessions(1, 30),
    enabled:  open,
    staleTime: 30_000,
  });

  if (!open) return null;

  const sessions: any[] = data?.data ?? (Array.isArray(data) ? data : []);
  const total: number   = data?.total ?? sessions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <History size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Historial de Caja</h2>
              <p className="text-xs text-slate-400">{total} sesiones registradas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
              <tr>
                {['Apertura', 'Cierre', 'Monto inicial', 'Ingresos', 'Diferencia', 'Estado'].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-5 py-3"><div className="h-3 bg-slate-100 rounded animate-pulse" /></td></tr>
                  ))
                : sessions.length === 0
                  ? <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-sm">Sin sesiones registradas</td></tr>
                  : sessions.map((s: any) => {
                      const dif = s.estado !== 'abierta'
                        ? Number(s.montoCierreReal ?? 0) - Number(s.montoCierreSistema ?? s.saldoActual ?? 0)
                        : null;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDate(s.fechaApertura)}</td>
                          <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                            {s.fechaCierre ? fmtDate(s.fechaCierre) : <span className="text-emerald-500 font-semibold text-xs">Activa</span>}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-700 tabular-nums">{fmtS(Number(s.montoApertura ?? 0))}</td>
                          <td className="px-5 py-3 font-semibold text-emerald-600 tabular-nums">{fmtS(Number(s.totalIngresos ?? 0))}</td>
                          <td className="px-5 py-3 font-bold tabular-nums" style={{
                            color: dif === null ? '#94a3b8' : dif === 0 ? '#16a34a' : dif > 0 ? '#2563eb' : '#dc2626',
                          }}>
                            {dif === null ? '—' : dif === 0 ? 'Cuadrada' : fmtS(Math.abs(dif))}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white ${s.estado === 'abierta' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                              {s.estado}
                            </span>
                          </td>
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </div>

        <div className="flex justify-end px-6 py-3 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-700 tracking-widest transition-colors cursor-pointer">
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal reporte general imprimible ─────────────────────────────────────────

function ReporteGeneralModal({ open, onClose, session, arqueo, methodCards }: {
  open:        boolean;
  onClose:     () => void;
  session:     any;
  arqueo:      any;
  methodCards: { label: string; ingreso: number; egreso: number; saldo: number }[];
}) {
  if (!open || !session) return null;

  const apertura    = Number(session.montoApertura  ?? 0);
  const totalIngres = Number(arqueo?.totalIngresos  ?? 0);
  const totalEgres  = Number(arqueo?.totalEgresos   ?? 0);
  const saldo       = Number(session.saldoActual    ?? 0);
  const fechaStr    = session.fechaApertura
    ? new Date(session.fechaApertura).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
    : '—';
  const activeMethods = methodCards.filter(m => m.ingreso > 0 || m.egreso > 0);

  const handlePrint = () => {
    const rows = activeMethods.map(m =>
      `<tr><td>${m.label}</td><td class="r">${fmtS(m.ingreso)}</td><td class="r">${fmtS(m.egreso)}</td><td class="r">${fmtS(m.saldo)}</td></tr>`
    ).join('');
    const win = window.open('', '_blank', 'width=520,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Reporte Caja</title>
      <style>
        body{font-family:sans-serif;padding:24px;font-size:13px;color:#1e293b}
        h2{font-size:15px;font-weight:bold;margin:0 0 2px}
        p{margin:2px 0;color:#64748b;font-size:11px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #e2e8f0;padding:6px 10px;font-size:12px}
        th{background:#f8fafc;font-weight:bold;color:#475569;text-align:left}
        .r{text-align:right}
        .total{font-weight:bold;background:#f1f5f9}
        hr{border:none;border-top:1px solid #e2e8f0;margin:14px 0}
        @media print{body{margin:0}}
      </style></head><body>
      <h2>Reporte General de Caja</h2>
      <p>Apertura: ${fechaStr} &nbsp;|&nbsp; Estado: ${session.estado}</p>
      <hr/>
      <table>
        <tr><th>Concepto</th><th class="r">Monto</th></tr>
        <tr><td>Monto apertura</td><td class="r">${fmtS(apertura)}</td></tr>
        <tr><td>Total ingresos</td><td class="r">${fmtS(totalIngres)}</td></tr>
        <tr><td>Total egresos</td><td class="r">${fmtS(totalEgres)}</td></tr>
        <tr class="total"><td>Saldo en caja</td><td class="r">${fmtS(saldo)}</td></tr>
      </table>
      ${activeMethods.length > 0 ? `
        <hr/>
        <table>
          <tr><th>Método</th><th class="r">Ingreso</th><th class="r">Egreso</th><th class="r">Saldo</th></tr>
          ${rows}
        </table>` : ''}
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileText size={16} className="text-slate-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Reporte General de Caja</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="text-xs text-slate-500">Apertura: <span className="font-semibold text-slate-700">{fechaStr}</span></div>

          <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-bold text-slate-500 px-4 py-2.5">Concepto</th>
                <th className="text-right text-xs font-bold text-slate-500 px-4 py-2.5">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="px-4 py-2.5 text-slate-600">Monto apertura</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtS(apertura)}</td></tr>
              <tr><td className="px-4 py-2.5 text-emerald-600 font-medium">Total ingresos</td><td className="px-4 py-2.5 text-right font-bold text-emerald-600 tabular-nums">{fmtS(totalIngres)}</td></tr>
              <tr><td className="px-4 py-2.5 text-red-600 font-medium">Total egresos</td><td className="px-4 py-2.5 text-right font-bold text-red-600 tabular-nums">{fmtS(totalEgres)}</td></tr>
              <tr className="bg-slate-50">
                <td className="px-4 py-2.5 font-bold text-slate-800">Saldo en caja</td>
                <td className="px-4 py-2.5 text-right font-bold text-blue-600 tabular-nums">{fmtS(saldo)}</td>
              </tr>
            </tbody>
          </table>

          {activeMethods.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Por método de pago</p>
              <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left text-xs font-bold text-slate-500 px-4 py-2.5">Método</th>
                    <th className="text-right text-xs font-bold text-slate-500 px-4 py-2.5">Ingreso</th>
                    <th className="text-right text-xs font-bold text-slate-500 px-4 py-2.5">Egreso</th>
                    <th className="text-right text-xs font-bold text-slate-500 px-4 py-2.5">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeMethods.map(mc => (
                    <tr key={mc.label}>
                      <td className="px-4 py-2.5 font-bold text-slate-700">{mc.label}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold tabular-nums">{fmtS(mc.ingreso)}</td>
                      <td className="px-4 py-2.5 text-right text-red-500 font-semibold tabular-nums">{fmtS(mc.egreso)}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmtS(mc.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-700 tracking-widest transition-colors cursor-pointer">
            CERRAR
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.97] text-white text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            <Printer size={14} /> IMPRIMIR
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function CajaPage() {
  const navigate   = useNavigate();
  const canOperate = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'cajero']));

  const [openModal,      setOpenModal]      = useState(false);
  const [closeModal,     setCloseModal]     = useState(false);
  const [movModal,       setMovModal]       = useState(false);
  const [opcionesOpen,   setOpcionesOpen]   = useState(false);
  const [filterMov,      setFilterMov]      = useState<'todos' | 'ingresos' | 'egresos' | 'venta'>('todos');
  const [historialModal, setHistorialModal] = useState(false);
  const [reporteModal,   setReporteModal]   = useState(false);

  const { data: session, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cash-active'],
    queryFn:  cashService.getActive,
    refetchInterval: 30_000,
  });

  const isOpen = session?.estado === 'abierta';

  const { data: arqueo, isLoading: arqueoLoading } = useQuery({
    queryKey: ['arqueo', session?.id],
    queryFn:  () => cashService.getArqueo(session!.id),
    enabled:  isOpen && !!session?.id,
    refetchInterval: 30_000,
  });

  // ── Totales por método (solo desde movimientos para evitar doble conteo) ────
  const byMethod: Record<string, { ingreso: number; egreso: number }> = {};

  if (arqueo?.movimientos) {
    (arqueo.movimientos as any[]).forEach((m) => {
      const nombre = m.paymentMethod?.nombre ?? m.concepto ?? 'efectivo';
      const label  = normalizeMethod(nombre);
      if (!byMethod[label]) byMethod[label] = { ingreso: 0, egreso: 0 };
      if (m.tipo === 'ingreso') byMethod[label].ingreso += Number(m.monto);
      else                      byMethod[label].egreso  += Number(m.monto);
    });
  }

  const methodCards = METHOD_ORDER.map((m) => ({
    label:   m,
    ingreso: byMethod[m]?.ingreso ?? 0,
    egreso:  byMethod[m]?.egreso  ?? 0,
    saldo:   (byMethod[m]?.ingreso ?? 0) - (byMethod[m]?.egreso ?? 0),
  }));

  const totalCaja   = Number(session?.saldoActual ?? arqueo?.saldoSistema ?? 0);
  const totalIngres = Number((session as any)?.totalIngresos ?? arqueo?.totalIngresos ?? 0);
  const apertura    = session?.fechaApertura
    ? new Date(session.fechaApertura).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
    : '--';

  const allMovimientos: any[] = arqueo?.movimientos ?? [];
  const movimientos = allMovimientos.filter((m) => {
    if (filterMov === 'todos')    return true;
    if (filterMov === 'ingresos') return m.tipo === 'ingreso';
    if (filterMov === 'egresos')  return m.tipo === 'egreso';
    if (filterMov === 'venta')    return (m.concepto ?? '').toLowerCase().includes('venta');
    return true;
  });

  return (
    <div className="min-h-full bg-gray-100 p-4 space-y-3">

      {/* ── Banner principal ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">

          {/* Ícono + totales */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Landmark size={24} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-blue-600 leading-tight">
                TOTAL CAJA: {fmtS(totalCaja)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                VENTA (Ingresos): {fmtS(totalIngres)}&nbsp;&nbsp;|&nbsp;&nbsp;Apertura: {apertura}
              </p>
            </div>
            <button onClick={() => refetch()} className="ml-1 text-slate-400 hover:text-slate-600 flex-shrink-0">
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Botones */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/punto-venta')}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-all">
              <Monitor size={15} /> PUNTO VENTA
            </button>
            <div className="relative">
              <button
                onClick={() => setOpcionesOpen((v) => !v)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-all">
                <SlidersHorizontal size={15} /> OPCIONES DE FLUJO
              </button>

              {opcionesOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setOpcionesOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-xl border border-slate-200 shadow-2xl w-72 overflow-hidden">

                    {/* Filtrar movimientos */}
                    <div className="px-4 pt-3 pb-2 border-b border-slate-100">
                      <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">
                        Filtrar movimientos
                      </label>
                      <select
                        value={filterMov}
                        onChange={(e) => setFilterMov(e.target.value as any)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      >
                        <option value="todos">Todos</option>
                        <option value="ingresos">Ingresos</option>
                        <option value="egresos">Egresos</option>
                        <option value="venta">Venta</option>
                      </select>
                    </div>

                    {/* Opciones de acción */}
                    {[
                      {
                        icon: <Unlock size={17} className="text-blue-500" />,
                        label: 'Inicio / Apertura Caja',
                        show: !isOpen && canOperate,
                        action: () => { setOpenModal(true); setOpcionesOpen(false); },
                      },
                      {
                        icon: <ArrowLeftRight size={17} className="text-blue-500" />,
                        label: 'Nuevo Ingreso / Egreso',
                        show: isOpen && canOperate,
                        action: () => { setMovModal(true); setOpcionesOpen(false); },
                      },
                      {
                        icon: <Lock size={17} className="text-blue-500" />,
                        label: 'Cerrar Caja (Reporte)',
                        show: isOpen && canOperate,
                        action: () => { setCloseModal(true); setOpcionesOpen(false); },
                      },
                      {
                        icon: <History size={17} className="text-blue-500" />,
                        label: 'Ver Historial',
                        show: true,
                        action: () => { setHistorialModal(true); setOpcionesOpen(false); },
                      },
                      {
                        icon: <BarChart2 size={17} className="text-blue-500" />,
                        label: 'Productos Vendidos',
                        show: true,
                        action: () => { navigate('/reportes/productos'); setOpcionesOpen(false); },
                      },
                      {
                        icon: <FileText size={17} className="text-blue-500" />,
                        label: 'Reporte General',
                        show: isOpen,
                        action: () => { setReporteModal(true); setOpcionesOpen(false); },
                      },
                    ].filter((o) => o.show).map(({ icon, label, action }) => (
                      <button
                        key={label}
                        onClick={action}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 transition-colors text-left"
                      >
                        <span className="flex-shrink-0 w-6 flex justify-center">{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sin sesión activa ── */}
      {isLoading && (
        <div className="flex justify-center py-20"><Spinner /></div>
      )}

      {!isLoading && !isOpen && (
        <div className="flex flex-col items-center gap-4 py-20 bg-white rounded-xl border border-slate-200">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
            <Lock size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">No hay sesión de caja activa</p>
          {canOperate && (
            <button onClick={() => setOpenModal(true)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-lg transition-colors">
              <Unlock size={16} /> Abrir Caja
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <>
          {/* ── Tarjetas por método de pago ── */}
          {arqueoLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {METHOD_ORDER.map((m) => (
                <div key={m} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-12 mb-4" />
                  <div className="grid grid-cols-3 gap-2">
                    {[0,1,2].map(i => <div key={i} className="h-4 bg-slate-100 rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {methodCards.map((mc) => (
                <div key={mc.label} className="rounded-xl border border-slate-200 bg-slate-50 shadow-sm p-4">
                  <p className="text-sm font-black text-slate-800 mb-3">{mc.label}</p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <span className="text-[10px] text-slate-500">Ingreso</span>
                    <span className="text-[10px] text-slate-500">Egreso</span>
                    <span className="text-[10px] text-slate-500">Saldo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center mt-1">
                    <span className="text-xs font-bold text-emerald-600 break-all">{fmtS(mc.ingreso)}</span>
                    <span className="text-xs font-bold text-red-500 break-all">{fmtS(mc.egreso)}</span>
                    <span className="text-xs font-bold text-emerald-600 break-all">{fmtS(mc.saldo)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tabla de movimientos ── */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Mov.', 'Modo', 'Fecha', 'Total', 'Observación', 'Estado', 'Responsable', 'Accion'].map((h) => (
                      <th key={h} className="text-xs font-bold text-slate-500 px-4 py-3 text-left whitespace-nowrap uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                        Sin movimientos en esta sesión
                      </td>
                    </tr>
                  )}
                  {movimientos.map((m: any, idx: number) => {
                    const esIngreso = m.tipo === 'ingreso';
                    const nombre    = m.paymentMethod?.nombre ?? m.concepto ?? 'efectivo';
                    const modo      = normalizeMethod(nombre);
                    return (
                      <tr key={m.id ?? idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        {/* Mov badge */}
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white
                            ${esIngreso ? 'bg-emerald-500' : 'bg-red-500'}`}>
                            {esIngreso ? 'ingr' : 'egr'}
                          </span>
                        </td>
                        {/* Modo */}
                        <td className="px-4 py-2.5 font-semibold text-slate-700">{modo}</td>
                        {/* Fecha */}
                        <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                          {fmtDate(m.fecha)}
                        </td>
                        {/* Total */}
                        <td className="px-4 py-2.5 font-bold whitespace-nowrap"
                          style={{ color: esIngreso ? '#16a34a' : '#dc2626' }}>
                          {fmtS(Number(m.monto))}
                        </td>
                        {/* Observación */}
                        <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate">
                          {m.concepto ?? m.observacion ?? '—'}
                        </td>
                        {/* Estado */}
                        <td className="px-4 py-2.5">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white bg-emerald-500">
                            activo
                          </span>
                        </td>
                        {/* Responsable */}
                        <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                          {m.user?.nombre ? `${m.user.nombre} ${m.user.apellido ?? ''}`.trim() : '—'}
                        </td>
                        {/* Accion */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <button className="text-red-400 hover:text-red-600 transition-colors p-1">
                              <Pencil size={13} />
                            </button>
                            <button className="text-emerald-500 hover:text-emerald-700 transition-colors p-1">
                              <Eye size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Modales ── */}
      <OpenSessionModal open={openModal} onClose={() => setOpenModal(false)} />
      {isOpen && session && (
        <>
          <CloseSessionModal
            open={closeModal}
            onClose={() => setCloseModal(false)}
            sessionId={session.id}
            saldoSistema={Number(session.saldoActual ?? 0)}
          />
          <MovementModal open={movModal} onClose={() => setMovModal(false)} sessionId={session.id} />
          <ReporteGeneralModal
            open={reporteModal}
            onClose={() => setReporteModal(false)}
            session={session}
            arqueo={arqueo}
            methodCards={methodCards}
          />
        </>
      )}
      <HistorialModal open={historialModal} onClose={() => setHistorialModal(false)} />
    </div>
  );
}
