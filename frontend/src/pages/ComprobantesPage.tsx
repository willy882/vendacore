import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, ChevronLeft, ChevronRight,
  Plus, Eye, CheckCircle, AlertCircle, Clock, XCircle,
  Send, ExternalLink, Download,
} from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

const docService = {
  getStats:       () => api.get('/documents/stats').then((r) => r.data),
  getAll:         (params: any) => api.get('/documents', { params }).then((r) => r.data),
  getOne:         (id: string) => api.get(`/documents/${id}`).then((r) => r.data),
  createFromSale: (saleId: string, tipo: string) =>
    api.post('/documents/from-sale', { saleId, tipo }).then((r) => r.data),
  updateStatus:   (id: string, estado: string) =>
    api.patch(`/documents/${id}/status`, { estado }).then((r) => r.data),
  sendToSunat:    (id: string) =>
    api.post(`/documents/${id}/send-sunat`).then((r) => r.data),
};

const STATUS_MAP: Record<string, { label: string; variant: any; icon: React.ReactNode }> = {
  pendiente: { label: 'Pendiente', variant: 'warning', icon: <Clock size={12} /> },
  enviado:   { label: 'Enviado',   variant: 'info',    icon: <FileText size={12} /> },
  aceptado:  { label: 'Aceptado',  variant: 'success', icon: <CheckCircle size={12} /> },
  observado: { label: 'Observado', variant: 'warning', icon: <AlertCircle size={12} /> },
  rechazado: { label: 'Rechazado', variant: 'danger',  icon: <XCircle size={12} /> },
  anulado:   { label: 'Anulado',   variant: 'outline', icon: <XCircle size={12} /> },
};

// Puede enviarse si está pendiente, observado o rechazado
const canSend = (estado: string) => ['pendiente', 'observado', 'rechazado'].includes(estado);

// ── Modal generar comprobante ─────────────────────────────────────────────────

function GenerateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [saleId, setSaleId] = useState('');
  const [tipo, setTipo] = useState<'boleta' | 'factura'>('boleta');
  const [err, setErr] = useState('');

  const mut = useMutation({
    mutationFn: () => docService.createFromSale(saleId.trim(), tipo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['doc-stats'] });
      onClose();
    },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Error al generar comprobante'),
  });

  return (
    <Modal open onClose={onClose} title="Generar comprobante" size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={!saleId.trim()}>
            Generar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de comprobante</label>
          <div className="flex gap-2">
            {(['boleta', 'factura'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  tipo === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t === 'boleta' ? 'Boleta' : 'Factura'}
              </button>
            ))}
          </div>
        </div>
        <Input
          label="ID de venta"
          placeholder="Pega el ID de la venta (UUID)"
          value={saleId}
          onChange={(e) => setSaleId(e.target.value)}
        />
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</p>}
        <p className="text-xs text-slate-400">
          Puedes copiar el ID desde el Historial de Ventas haciendo clic en "Ver detalle".
        </p>
      </div>
    </Modal>
  );
}

// ── Modal detalle comprobante ─────────────────────────────────────────────────

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor']));
  const canSendDoc = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'cajero']));
  const [sendResult, setSendResult] = useState<any>(null);

  const { data: doc, isLoading } = useQuery({
    queryKey: ['document-detail', id],
    queryFn: () => docService.getOne(id),
  });

  const statusMut = useMutation({
    mutationFn: (estado: string) => docService.updateStatus(id, estado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document-detail', id] });
      qc.invalidateQueries({ queryKey: ['doc-stats'] });
    },
  });

  const sendMut = useMutation({
    mutationFn: () => docService.sendToSunat(id),
    onSuccess: (data) => {
      setSendResult(data);
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document-detail', id] });
      qc.invalidateQueries({ queryKey: ['doc-stats'] });
    },
    onError: (e: any) => {
      setSendResult({ error: e?.response?.data?.message ?? 'Error al enviar a SUNAT' });
    },
  });

  return (
    <Modal open onClose={onClose} title="Detalle del comprobante" size="md">
      {isLoading ? <Spinner className="mx-auto my-8" /> : !doc ? null : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4">
            <div><p className="text-xs text-slate-500">Número</p><p className="font-bold text-slate-800">{doc.numeroCompleto}</p></div>
            <div><p className="text-xs text-slate-500">Tipo</p><p className="font-medium capitalize">{doc.tipo}</p></div>
            <div><p className="text-xs text-slate-500">Fecha emisión</p><p className="font-medium">{formatDate(doc.fechaEmision)}</p></div>
            <div><p className="text-xs text-slate-500">Estado</p>
              <Badge variant={STATUS_MAP[doc.estado]?.variant ?? 'default'}>
                <span className="flex items-center gap-1">{STATUS_MAP[doc.estado]?.icon}{STATUS_MAP[doc.estado]?.label ?? doc.estado}</span>
              </Badge>
            </div>
            <div><p className="text-xs text-slate-500">Cliente</p><p className="font-medium">{doc.customer?.nombreCompleto ?? '—'}</p></div>
            <div><p className="text-xs text-slate-500">Doc. cliente</p><p className="font-medium">{doc.customer?.numeroDocumento ?? '—'}</p></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Subtotal</p>
              <p className="font-semibold text-slate-800">{formatCurrency(Number(doc.subtotal))}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">IGV</p>
              <p className="font-semibold text-slate-800">{formatCurrency(Number(doc.igv))}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 mb-1">Total</p>
              <p className="font-bold text-blue-700">{formatCurrency(Number(doc.total))}</p>
            </div>
          </div>

          {/* Respuesta SUNAT si ya fue enviado */}
          {(doc.respuestaSunat || doc.hashCpe || doc.pdfUrl) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-700">Respuesta SUNAT</p>
              {doc.respuestaSunat && <p className="text-xs text-emerald-700">{doc.respuestaSunat}</p>}
              {doc.hashCpe && <p className="text-xs text-slate-500 font-mono">Hash: {doc.hashCpe}</p>}
              <div className="flex flex-wrap gap-2 mt-1">
                {doc.pdfUrl && (
                  <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Download size={12} /> PDF
                  </a>
                )}
                {doc.xmlUrl && (
                  <a href={doc.xmlUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <ExternalLink size={12} /> XML
                  </a>
                )}
                {doc.cdrUrl && (
                  <a href={doc.cdrUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <ExternalLink size={12} /> CDR
                  </a>
                )}
              </div>
            </div>
          )}

          {doc.errorDescripcion && doc.estado !== 'aceptado' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Error SUNAT</p>
              <p className="text-xs text-red-600">{doc.errorDescripcion}</p>
            </div>
          )}

          {/* Resultado del envío en tiempo real */}
          {sendResult && !sendResult.error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-emerald-700">
                {sendResult.aceptado ? '✅ Aceptado por SUNAT' : '⚠️ Respuesta SUNAT'}
              </p>
              {sendResult.sunatDescription && (
                <p className="text-xs text-emerald-600 mt-1">{sendResult.sunatDescription}</p>
              )}
            </div>
          )}
          {sendResult?.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-red-600">{sendResult.error}</p>
            </div>
          )}

          {/* Botón enviar a SUNAT */}
          {canSendDoc && canSend(doc.estado) && (
            <div className="pt-1">
              <Button
                onClick={() => { setSendResult(null); sendMut.mutate(); }}
                loading={sendMut.isPending}
                icon={<Send size={15} />}
                className="w-full"
              >
                {sendMut.isPending ? 'Enviando a SUNAT...' : 'Enviar a SUNAT (Nubefact)'}
              </Button>
              <p className="text-xs text-slate-400 text-center mt-1">
                Se requiere token configurado en Configuración → SUNAT / OSE
              </p>
            </div>
          )}

          {canEdit && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Actualizar estado manualmente</p>
              <div className="flex flex-wrap gap-2">
                {['pendiente', 'enviado', 'aceptado', 'observado', 'rechazado', 'anulado'].map((s) => (
                  <button
                    key={s}
                    disabled={doc.estado === s || statusMut.isPending}
                    onClick={() => statusMut.mutate(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      doc.estado === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {STATUS_MAP[s]?.label ?? s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ComprobantesPage() {
  const canCreate = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'cajero']));
  const canSendDoc = useAuthStore((s) => s.hasRoles(['administrador', 'supervisor', 'cajero']));
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const [showGenerate, setShowGenerate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const qc = useQueryClient();
  const { data: stats } = useQuery({ queryKey: ['doc-stats'], queryFn: docService.getStats });
  const { data, isLoading } = useQuery({
    queryKey: ['documents', { tipo, estado, page }],
    queryFn: () => docService.getAll({ tipo: tipo || undefined, estado: estado || undefined, page, limit: 20 }),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => docService.sendToSunat(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['doc-stats'] });
    },
  });

  const docs = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Comprobantes Electrónicos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Boletas y facturas emitidas</p>
        </div>
        {canCreate && (
          <Button icon={<Plus size={16} />} onClick={() => setShowGenerate(true)}>
            Generar comprobante
          </Button>
        )}
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',                 value: stats.total,      color: 'text-slate-700' },
            { label: 'Pendientes',            value: stats.pendientes, color: 'text-amber-600' },
            { label: 'Aceptados',             value: stats.aceptados,  color: 'text-emerald-600' },
            { label: 'Observados/Rechazados', value: stats.observados, color: 'text-red-600' },
          ].map((k) => (
            <Card key={k.label} className="text-center py-4">
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-slate-500 mt-1">{k.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los tipos</option>
            <option value="boleta">Boleta</option>
            <option value="factura">Factura</option>
            <option value="nota_credito">Nota de Crédito</option>
            <option value="nota_debito">Nota de Débito</option>
          </select>
          <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </Card>

      {/* Tabla */}
      <Card padding="none">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <FileText size={16} className="text-slate-400" />
          <span className="text-sm text-slate-600"><strong>{data?.total ?? 0}</strong> comprobante(s)</span>
          {isLoading && <Spinner size="sm" className="ml-1 text-slate-400" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Número</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Tipo</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Cliente</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Fecha</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Total</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Estado</th>
                <th className="text-center text-xs font-semibold text-slate-500 px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Spinner className="mx-auto" /></td></tr>
              ) : docs.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm">No hay comprobantes</td></tr>
              ) : docs.map((doc: any) => {
                const st = STATUS_MAP[doc.estado] ?? { label: doc.estado, variant: 'default', icon: null };
                const isSending = sendMut.isPending && sendMut.variables === doc.id;
                return (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{doc.numeroCompleto}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{doc.tipo.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-slate-700">{doc.customer?.nombreCompleto ?? <span className="text-slate-400 italic">Sin cliente</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(doc.fechaEmision)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(doc.total))}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={st.variant}><span className="flex items-center gap-1">{st.icon}{st.label}</span></Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setDetailId(doc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={15} />
                        </button>
                        {canSendDoc && canSend(doc.estado) && (
                          <button
                            onClick={() => sendMut.mutate(doc.id)}
                            disabled={isSending}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                            title="Enviar a SUNAT"
                          >
                            {isSending ? <Spinner size="sm" /> : <Send size={15} />}
                          </button>
                        )}
                        {doc.pdfUrl && (
                          <a
                            href={doc.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Descargar PDF"
                          >
                            <Download size={15} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" icon={<ChevronLeft size={14} />} disabled={page === 1} onClick={() => setPage((p) => p - 1)} />
              <Button variant="outline" size="sm" icon={<ChevronRight size={14} />} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} />
            </div>
          </div>
        )}
      </Card>

      {showGenerate && <GenerateModal onClose={() => setShowGenerate(false)} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}