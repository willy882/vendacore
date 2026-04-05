import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Eye, ScrollText } from 'lucide-react';
import { auditService } from '@/services/audit.service';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatDateTime, currentMonthRange } from '@/lib/utils';
import type { AuditLog } from '@/types';

// ── Colores por acción ────────────────────────────────────────────────────────

const actionVariant = (accion: string): 'success' | 'danger' | 'warning' | 'info' | 'default' => {
  if (accion.includes('CREATE') || accion.includes('LOGIN')) return 'success';
  if (accion.includes('DELETE') || accion.includes('CANCEL') || accion.includes('LOGOUT')) return 'danger';
  if (accion.includes('UPDATE') || accion.includes('PATCH')) return 'warning';
  if (accion.includes('READ') || accion.includes('GET')) return 'info';
  return 'default';
};

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailModal({ open, onClose, log }: { open: boolean; onClose: () => void; log: AuditLog | null }) {
  if (!log) return null;

  const JsonBlock = ({ data }: { data?: Record<string, unknown> | null }) => {
    if (!data) return <p className="text-slate-400 text-sm italic">Sin datos</p>;
    return (
      <pre className="text-xs bg-slate-50 rounded-lg p-3 overflow-x-auto text-slate-700 border border-slate-200">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Detalle del Registro" size="lg">
      <div className="space-y-4">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Módulo',   value: log.modulo },
            { label: 'Acción',   value: <Badge variant={actionVariant(log.accion)}>{log.accion}</Badge> },
            { label: 'Entidad',  value: log.entidad },
            { label: 'ID Entidad', value: <span className="font-mono text-xs">{log.entidadId ?? '—'}</span> },
            { label: 'Usuario',  value: log.user ? `${log.user.nombre} ${log.user.apellido}` : '—' },
            { label: 'Email',    value: log.user?.email ?? '—' },
            { label: 'IP',       value: log.ipAddress ?? '—' },
            { label: 'Fecha',    value: formatDateTime(log.createdAt) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-0.5">{label}</p>
              <div className="font-medium text-slate-800">{value}</div>
            </div>
          ))}
        </div>

        {/* Diffs */}
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">Datos Anteriores</p>
          <JsonBlock data={log.datosAnteriores} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">Datos Nuevos</p>
          <JsonBlock data={log.datosNuevos} />
        </div>
      </div>
    </Modal>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

const LIMIT = 30;

export default function AuditoriaPage() {
  const range = currentMonthRange();
  const [from, setFrom]     = useState(range.from);
  const [to, setTo]         = useState(range.to);
  const [search, setSearch] = useState('');
  const [modulo, setModulo] = useState('');
  const [accion, setAccion] = useState('');
  const [page, setPage]     = useState(1);
  const [detail, setDetail] = useState<AuditLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', { from, to, search, modulo, accion, page }],
    queryFn:  () => auditService.getAll({
      from, to,
      search:  search  || undefined,
      modulo:  modulo  || undefined,
      accion:  accion  || undefined,
      page,
      limit: LIMIT,
    }),
    placeholderData: (p) => p,
  });

  const { data: filters } = useQuery({
    queryKey: ['audit-filters'],
    queryFn:  auditService.getFilters,
    staleTime: 5 * 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn:  () => auditService.getStats(30),
  });

  const logs       = data?.data ?? [];
  const total      = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const moduloOptions = [{ value: '', label: 'Todos los módulos' }, ...(filters?.modulos ?? []).map((m) => ({ value: m, label: m }))];
  const accionOptions = [{ value: '', label: 'Todas las acciones' }, ...(filters?.acciones ?? []).map((a) => ({ value: a, label: a }))];

  return (
    <div className="space-y-5">
      {/* Estadísticas rápidas */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center py-4">
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            <p className="text-xs text-slate-500 mt-1">Eventos (30 días)</p>
          </Card>
          {stats.porModulo?.slice(0, 3).map((m: { modulo: string; cantidad: number }) => (
            <Card key={m.modulo} className="text-center py-4">
              <p className="text-2xl font-bold text-slate-800">{m.cantidad}</p>
              <p className="text-xs text-slate-500 mt-1">{m.modulo}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <Input label="Desde" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-36" />
        <Input label="Hasta" type="date" value={to}   onChange={(e) => { setTo(e.target.value);   setPage(1); }} className="w-36" />
        <Select label="Módulo" options={moduloOptions} value={modulo}
          onChange={(e) => { setModulo(e.target.value); setPage(1); }} className="w-44" />
        <Select label="Acción" options={accionOptions} value={accion}
          onChange={(e) => { setAccion(e.target.value); setPage(1); }} className="w-44" />
        <div className="flex-1 min-w-[200px]">
          <Input label="Buscar" placeholder="Usuario, IP, entidad..." icon={<Search size={14} />}
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {/* Tabla */}
      <Card padding="none">
        <CardHeader className="px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <ScrollText size={15} className="text-slate-400" />
            <CardTitle>{total} registros encontrados</CardTitle>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                {['Fecha/Hora', 'Usuario', 'Módulo', 'Acción', 'Entidad', 'ID Entidad', 'IP', 'Ver'].map((h) => (
                  <th key={h} className="text-xs font-semibold text-slate-500 px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-400">Sin registros en el período</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    {log.user ? (
                      <div>
                        <p className="text-sm text-slate-800 font-medium">{log.user.nombre} {log.user.apellido}</p>
                        <p className="text-xs text-slate-400">{log.user.email}</p>
                      </div>
                    ) : <span className="text-slate-400">Sistema</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{log.modulo}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={actionVariant(log.accion)}>{log.accion}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{log.entidad}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-slate-400">{log.entidadId ? log.entidadId.slice(0, 8) + '…' : '—'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{log.ipAddress ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => setDetail(log)} className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center px-5 py-3 border-t">
            <p className="text-xs text-slate-500">Página {page} de {totalPages} · {total} registros</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" icon={<ChevronLeft size={14} />} disabled={page === 1} onClick={() => setPage((p) => p - 1)} />
              <Button variant="outline" size="sm" icon={<ChevronRight size={14} />} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} />
            </div>
          </div>
        )}
      </Card>

      <DetailModal open={!!detail} onClose={() => setDetail(null)} log={detail} />
    </div>
  );
}
