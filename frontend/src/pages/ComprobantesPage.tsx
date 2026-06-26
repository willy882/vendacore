import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, ChevronLeft, ChevronRight,
  Eye, CheckCircle, AlertCircle, Clock, XCircle,
  Send, ExternalLink, Download, Search, MessageCircle, X,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
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

const canSend = (estado: string) => ['pendiente', 'observado', 'rechazado'].includes(estado);

// ── Modal WhatsApp ────────────────────────────────────────────────────────────

function WhatsAppModal({ doc, onClose }: { doc: any; onClose: () => void }) {
  const [phone, setPhone] = useState(doc.customer?.telefono ?? '');

  const pdfUrl = doc.estado === 'aceptado'
    ? `https://vendacore-backend.fly.dev/api/v1/documents/${doc.id}/pdf`
    : null;

  const mensaje = encodeURIComponent(
    `Hola${doc.customer?.nombreCompleto ? ` ${doc.customer.nombreCompleto}` : ''}! 👋\n\n` +
    `Le compartimos su comprobante:\n\n` +
    `📄 *${doc.tipo === 'boleta' ? 'Boleta' : doc.tipo === 'factura' ? 'Factura' : doc.tipo.replace('_', ' ')}* ${doc.numeroCompleto}\n` +
    `💰 Total: *S/ ${Number(doc.total).toFixed(2)}*\n` +
    `📅 Fecha: ${new Date(doc.fechaEmision).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}\n` +
    (pdfUrl ? `\n📎 Descargue su comprobante aquí:\n${pdfUrl}` : '') +
    `\n\nGracias por su preferencia 🙏`
  );

  const cleanPhone = phone.replace(/\D/g, '');
  const waLink = `https://wa.me/${cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`}?text=${mensaje}`;

  return (
    <Modal open onClose={onClose} title="Enviar por WhatsApp" size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={cleanPhone.length < 9}
            onClick={() => { window.open(waLink, '_blank'); onClose(); }}
            className="bg-[#25D366] hover:bg-[#1da851] border-[#25D366]"
            icon={<MessageCircle size={15} />}
          >
            Abrir WhatsApp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
          <p className="text-slate-500 text-xs font-medium">Comprobante</p>
          <p className="font-bold text-slate-800">{doc.numeroCompleto}</p>
          <p className="text-slate-600">{doc.customer?.nombreCompleto ?? 'Sin cliente'} · S/ {Number(doc.total).toFixed(2)}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Número de celular del cliente
          </label>
          <div className="flex items-center gap-2">
            <span className="px-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg text-slate-600 font-medium">+51</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="987 654 321"
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              maxLength={12}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Se abrirá WhatsApp Web con el mensaje pre-escrito</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 space-y-1">
          <p className="font-semibold text-green-700">Mensaje de vista previa:</p>
          <p className="whitespace-pre-line leading-relaxed">
            {`Hola${doc.customer?.nombreCompleto ? ` ${doc.customer.nombreCompleto}` : ''}! 👋\n\nLe compartimos su comprobante:\n\n📄 ${doc.numeroCompleto}\n💰 Total: S/ ${Number(doc.total).toFixed(2)}${doc.pdfUrl ? '\n📎 PDF adjunto' : ''}\n\nGracias por su preferencia 🙏`}
          </p>
        </div>
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
  const [showWA, setShowWA] = useState(false);
  const [confirmAnular, setConfirmAnular] = useState(false);

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
      setConfirmAnular(false);
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
    <>
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

            {/* Items del pedido */}
            {doc.sale?.items?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Productos</p>
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800 text-white">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold">Descripción</th>
                        <th className="text-center px-2 py-2 font-semibold w-12">Cant.</th>
                        <th className="text-right px-3 py-2 font-semibold w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.sale.items.map((item: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 text-slate-700">{item.product?.nombre ?? item.descripcion ?? '—'}</td>
                          <td className="px-2 py-2 text-center text-slate-600">{item.cantidad}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">
                            {formatCurrency(Number(item.precioUnitario) * Number(item.cantidad))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Métodos de pago */}
            {doc.sale?.payments?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pagos</p>
                <div className="flex flex-wrap gap-2">
                  {doc.sale.payments.filter((p: any) => Number(p.monto) > 0).map((p: any, i: number) => (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700">
                      {p.paymentMethod?.nombre ?? 'Pago'}
                      <span className="font-bold text-slate-900">{formatCurrency(Number(p.monto))}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Botón WhatsApp */}
            <button
              onClick={() => setShowWA(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
              style={{ background: '#25D366' }}
            >
              <MessageCircle size={16} />
              Enviar comprobante por WhatsApp
            </button>

            {/* Respuesta SUNAT */}
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

            {/* Enviar a SUNAT */}
            {canSendDoc && canSend(doc.estado) && (
              <div className="pt-1">
                <Button
                  onClick={() => { setSendResult(null); sendMut.mutate(); }}
                  loading={sendMut.isPending}
                  icon={<Send size={15} />}
                  className="w-full"
                >
                  {sendMut.isPending ? 'Enviando a SUNAT...' : 'Enviar a SUNAT (APIs Peru)'}
                </Button>
                <p className="text-xs text-slate-400 text-center mt-1">
                  Se requiere token configurado en Configuración → SUNAT / OSE
                </p>
              </div>
            )}

            {/* Cambiar estado + Anular */}
            {canEdit && doc.estado !== 'anulado' && (
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">Actualizar estado</p>
                <div className="flex flex-wrap gap-2">
                  {['pendiente', 'enviado', 'aceptado', 'observado', 'rechazado'].map((s) => (
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

                {/* Anular separado con confirmación */}
                {!confirmAnular ? (
                  <button
                    onClick={() => setConfirmAnular(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    <X size={13} /> Anular comprobante
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-red-700 font-medium">¿Confirmar anulación?</p>
                    <p className="text-xs text-red-600">Esta acción no se puede revertir.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmAnular(false)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => statusMut.mutate('anulado')}
                        disabled={statusMut.isPending}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {statusMut.isPending ? 'Anulando...' : 'Sí, anular'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {doc.estado === 'anulado' && (
              <div className="bg-slate-100 rounded-xl p-3 text-center text-xs text-slate-500">
                Este comprobante está anulado
              </div>
            )}
          </div>
        )}
      </Modal>

      {showWA && doc && <WhatsAppModal doc={doc} onClose={() => setShowWA(false)} />}
    </>
  );
}

// ── Modal imprimir / compartir ────────────────────────────────────────────────

type PaperSize = 'A4' | 'A5' | '80mm' | '58mm';
type ShareStep = 'main' | 'whatsapp' | 'correo' | 'print';

function PrintShareModal({ doc, onClose }: { doc: any; onClose: () => void }) {
  const [step, setStep]   = useState<ShareStep>('main');
  const [size, setSize]   = useState<PaperSize>('80mm');
  const [phone, setPhone] = useState(doc.customer?.telefono?.replace(/\D/g, '') ?? '');
  const [email, setEmail] = useState(doc.customer?.email ?? '');

  const clienteLabel = doc.customer
    ? `${doc.customer.numeroDocumento} - ${doc.customer.nombreCompleto}`
    : '00000000 - CLIENTES VARIOS';

  const fechaStr = doc.fechaEmision
    ? new Date(doc.fechaEmision).toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

  const shareUrl = doc.estado === 'aceptado'
    ? `https://vendacore-backend.fly.dev/api/v1/documents/${doc.id}/pdf`
    : (doc.pdfUrl ?? '');

  // ── Imprimir ──────────────────────────────────────────────────────────────
  const execPrint = (sz: PaperSize) => {
    const dims: Record<PaperSize, { w: string; h: string }> = {
      '80mm': { w: '80mm',  h: 'auto' },
      '58mm': { w: '58mm',  h: 'auto' },
      'A5':   { w: '148mm', h: '210mm' },
      'A4':   { w: '210mm', h: '297mm' },
    };
    const { w, h } = dims[sz];
    const fz = sz === '58mm' ? '9px' : sz === '80mm' ? '10px' : '11px';
    const items = (doc.items ?? [])
      .map((it: any) =>
        `<tr>
          <td style="text-align:center">${it.cantidad ?? ''}</td>
          <td>${it.descripcion ?? it.producto?.nombre ?? ''}</td>
          <td style="text-align:right">${Number(it.precioUnitario ?? 0).toFixed(2)}</td>
          <td style="text-align:right">${Number(it.total ?? 0).toFixed(2)}</td>
        </tr>`
      ).join('');
    const win = window.open('', '_blank', 'width=700,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${doc.numeroCompleto}</title>
      <style>
        @page { size: ${w}${h !== 'auto' ? ' ' + h : ''}; margin: 6mm; }
        body { font-family: 'Courier New', monospace; font-size: ${fz}; margin: 0; color:#000; }
        .c  { text-align:center; }
        .b  { font-weight:bold; }
        .hr { border:none; border-top:1px dashed #000; margin:4px 0; }
        table { width:100%; border-collapse:collapse; }
        th    { border-bottom:1px solid #000; padding:2px 0; font-size:.95em; }
        td    { padding:2px 0; vertical-align:top; }
        .tot  { border-top:1px solid #000; font-weight:bold; }
      </style></head><body>
      <p class="c b" style="font-size:1.15em">${(doc.empresa?.razonSocial ?? '').toUpperCase()}</p>
      <p class="c">Ruc: ${doc.empresa?.ruc ?? ''}</p>
      <p class="c" style="font-size:.85em">${doc.empresa?.direccion ?? ''}</p>
      <hr class="hr"/>
      <p class="c b">${(doc.tipo ?? 'COMPROBANTE').toUpperCase()}</p>
      <p class="c">${doc.numeroCompleto}</p>
      <p class="c">EMISION: ${fechaStr}</p>
      <hr class="hr"/>
      <p>Nombre  : ${doc.customer?.nombreCompleto ?? 'CLIENTES VARIOS'}</p>
      <p>Documento: ${doc.customer?.numeroDocumento ?? '00000000'}</p>
      ${doc.customer?.direccion ? `<p>Direccion: ${doc.customer.direccion}</p>` : ''}
      ${doc.customer?.telefono  ? `<p>Telf: ${doc.customer.telefono}</p>` : ''}
      <hr class="hr"/>
      <table>
        <thead><tr>
          <th style="text-align:center;width:12%">Cant</th>
          <th style="text-align:left">Descripcion</th>
          <th style="text-align:right;width:14%">P.U</th>
          <th style="text-align:right;width:16%">P.T</th>
        </tr></thead>
        <tbody>${items}</tbody>
      </table>
      <hr class="hr"/>
      <table>
        <tr><td>OP. GRAVADA</td><td style="text-align:right">S/${Number(doc.gravada ?? 0).toFixed(2)}</td></tr>
        <tr><td>OP. EXONERADA</td><td style="text-align:right">S/${Number(doc.exonerada ?? doc.total ?? 0).toFixed(2)}</td></tr>
        <tr><td>IGV 18%</td><td style="text-align:right">S/${Number(doc.igv ?? 0).toFixed(2)}</td></tr>
        <tr class="tot"><td>Total</td><td style="text-align:right">S/${Number(doc.total).toFixed(2)}</td></tr>
      </table>
      <hr class="hr"/>
      <p class="c" style="font-size:.85em">Representacion Impresa de la ${(doc.tipo ?? '').toUpperCase()}</p>
      ${shareUrl ? `<p class="c" style="font-size:.75em">Consulte su validez en:<br/>${shareUrl}</p>` : ''}
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`);
    win.document.close();
  };

  // ── WhatsApp send ──────────────────────────────────────────────────────────
  const handleSendWhatsapp = () => {
    if (!phone.trim()) return;
    const num = phone.replace(/\D/g, '');
    const total = `S/ ${Number(doc.total).toFixed(2)}`;
    const msg = shareUrl
      ? encodeURIComponent(
          `Hola! Le compartimos su comprobante:\n\n` +
          `${(doc.tipo ?? '').toUpperCase()} ${doc.numeroCompleto}\n` +
          `Total: ${total}\n\n` +
          `Puede ver su comprobante en el siguiente link:\n${shareUrl}`
        )
      : encodeURIComponent(
          `Hola! Le compartimos los datos de su comprobante:\n\n` +
          `Documento: ${(doc.tipo ?? '').toUpperCase()} ${doc.numeroCompleto}\n` +
          `Cliente: ${clienteLabel}\n` +
          `Total: ${total}\n` +
          `Fecha: ${fechaStr}\n\n` +
          `Gracias por su preferencia.`
        );
    window.open(`https://wa.me/51${num}?text=${msg}`, '_blank');
    onClose();
  };

  // ── Correo send ────────────────────────────────────────────────────────────
  const handleSendCorreo = () => {
    if (!email.trim()) return;
    const total = `S/ ${Number(doc.total).toFixed(2)}`;
    const subject = encodeURIComponent(`Comprobante ${doc.numeroCompleto}`);
    const body = shareUrl
      ? encodeURIComponent(
          `Estimado(a) cliente,\n\nPuede ver su comprobante en el siguiente link:\n${shareUrl}\n\nGracias por su preferencia.`
        )
      : encodeURIComponent(
          `Estimado(a) cliente,\n\nLe compartimos los datos de su comprobante:\n\n` +
          `Documento: ${(doc.tipo ?? '').toUpperCase()} ${doc.numeroCompleto}\n` +
          `Cliente: ${clienteLabel}\n` +
          `Total: ${total}\n` +
          `Fecha: ${fechaStr}\n\n` +
          `Gracias por su preferencia.`
        );
    // Abre Gmail directamente en el navegador
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}`,
      '_blank'
    );
    onClose();
  };

  // ── Descarga ───────────────────────────────────────────────────────────────
  const handleDescarga = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
      return;
    }
    // Sin pdfUrl: generar el comprobante como HTML visualizable/imprimible en nueva pestaña
    const items = (doc.sale?.items ?? doc.items ?? [])
      .map((it: any) =>
        `<tr>
          <td style="text-align:center">${it.cantidad ?? ''}</td>
          <td>${it.descripcion ?? it.producto?.nombre ?? it.product?.nombre ?? ''}</td>
          <td style="text-align:right">${Number(it.precioUnitario ?? 0).toFixed(2)}</td>
          <td style="text-align:right">${Number(it.total ?? 0).toFixed(2)}</td>
        </tr>`
      ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>${doc.numeroCompleto}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Courier New', monospace; font-size: 11px; color:#000; max-width:700px; margin:0 auto; padding:20px; }
        .c  { text-align:center; }  .b { font-weight:bold; }
        .hr { border:none; border-top:1px dashed #000; margin:6px 0; }
        table { width:100%; border-collapse:collapse; }
        th  { border-bottom:1px solid #000; padding:3px 0; }
        td  { padding:3px 0; vertical-align:top; }
        .tot{ border-top:1px solid #000; font-weight:bold; }
        @media print { .no-print { display:none; } }
      </style></head><body>
      <div class="no-print" style="text-align:center;margin-bottom:12px">
        <button onclick="window.print()" style="background:#1d4ed8;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px">
          Imprimir / Guardar PDF
        </button>
      </div>
      <p class="c b" style="font-size:1.3em">${(doc.empresa?.razonSocial ?? '').toUpperCase()}</p>
      <p class="c">RUC: ${doc.empresa?.ruc ?? ''}</p>
      <p class="c" style="font-size:.9em">${doc.empresa?.direccion ?? ''}</p>
      <hr class="hr"/>
      <p class="c b">${(doc.tipo ?? 'COMPROBANTE').toUpperCase()}</p>
      <p class="c">${doc.numeroCompleto}</p>
      <p class="c">EMISION: ${fechaStr}</p>
      <hr class="hr"/>
      <p>Nombre   : ${doc.customer?.nombreCompleto ?? 'CLIENTES VARIOS'}</p>
      <p>Documento: ${doc.customer?.numeroDocumento ?? '00000000'}</p>
      ${doc.customer?.direccion ? `<p>Dirección: ${doc.customer.direccion}</p>` : ''}
      <hr class="hr"/>
      <table>
        <thead><tr>
          <th style="text-align:center;width:10%">Cant</th>
          <th style="text-align:left">Descripcion</th>
          <th style="text-align:right;width:14%">P.U</th>
          <th style="text-align:right;width:14%">P.T</th>
        </tr></thead>
        <tbody>${items}</tbody>
      </table>
      <hr class="hr"/>
      <table>
        <tr><td>OP. GRAVADA</td><td style="text-align:right">S/ ${Number(doc.gravada ?? 0).toFixed(2)}</td></tr>
        <tr><td>OP. EXONERADA</td><td style="text-align:right">S/ ${Number(doc.exonerada ?? (doc.igv == 0 ? doc.total : 0) ?? 0).toFixed(2)}</td></tr>
        <tr><td>IGV 18%</td><td style="text-align:right">S/ ${Number(doc.igv ?? 0).toFixed(2)}</td></tr>
        <tr class="tot"><td>Total</td><td style="text-align:right">S/ ${Number(doc.total).toFixed(2)}</td></tr>
      </table>
      <hr class="hr"/>
      <p class="c" style="font-size:.85em">Representacion Impresa de la ${(doc.tipo ?? '').toUpperCase()}</p>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  // ── Step: WhatsApp ─────────────────────────────────────────────────────────
  if (step === 'whatsapp') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="bg-zinc-900 flex items-center px-5 py-4">
            <button onClick={() => setStep('main')} className="text-white/60 hover:text-white transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
          <div className="px-6 pt-5 pb-7">
            <p className="text-center text-lg font-bold text-zinc-900">Completa los Datos</p>
            {shareUrl
              ? <p className="text-center text-sm text-zinc-500 mt-1 mb-5">Se enviará el link del PDF del comprobante.</p>
              : <p className="text-center text-sm text-amber-600 mt-1 mb-5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                  Sin PDF aún — se enviarán los datos del comprobante. Envía a SUNAT primero para compartir el PDF oficial.
                </p>
            }
            <div className="flex items-center border border-zinc-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-400 focus-within:border-green-400 transition-all">
              <span className="bg-zinc-100 px-3 py-3 text-sm font-semibold text-zinc-600 border-r border-zinc-300 select-none">+51</span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendWhatsapp()}
                placeholder="Envio Whatsapp"
                className="flex-1 px-3 py-3 text-sm outline-none bg-white text-zinc-800 placeholder-zinc-400"
                autoFocus
              />
              <button
                onClick={handleSendWhatsapp}
                disabled={!phone.trim()}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white px-4 py-3 transition-colors cursor-pointer"
              >
                <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Correo ───────────────────────────────────────────────────────────
  if (step === 'correo') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="bg-zinc-900 flex items-center px-5 py-4">
            <button onClick={() => setStep('main')} className="text-white/60 hover:text-white transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
          <div className="px-6 pt-5 pb-7">
            <p className="text-center text-lg font-bold text-zinc-900 mb-5">Completa los Datos</p>
            <div className="relative border border-zinc-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-all">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-zinc-500 font-medium">Envio Correo</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendCorreo()}
                placeholder="ejemplo@correo.com"
                className="w-full px-4 py-3.5 text-sm outline-none bg-white text-zinc-800 placeholder-zinc-400 rounded-lg"
                autoFocus
              />
            </div>
            <button
              onClick={handleSendCorreo}
              disabled={!email.trim()}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-lg transition-colors cursor-pointer tracking-wider"
            >
              ENVIAR CORREO
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Imprimir (selector tamaño) ──────────────────────────────────────
  if (step === 'print') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="bg-zinc-900 flex items-center gap-4 px-5 py-3">
            <button onClick={() => setStep('main')} className="text-white/60 hover:text-white transition-colors cursor-pointer flex-shrink-0">
              <X size={18} />
            </button>
            {(['A4', 'A5', '80mm', '58mm'] as PaperSize[]).map(s => (
              <button key={s} onClick={() => setSize(s)} className="flex items-center gap-1.5 cursor-pointer">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${size === s ? 'border-white' : 'border-zinc-500'}`}>
                  {size === s && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className={`text-sm font-medium ${size === s ? 'text-white' : 'text-zinc-400'}`}>{s}</span>
              </button>
            ))}
          </div>
          <div className="px-6 pt-5 pb-7">
            <p className="text-center text-lg font-bold text-zinc-900 mb-1">Selecciona el tamaño</p>
            <p className="text-center text-sm text-zinc-500 mb-5">{doc.numeroCompleto} · S/ {Number(doc.total).toFixed(2)}</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {(['A4', 'A5', '80mm', '58mm'] as PaperSize[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`py-3 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer ${
                    size === s
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
                  }`}
                >{s}</button>
              ))}
            </div>
            <button
              onClick={() => { execPrint(size); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9v-1h8v1H6zm8-4a1 1 0 110 2 1 1 0 010-2z" clipRule="evenodd"/>
              </svg>
              IMPRIMIR
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Main ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <p className="font-bold text-zinc-900 text-sm">{doc.numeroCompleto}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{clienteLabel}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer p-1">
            <X size={18} />
          </button>
        </div>

        {/* 4 tiles */}
        <div className="grid grid-cols-4 gap-3 p-5">
          {/* IMPRIME */}
          <button
            onClick={() => setStep('print')}
            className="flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border border-zinc-100 hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-95 cursor-pointer"
          >
            <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
              <rect x="8" y="16" width="32" height="20" rx="3" fill="#BFDBFE"/>
              <rect x="12" y="8" width="24" height="14" rx="2" fill="#3B82F6"/>
              <rect x="12" y="30" width="24" height="12" rx="2" fill="#1E40AF"/>
              <rect x="16" y="33" width="16" height="2" rx="1" fill="white"/>
              <rect x="16" y="37" width="10" height="2" rx="1" fill="white"/>
              <circle cx="34" cy="22" r="2.5" fill="#1E40AF"/>
              <path d="M8 19h32" stroke="#93C5FD" strokeWidth="1"/>
            </svg>
            <span className="text-[11px] font-bold tracking-wide text-blue-600">IMPRIME</span>
          </button>

          {/* WHATSAPP */}
          <button
            onClick={() => setStep('whatsapp')}
            className="flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border border-zinc-100 hover:bg-green-50 hover:border-green-200 transition-all active:scale-95 cursor-pointer"
          >
            <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
              <circle cx="24" cy="24" r="20" fill="#25D366"/>
              <path d="M33.5 14.5C31 12 27.6 10.5 24 10.5c-7.5 0-13.5 6-13.5 13.5 0 2.4.6 4.7 1.8 6.7L10 38l7.5-2.3c1.9 1 4.1 1.6 6.5 1.6 7.5 0 13.5-6 13.5-13.5 0-3.6-1.4-7-3.9-9.4z" fill="white"/>
              <path d="M30.5 27.8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0c-1.8-.9-3-1.6-4.2-3.6-.3-.5.3-.5.9-1.6.1-.2 0-.4-.1-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5s-.4 0-.6 0-.5.1-.8.4c-.3.3-1 1-1 2.5s1 2.9 1.2 3.1c.1.2 2 3 4.8 4.2 1.8.8 2.5.8 3.4.7.5-.1 1.6-.7 1.9-1.3.3-.6.3-1.2.2-1.3z" fill="#25D366"/>
            </svg>
            <span className="text-[11px] font-bold tracking-wide text-green-600">WHATSAPP</span>
          </button>

          {/* CORREO */}
          <button
            onClick={() => setStep('correo')}
            className="flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border border-zinc-100 hover:bg-red-50 hover:border-red-200 transition-all active:scale-95 cursor-pointer"
          >
            <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
              <rect x="4" y="10" width="40" height="28" rx="4" fill="#EA4335"/>
              <path d="M4 14l20 13 20-13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M4 38l13-12M44 38L31 26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <rect x="4" y="10" width="40" height="28" rx="4" fill="url(#gm2)" opacity=".5"/>
              <defs>
                <linearGradient id="gm2" x1="4" y1="10" x2="44" y2="38" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#EA4335"/>
                  <stop offset=".5" stopColor="#FBBC05" stopOpacity=".6"/>
                  <stop offset="1" stopColor="#34A853" stopOpacity=".5"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="text-[11px] font-bold tracking-wide text-red-500">CORREO</span>
          </button>

          {/* DESCARGA */}
          <button
            onClick={handleDescarga}
            className="flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border border-zinc-100 hover:bg-red-50 hover:border-red-200 transition-all active:scale-95 cursor-pointer"
          >
            <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
              <rect x="8" y="4" width="22" height="30" rx="3" fill="#F9FAFB" stroke="#D1D5DB" strokeWidth="1.5"/>
              <path d="M24 4l6 6h-6V4z" fill="#E5E7EB"/>
              <rect x="12" y="16" width="12" height="2" rx="1" fill="#9CA3AF"/>
              <rect x="12" y="20" width="9" height="2"  rx="1" fill="#9CA3AF"/>
              <rect x="12" y="12" width="6" height="2"  rx="1" fill="#EF4444"/>
              <text x="11" y="13" fontSize="5" fontWeight="bold" fill="#EF4444">PDF</text>
              <circle cx="34" cy="36" r="10" fill="#EF4444"/>
              <path d="M34 30v8M31 35l3 3 3-3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] font-bold tracking-wide text-red-600">DESCARGA</span>
          </button>
        </div>

        {/* Info del comprobante */}
        <div className="px-5 pb-5">
          <div className="bg-zinc-50 rounded-xl px-4 py-3 text-xs text-zinc-500 flex items-center flex-wrap gap-x-2 gap-y-1">
            <span className="font-bold text-zinc-800">{doc.numeroCompleto}</span>
            <span>·</span>
            <span>{clienteLabel}</span>
            <span>·</span>
            <span className="font-semibold text-zinc-700">S/ {Number(doc.total).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ComprobantesPage() {
  const location = useLocation();
  const initFrom = (location.state as any)?.showRechazados ? '' : todayISO();
  const initTo   = (location.state as any)?.showRechazados ? '' : todayISO();
  const [dateFrom, setDateFrom]   = useState(initFrom);
  const [dateTo, setDateTo]       = useState(initTo);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [detailId, setDetailId]   = useState<string | null>(null);
  const [waDoc, setWaDoc]         = useState<any>(null);
  const [printDoc, setPrintDoc]   = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', { dateFrom, dateTo, search, page }],
    queryFn: () => docService.getAll({
      dateFrom:  dateFrom  || undefined,
      dateTo:    dateTo    || undefined,
      search:    search    || undefined,
      page,
      limit: 20,
    }),
    placeholderData: (prev: any) => prev,
  });

  const docs       = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalGeneral = docs.reduce((acc: number, d: any) => acc + Number(d.total), 0);

  return (
    <div className="min-h-full bg-zinc-50">

      {/* ── Banner ── */}
      <div
        className="relative overflow-hidden flex items-center gap-5 px-8 py-7"
        style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 60%, #14b8a6 100%)' }}
      >
        {/* Patrón decorativo */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,.15) 20px, rgba(255,255,255,.15) 21px)' }}
        />
        {/* Círculos de fondo */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -right-4 top-8 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 shadow-lg">
          <FileText size={28} className="text-white" strokeWidth={1.5} />
        </div>
        <div className="relative">
          <h1 className="text-2xl font-bold text-white tracking-tight leading-none">Comprobantes</h1>
          <p className="text-teal-100 text-sm mt-1">Boletas, facturas y documentos electrónicos emitidos</p>
        </div>

      </div>

      {/* ── Filtros de fecha + buscador ── */}
      <div className="flex flex-wrap items-end gap-3 px-6 py-4 bg-white border-b border-zinc-200">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1">Inicio</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="border border-zinc-300 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all cursor-pointer"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1">Fin</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="border border-zinc-300 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all cursor-pointer"
          />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-1 block mb-1">Busca Documento</label>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Correlativo, cliente..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-300 rounded-xl outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all"
            />
          </div>
        </div>
        {(search || dateFrom !== todayISO() || dateTo !== todayISO()) && (
          <button
            onClick={() => { setSearch(''); setDateFrom(todayISO()); setDateTo(todayISO()); setPage(1); }}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:border-zinc-400 px-3 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      {/* ── Total general ── */}
      <div className="px-6 py-2.5 bg-white border-b border-zinc-100">
        <p className="text-sm font-bold text-zinc-800 text-center">
          Total General: <span className="text-teal-700">S/.{totalGeneral.toFixed(2)}</span>
          {isLoading && <span className="ml-2 text-xs font-normal text-zinc-400">Actualizando…</span>}
        </p>
      </div>

      {/* ── Tabla ── */}
      <div className="mx-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left text-xs font-semibold text-zinc-500 px-5 py-3">Correlativo</th>
                <th className="text-left text-xs font-semibold text-zinc-500 px-5 py-3">Cliente</th>
                <th className="text-left text-xs font-semibold text-zinc-500 px-5 py-3">Fecha</th>
                <th className="text-center text-xs font-semibold text-zinc-500 px-5 py-3">Estado</th>
                <th className="text-right text-xs font-semibold text-zinc-500 px-5 py-3">Total</th>
                <th className="text-center text-xs font-semibold text-zinc-500 px-5 py-3">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-zinc-50/60' : 'bg-white'}>
                      {[1,2,3,4,5,6].map(j => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3.5 bg-zinc-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : docs.length === 0
                  ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
                            <FileText size={28} className="text-zinc-300" strokeWidth={1.5} />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-zinc-600">Sin comprobantes en este período</p>
                            <p className="text-xs text-zinc-400 mt-1">Ajusta las fechas o genera un nuevo comprobante</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                  : docs.map((doc: any, idx: number) => {
                      const fechaStr = doc.fechaEmision
                        ? new Date(doc.fechaEmision).toLocaleString('es-PE', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: true,
                          })
                        : '—';
                      const clienteLabel = doc.customer
                        ? `${doc.customer.numeroDocumento} - ${doc.customer.nombreCompleto}`
                        : '00000000 - CLIENTES VARIOS';

                      return (
                        <tr
                          key={doc.id}
                          className={`group hover:bg-teal-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/40'}`}
                        >
                          <td className="px-5 py-3 font-mono font-bold text-zinc-800 text-sm">
                            {doc.numeroCompleto}
                          </td>
                          <td className="px-5 py-3 text-zinc-700 text-sm max-w-[280px] truncate">
                            {clienteLabel}
                          </td>
                          <td className="px-5 py-3 text-zinc-600 text-sm whitespace-nowrap">
                            {fechaStr}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center">
                              <span className={`w-3 h-3 rounded-full ${
                                doc.estado === 'aceptado' ? 'bg-emerald-500 stock-dot-live' :
                                doc.estado === 'pendiente' ? 'bg-amber-400' :
                                doc.estado === 'anulado' ? 'bg-zinc-400' :
                                doc.estado === 'rechazado' ? 'bg-red-500' :
                                'bg-blue-400'
                              }`} />
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-zinc-800">
                            S/{Number(doc.total).toFixed(2)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                              {/* Ver detalle */}
                              <button
                                onClick={() => setDetailId(doc.id)}
                                className="p-2 rounded-lg hover:bg-teal-100 text-teal-600 transition-colors cursor-pointer"
                                title="Ver detalle"
                              >
                                <Eye size={17} />
                              </button>
                              {/* Imprimir / Compartir */}
                              <button
                                onClick={() => setPrintDoc(doc)}
                                className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
                                title="Imprimir / Compartir"
                              >
                                <svg viewBox="0 0 22 22" className="w-[18px] h-[18px]" fill="none">
                                  <rect x="3" y="7" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                                  <path d="M6 7V4a1 1 0 011-1h8a1 1 0 011 1v3" stroke="currentColor" strokeWidth="1.5"/>
                                  <rect x="6" y="13" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                                  <circle cx="16" cy="10.5" r="1" fill="currentColor"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
              }
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-200 bg-white">
            <span className="text-xs text-zinc-500">Página {page} de {totalPages} · {data?.total ?? 0} comprobantes</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-25 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} className="text-zinc-600" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-25 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} className="text-zinc-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} />}
      {waDoc && <WhatsAppModal doc={waDoc} onClose={() => setWaDoc(null)} />}
      {printDoc && <PrintShareModal doc={printDoc} onClose={() => setPrintDoc(null)} />}
    </div>
  );
}
