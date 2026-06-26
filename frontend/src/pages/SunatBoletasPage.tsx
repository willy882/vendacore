import { useState, useEffect, useRef } from 'react';
import {
  Search, ChevronDown, Eye, Download, Send,
  FileX2, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, Clock, XCircle, FileText,
  Printer, X, MessageCircle, RefreshCw,
  Trash2, FileMinus,
} from 'lucide-react';
import api from '@/lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

const fmtMoney = (v: number | string) =>
  `S/.${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | Date) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')} ${dt.getHours() < 12 ? 'AM' : 'PM'}`;
};

const fmtDateShort = (d: string | Date) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700' },
  enviado:   { label: 'Enviado',   color: 'bg-blue-100 text-blue-700' },
  aceptado:  { label: 'Aceptado',  color: 'bg-emerald-100 text-emerald-700' },
  observado: { label: 'Observado', color: 'bg-orange-100 text-orange-700' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
  anulado:   { label: 'Anulado',   color: 'bg-slate-100 text-slate-500' },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pendiente: <Clock size={11} />,
  enviado:   <FileText size={11} />,
  aceptado:  <CheckCircle size={11} />,
  observado: <AlertCircle size={11} />,
  rechazado: <XCircle size={11} />,
  anulado:   <XCircle size={11} />,
};

interface Doc {
  id: string;
  tipo: string;
  serie: string;
  correlativo: number;
  numeroCompleto: string;
  estado: string;
  fechaEmision: string;
  subtotal?: number | string;
  igv?: number | string;
  total: number | string;
  xmlUrl?: string;
  pdfUrl?: string;
  hashCpe?: string;
  respuestaSunat?: string;
  customer?: { id: string; nombreCompleto: string; numeroDocumento: string; telefono?: string } | null;
  sale?: {
    tipoVenta?: string;
    items?: Array<{
      cantidad: number;
      precioUnitario: number;
      descripcion?: string;
      product?: { nombre: string };
    }>;
    payments?: Array<{
      monto: number;
      paymentMethod?: { nombre: string };
    }>;
  };
}

type PaperSize = 'A4' | 'A5' | '80mm' | '58mm';

// ── Modal Detalle ─────────────────────────────────────────────────────────────

const TIP_NOTA_OPTIONS = [
  { code: '01', label: 'Anulación de la operación' },
  { code: '06', label: 'Devolución total' },
  { code: '03', label: 'Corrección por error en descripción' },
  { code: '07', label: 'Devolución por ítem' },
  { code: '10', label: 'Otros conceptos' },
];

function DetailModal({ docId, onClose, onRefresh }: { docId: string; onClose: () => void; onRefresh: () => void }) {
  const [doc, setDoc]           = useState<Doc | null>(null);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [annulling, setAnnulling] = useState(false);
  const [confirmAnular, setConfirmAnular] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok?: boolean; msg?: string } | null>(null);
  const [showNc, setShowNc]         = useState(false);
  const [ncTipNota, setNcTipNota]   = useState('01');
  const [ncMotivo, setNcMotivo]     = useState('');
  const [creatingNc, setCreatingNc] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/documents/${docId}`)
      .then((r) => setDoc(r.data))
      .catch(() => setDoc(null))
      .finally(() => setLoading(false));
  }, [docId]);

  const pdfUrl = doc
    ? doc.estado === 'aceptado'
      ? `https://vendacore-backend.fly.dev/api/v1/documents/${doc.id}/pdf`
      : (doc.pdfUrl ?? '')
    : '';

  const handleReenviar = async () => {
    if (!doc) return;
    setSending(true);
    setSendResult(null);
    try {
      const r = await api.post(`/documents/${doc.id}/send-sunat`);
      setSendResult({ ok: true, msg: r.data?.sunatDescription ?? 'Enviado correctamente' });
      const updated = await api.get(`/documents/${doc.id}`);
      setDoc(updated.data);
      onRefresh();
    } catch (e: any) {
      setSendResult({ ok: false, msg: e?.response?.data?.message ?? 'Error al enviar' });
    } finally {
      setSending(false);
    }
  };

  const handleAnular = async () => {
    if (!doc) return;
    setAnnulling(true);
    try {
      await api.patch(`/documents/${doc.id}/status`, { estado: 'anulado' });
      const updated = await api.get(`/documents/${doc.id}`);
      setDoc(updated.data);
      setConfirmAnular(false);
      onRefresh();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al anular');
    } finally {
      setAnnulling(false);
    }
  };

  const handleWhatsapp = () => {
    if (!doc) return;
    const tel = doc.customer?.telefono?.replace(/\D/g, '') ?? '';
    const total = fmtMoney(doc.total);
    const msg = pdfUrl
      ? encodeURIComponent(
          `Hola! Le compartimos su comprobante:\n\n` +
          `${(doc.tipo ?? '').toUpperCase()} ${doc.numeroCompleto}\n` +
          `Total: ${total}\n\n` +
          `Descargue su comprobante aquí:\n${pdfUrl}`
        )
      : encodeURIComponent(
          `Hola! Le compartimos los datos de su comprobante:\n\n` +
          `${(doc.tipo ?? '').toUpperCase()} ${doc.numeroCompleto}\n` +
          `Total: ${total}\n\n` +
          `Gracias por su preferencia.`
        );
    const num = tel ? `51${tel}` : '';
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <p className="font-bold text-slate-800">{doc?.numeroCompleto ?? '...'}</p>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{doc?.tipo} · {doc ? fmtDateShort(doc.fechaEmision) : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Cargando...</div>
        ) : !doc ? (
          <div className="flex items-center justify-center py-16 text-red-500 text-sm">Error al cargar el comprobante</div>
        ) : (
          <div className="p-5 space-y-4 text-sm">

            {/* Info general */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4">
              <div>
                <p className="text-xs text-slate-500">Número</p>
                <p className="font-bold text-slate-800">{doc.numeroCompleto}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Estado</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${STATUS_CFG[doc.estado]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_ICON[doc.estado]} {STATUS_CFG[doc.estado]?.label ?? doc.estado}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500">Cliente</p>
                <p className="font-medium text-slate-700">{doc.customer?.nombreCompleto ?? 'Clientes Varios'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Doc. cliente</p>
                <p className="font-medium font-mono text-slate-700">{doc.customer?.numeroDocumento ?? '00000000'}</p>
              </div>
            </div>

            {/* Totales */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Subtotal</p>
                <p className="font-semibold text-slate-800">{fmtMoney(doc.subtotal ?? 0)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">IGV</p>
                <p className="font-semibold text-slate-800">{fmtMoney(doc.igv ?? 0)}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">Total</p>
                <p className="font-bold text-blue-700">{fmtMoney(doc.total)}</p>
              </div>
            </div>

            {/* Items del pedido */}
            {(doc.sale?.items?.length ?? 0) > 0 && (
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
                      {doc.sale!.items!.map((item, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-2 text-slate-700">{item.product?.nombre ?? item.descripcion ?? '—'}</td>
                          <td className="px-2 py-2 text-center text-slate-600">{item.cantidad}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">
                            {fmtMoney(Number(item.precioUnitario) * Number(item.cantidad))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagos */}
            {(doc.sale?.payments?.filter((p) => Number(p.monto) > 0).length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pagos</p>
                <div className="flex flex-wrap gap-2">
                  {doc.sale!.payments!.filter((p) => Number(p.monto) > 0).map((p, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700">
                      {p.paymentMethod?.nombre ?? 'Pago'}
                      <span className="font-bold text-slate-900">{fmtMoney(p.monto)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Respuesta SUNAT */}
            {(doc.respuestaSunat || doc.hashCpe) && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-emerald-700">Respuesta SUNAT</p>
                {doc.respuestaSunat && <p className="text-xs text-emerald-700">{doc.respuestaSunat}</p>}
                {doc.hashCpe && <p className="text-xs text-slate-500 font-mono break-all">Hash: {doc.hashCpe}</p>}
              </div>
            )}

            {/* Resultado del envío */}
            {sendResult && (
              <div className={`rounded-xl p-3 text-xs font-medium ${sendResult.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {sendResult.ok ? '✓ ' : '✗ '}{sendResult.msg}
              </div>
            )}

            {/* Acciones */}
            <div className="space-y-2 pt-1">
              {/* WhatsApp */}
              <button
                onClick={handleWhatsapp}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ background: '#25D366' }}
              >
                <MessageCircle size={16} />
                Enviar por WhatsApp
              </button>

              {/* Reenviar SUNAT */}
              {doc.estado !== 'aceptado' && doc.estado !== 'anulado' && (
                <button
                  onClick={handleReenviar}
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
                >
                  <RefreshCw size={15} className={sending ? 'animate-spin' : ''} />
                  {sending ? 'Enviando a SUNAT...' : 'Reenviar a SUNAT'}
                </button>
              )}

              {/* PDF */}
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  <Download size={15} />
                  Descargar PDF
                </a>
              )}

              {/* Anular */}
              {doc.estado !== 'anulado' && (
                !confirmAnular ? (
                  <button
                    onClick={() => setConfirmAnular(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} /> Anular comprobante
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
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
                        onClick={handleAnular}
                        disabled={annulling}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {annulling ? 'Anulando...' : 'Sí, anular'}
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* Nota de Crédito — solo para aceptados que no son NC ni ND */}
              {doc.estado === 'aceptado' && doc.tipo !== 'nota_credito' && doc.tipo !== 'nota_debito' && (
                !showNc ? (
                  <button
                    onClick={() => setShowNc(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-amber-700 border border-amber-300 hover:bg-amber-50 transition-colors"
                  >
                    <FileMinus size={13} /> Emitir Nota de Crédito
                  </button>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                    <p className="text-xs font-semibold text-amber-800">Emitir Nota de Crédito</p>

                    {/* Tipo de nota */}
                    <div>
                      <label className="block text-xs text-amber-700 mb-1">Tipo de nota</label>
                      <select
                        value={ncTipNota}
                        onChange={(e) => setNcTipNota(e.target.value)}
                        className="w-full border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400"
                      >
                        {TIP_NOTA_OPTIONS.map((o) => (
                          <option key={o.code} value={o.code}>{o.code} – {o.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Motivo */}
                    <div>
                      <label className="block text-xs text-amber-700 mb-1">Motivo</label>
                      <textarea
                        value={ncMotivo}
                        onChange={(e) => setNcMotivo(e.target.value)}
                        rows={2}
                        placeholder="Describa el motivo de la nota de crédito..."
                        className="w-full border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowNc(false); setNcMotivo(''); setNcTipNota('01'); }}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                      <button
                        disabled={creatingNc || !ncMotivo.trim()}
                        onClick={async () => {
                          if (!doc || !ncMotivo.trim()) return;
                          setCreatingNc(true);
                          try {
                            await api.post('/documents/nota-credito', {
                              documentId: doc.id,
                              tipNota: ncTipNota,
                              motivo: ncMotivo.trim(),
                            });
                            setShowNc(false);
                            setNcMotivo('');
                            setNcTipNota('01');
                            onRefresh();
                            onClose();
                          } catch (e: any) {
                            alert(e?.response?.data?.message ?? 'Error al crear la nota de crédito');
                          } finally {
                            setCreatingNc(false);
                          }
                        }}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {creatingNc ? 'Emitiendo...' : 'Emitir NC'}
                      </button>
                    </div>
                  </div>
                )
              )}

              {doc.estado === 'anulado' && (
                <div className="bg-slate-100 rounded-xl p-3 text-center text-xs text-slate-500">
                  Este comprobante está anulado
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal Imprimir / Compartir ────────────────────────────────────────────────

type ShareStep = 'main' | 'whatsapp' | 'correo';

function PrintShareModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [step, setStep]   = useState<ShareStep>('main');
  const [size, setSize]   = useState<PaperSize>('80mm');
  const [phone, setPhone] = useState(doc.customer?.telefono?.replace(/\D/g, '') ?? '');
  const [email, setEmail] = useState('');

  const clienteLabel = doc.customer
    ? `${doc.customer.numeroDocumento} - ${doc.customer.nombreCompleto}`
    : '00000000 - CLIENTES VARIOS';

  const fechaStr = fmtDate(doc.fechaEmision);

  const pdfUrl = doc.estado === 'aceptado'
    ? `https://vendacore-backend.fly.dev/api/v1/documents/${doc.id}/pdf`
    : (doc.pdfUrl ?? '');

  // ── Imprimir ────────────────────────────────────────────────────────────────
  const execPrint = (sz: PaperSize) => {
    const dims: Record<PaperSize, { w: string; h: string }> = {
      '80mm': { w: '80mm',  h: 'auto' },
      '58mm': { w: '58mm',  h: 'auto' },
      'A5':   { w: '148mm', h: '210mm' },
      'A4':   { w: '210mm', h: '297mm' },
    };
    const { w, h } = dims[sz];
    const fz = sz === '58mm' ? '9px' : sz === '80mm' ? '10px' : '11px';
    const items = (doc.sale?.items ?? [])
      .map((it) =>
        `<tr>
          <td style="text-align:center">${it.cantidad ?? ''}</td>
          <td>${it.product?.nombre ?? it.descripcion ?? ''}</td>
          <td style="text-align:right">${Number(it.precioUnitario ?? 0).toFixed(2)}</td>
          <td style="text-align:right">${(Number(it.precioUnitario ?? 0) * Number(it.cantidad)).toFixed(2)}</td>
        </tr>`
      ).join('');
    const pagos = (doc.sale?.payments ?? [])
      .filter((p) => Number(p.monto) > 0)
      .map((p) => `${p.paymentMethod?.nombre ?? 'Pago'}: S/${Number(p.monto).toFixed(2)}`)
      .join(' | ');
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
      <p class="c b" style="font-size:1.15em">COMPROBANTE ELECTRONICO</p>
      <hr class="hr"/>
      <p class="c b">${(doc.tipo ?? 'COMPROBANTE').toUpperCase()}</p>
      <p class="c">${doc.numeroCompleto}</p>
      <p class="c">EMISION: ${fechaStr}</p>
      <hr class="hr"/>
      <p>Nombre  : ${doc.customer?.nombreCompleto ?? 'CLIENTES VARIOS'}</p>
      <p>Documento: ${doc.customer?.numeroDocumento ?? '00000000'}</p>
      <hr class="hr"/>
      <table>
        <thead><tr>
          <th style="text-align:center;width:12%">Cant</th>
          <th style="text-align:left">Descripcion</th>
          <th style="text-align:right;width:14%">P.U</th>
          <th style="text-align:right;width:16%">P.T</th>
        </tr></thead>
        <tbody>${items || '<tr><td colspan="4" style="text-align:center">—</td></tr>'}</tbody>
      </table>
      <hr class="hr"/>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">S/${Number(doc.subtotal ?? 0).toFixed(2)}</td></tr>
        <tr><td>IGV 18%</td><td style="text-align:right">S/${Number(doc.igv ?? 0).toFixed(2)}</td></tr>
        <tr class="tot"><td>TOTAL</td><td style="text-align:right">S/${Number(doc.total).toFixed(2)}</td></tr>
      </table>
      ${pagos ? `<hr class="hr"/><p>${pagos}</p>` : ''}
      <hr class="hr"/>
      <p class="c" style="font-size:.85em">Representacion Impresa de la ${(doc.tipo ?? '').toUpperCase()}</p>
      ${pdfUrl ? `<p class="c" style="font-size:.75em">Consulte en:<br/>${pdfUrl}</p>` : ''}
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`);
    win.document.close();
  };

  // ── WhatsApp ────────────────────────────────────────────────────────────────
  const handleWhatsapp = () => {
    if (!phone.trim()) return;
    const num = phone.replace(/\D/g, '');
    const total = fmtMoney(doc.total);
    const msg = pdfUrl
      ? encodeURIComponent(
          `Hola! Le compartimos su comprobante:\n\n` +
          `${(doc.tipo ?? '').toUpperCase()} ${doc.numeroCompleto}\n` +
          `Total: ${total}\n\n` +
          `Descargue su comprobante aquí:\n${pdfUrl}`
        )
      : encodeURIComponent(
          `Hola! Le compartimos los datos de su comprobante:\n\n` +
          `${(doc.tipo ?? '').toUpperCase()} ${doc.numeroCompleto}\n` +
          `Cliente: ${clienteLabel}\n` +
          `Total: ${total}\n` +
          `Fecha: ${fechaStr}\n\n` +
          `Gracias por su preferencia.`
        );
    window.open(`https://wa.me/51${num}?text=${msg}`, '_blank');
    onClose();
  };

  // ── Correo ──────────────────────────────────────────────────────────────────
  const handleCorreo = () => {
    if (!email.trim()) return;
    const total = fmtMoney(doc.total);
    const subject = encodeURIComponent(`Comprobante ${doc.numeroCompleto}`);
    const body = pdfUrl
      ? encodeURIComponent(
          `Estimado(a) cliente,\n\nPuede ver su comprobante en el siguiente link:\n${pdfUrl}\n\nGracias por su preferencia.`
        )
      : encodeURIComponent(
          `Estimado(a) cliente,\n\nLe compartimos los datos de su comprobante:\n\n` +
          `Documento: ${(doc.tipo ?? '').toUpperCase()} ${doc.numeroCompleto}\n` +
          `Cliente: ${clienteLabel}\n` +
          `Total: ${total}\n\n` +
          `Gracias por su preferencia.`
        );
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}`,
      '_blank'
    );
    onClose();
  };

  // ── Descarga ────────────────────────────────────────────────────────────────
  const handleDescarga = () => {
    if (pdfUrl) { window.open(pdfUrl, '_blank'); return; }
    execPrint('A4');
  };

  // ── Step: WhatsApp ──────────────────────────────────────────────────────────
  if (step === 'whatsapp') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="bg-zinc-900 flex items-center px-5 py-4">
            <button onClick={() => setStep('main')} className="text-white/60 hover:text-white transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
          <div className="px-6 pt-5 pb-7">
            <p className="text-center text-lg font-bold text-zinc-900 mb-1">Enviar por WhatsApp</p>
            {!pdfUrl && (
              <p className="text-center text-xs text-amber-600 mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Sin PDF — se enviarán los datos del comprobante.
              </p>
            )}
            <div className="flex items-center border border-zinc-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-400 mt-4">
              <span className="bg-zinc-100 px-3 py-3 text-sm font-semibold text-zinc-600 border-r border-zinc-300">+51</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleWhatsapp()}
                placeholder="Número de celular"
                className="flex-1 px-3 py-3 text-sm outline-none bg-white text-zinc-800 placeholder-zinc-400"
                autoFocus
              />
              <button
                onClick={handleWhatsapp}
                disabled={!phone.trim()}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white px-4 py-3 transition-colors"
              >
                <MessageCircle size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Correo ────────────────────────────────────────────────────────────
  if (step === 'correo') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="bg-zinc-900 flex items-center px-5 py-4">
            <button onClick={() => setStep('main')} className="text-white/60 hover:text-white transition-colors cursor-pointer">
              <X size={18} />
            </button>
          </div>
          <div className="px-6 pt-5 pb-7">
            <p className="text-center text-lg font-bold text-zinc-900 mb-5">Enviar por Correo</p>
            <div className="relative border border-zinc-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-400 transition-all">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-zinc-500 font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCorreo()}
                placeholder="cliente@correo.com"
                className="w-full px-4 py-3.5 text-sm outline-none bg-white text-zinc-800 placeholder-zinc-400 rounded-lg"
                autoFocus
              />
            </div>
            <button
              onClick={handleCorreo}
              disabled={!email.trim()}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-lg transition-colors"
            >
              ENVIAR CORREO
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Main ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Barra oscura con tamaños + X */}
        <div className="bg-zinc-900 flex items-center gap-3 px-4 py-3">
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors flex-shrink-0">
            <X size={18} />
          </button>
          <div className="w-px h-4 bg-zinc-700" />
          {(['A4', 'A5', '80mm', '58mm'] as PaperSize[]).map((s) => (
            <button key={s} onClick={() => setSize(s)} className="flex items-center gap-1.5 cursor-pointer">
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${size === s ? 'border-white' : 'border-zinc-500'}`}>
                {size === s && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className={`text-sm font-semibold ${size === s ? 'text-white' : 'text-zinc-400'}`}>{s}</span>
            </button>
          ))}
        </div>
        {/* Info doc */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <div>
            <p className="font-bold text-zinc-900 text-sm">{doc.numeroCompleto}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{clienteLabel}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 p-5">
          {/* IMPRIME */}
          <button
            onClick={() => execPrint(size)}
            className="flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border border-zinc-100 hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-95"
          >
            <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
              <rect x="8" y="16" width="32" height="20" rx="3" fill="#BFDBFE"/>
              <rect x="12" y="8" width="24" height="14" rx="2" fill="#3B82F6"/>
              <rect x="12" y="30" width="24" height="12" rx="2" fill="#1E40AF"/>
              <rect x="16" y="33" width="16" height="2" rx="1" fill="white"/>
              <rect x="16" y="37" width="10" height="2" rx="1" fill="white"/>
              <circle cx="34" cy="22" r="2.5" fill="#1E40AF"/>
            </svg>
            <span className="text-[11px] font-bold tracking-wide text-blue-600">IMPRIME</span>
          </button>
          {/* WHATSAPP */}
          <button
            onClick={() => setStep('whatsapp')}
            className="flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border border-zinc-100 hover:bg-green-50 hover:border-green-200 transition-all active:scale-95"
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
            className="flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border border-zinc-100 hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
          >
            <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
              <rect x="4" y="10" width="40" height="28" rx="4" fill="#EA4335"/>
              <path d="M4 14l20 13 20-13" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M4 38l13-12M44 38L31 26" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-[11px] font-bold tracking-wide text-red-500">CORREO</span>
          </button>
          {/* DESCARGA */}
          <button
            onClick={handleDescarga}
            className="flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-2xl border border-zinc-100 hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
          >
            <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
              <rect x="6" y="4" width="36" height="40" rx="4" fill="#E53E3E"/>
              <rect x="10" y="8" width="28" height="32" rx="2" fill="white"/>
              <path d="M16 28l8 8 8-8" stroke="#E53E3E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24 20v16" stroke="#E53E3E" strokeWidth="2.5" strokeLinecap="round"/>
              <rect x="10" y="8" width="28" height="8" rx="2" fill="#E53E3E"/>
              <text x="13" y="17" fill="white" fontSize="7" fontWeight="bold" fontFamily="monospace">PDF</text>
            </svg>
            <span className="text-[11px] font-bold tracking-wide text-red-600">DESCARGA</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RowActions ────────────────────────────────────────────────────────────────

function RowActions({
  onDetail,
  onPrint,
}: {
  onDetail: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      {/* Ojo — Ver detalle */}
      <button
        onClick={onDetail}
        title="Ver detalle"
        className="p-1.5 rounded-lg text-teal-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
      >
        <Eye size={16} />
      </button>
      {/* Impresora / Compartir */}
      <button
        onClick={onPrint}
        title="Imprimir / Compartir"
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <Printer size={16} />
      </button>
    </div>
  );
}

// ── Dropdown OPCIONES ─────────────────────────────────────────────────────────

function OpcionesDropdown({ docs }: { docs: Doc[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMasivoXML = () => {
    setOpen(false);
    const xmlDocs = docs.filter((d) => d.xmlUrl);
    if (xmlDocs.length === 0) {
      alert('No hay documentos con XML disponible en el período seleccionado.');
      return;
    }
    xmlDocs.slice(0, 10).forEach((d) => { if (d.xmlUrl) window.open(d.xmlUrl, '_blank'); });
  };

  const handleCargaXML = () => {
    setOpen(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files: File[] = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      api.post('/documents/upload-xml', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(() => {
        alert(`${files.length} archivo(s) XML subido(s) correctamente.`);
      }).catch(() => {
        alert('Error al subir los archivos XML. Verifica el formato e inténtalo de nuevo.');
      });
    };
    input.click();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
      >
        OPCIONES
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-44 py-1 overflow-hidden">
          <button
            onClick={handleMasivoXML}
            className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <Download size={14} className="text-slate-400" />
            Masivo XML
          </button>
          <div className="border-t border-slate-100" />
          <button
            onClick={handleCargaXML}
            className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <Send size={14} className="text-slate-400" />
            Carga XML
          </button>
        </div>
      )}
    </div>
  );
}

// ── SunatBoletasPage ──────────────────────────────────────────────────────────

type TipoFiltro = 'todos' | 'boleta' | 'factura';

const TIPO_TABS: { key: TipoFiltro; label: string }[] = [
  { key: 'todos',   label: 'Todos' },
  { key: 'boleta',  label: 'Boletas' },
  { key: 'factura', label: 'Facturas' },
];

export default function SunatBoletasPage() {
  const [desde, setDesde]         = useState(todayStr());
  const [hasta, setHasta]         = useState(todayStr());
  const [search, setSearch]       = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [page, setPage]           = useState(1);
  const limit = 25;

  const [docs, setDocs]             = useState<Doc[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // Modales
  const [detailId, setDetailId]   = useState<string | null>(null);
  const [printDoc, setPrintDoc]   = useState<Doc | null>(null);

  const fetchDocs = async (p = page) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page: p, limit };
      if (desde)  params.from   = desde;
      if (hasta)  params.to     = hasta;
      if (search) params.search = search;
      const { data } = await api.get('/documents', { params });
      const all: Doc[] = data.data ?? data ?? [];
      const filtered = all.filter((d) =>
        tipoFiltro === 'todos'
          ? d.tipo === 'boleta' || d.tipo === 'factura'
          : d.tipo === tipoFiltro,
      );
      setDocs(filtered);
      setTotal(data.total ?? filtered.length);
      setTotalPages(data.totalPages ?? Math.ceil((data.total ?? filtered.length) / limit));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al cargar comprobantes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(1); setPage(1); }, [desde, hasta, search, tipoFiltro]);
  useEffect(() => { fetchDocs(page); }, [page]);

  const totalBoletas  = docs.filter((d) => d.tipo === 'boleta').reduce((a, d) => a + Number(d.total), 0);
  const totalFacturas = docs.filter((d) => d.tipo === 'factura').reduce((a, d) => a + Number(d.total), 0);

  return (
    <div className="p-6 space-y-4">

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Inicio</span>
            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="px-3 py-2 text-sm outline-none bg-white text-slate-700 w-38"
              />
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Fin</span>
            <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden">
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="px-3 py-2 text-sm outline-none bg-white text-slate-700 w-38"
              />
            </div>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Buscar</span>
            <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-white">
              <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">B</span>
              <input
                className="flex-1 text-sm outline-none placeholder:text-slate-400"
                placeholder="Busca Documento"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search size={14} className="text-slate-400 flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + Totales + OPCIONES */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
          {TIPO_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setTipoFiltro(tab.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tipoFiltro === tab.key
                  ? tab.key === 'boleta'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : tab.key === 'factura'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.key !== 'todos' && (
                <span className={`ml-1.5 text-[10px] font-mono ${tipoFiltro === tab.key ? 'opacity-80' : 'opacity-60'}`}>
                  {fmtMoney(tab.key === 'boleta' ? totalBoletas : totalFacturas)}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {tipoFiltro === 'todos' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-500">Boletas:</span>
              <span className="text-sm font-bold text-slate-800">{fmtMoney(totalBoletas)}</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-500">Facturas:</span>
              <span className="text-sm font-bold text-slate-800">{fmtMoney(totalFacturas)}</span>
            </div>
          </>
        )}
        {tipoFiltro === 'boleta' && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-500">Total Boletas:</span>
            <span className="text-sm font-bold text-blue-700">{fmtMoney(totalBoletas)}</span>
            <span className="text-xs text-slate-400">({docs.length} doc.)</span>
          </div>
        )}
        {tipoFiltro === 'factura' && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-500">Total Facturas:</span>
            <span className="text-sm font-bold text-emerald-700">{fmtMoney(totalFacturas)}</span>
            <span className="text-xs text-slate-400">({docs.length} doc.)</span>
          </div>
        )}

        <div className="ml-auto">
          <OpcionesDropdown docs={docs} />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 text-sm">{error}</div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
              <FileX2 size={26} className="opacity-30" />
            </div>
            <p className="text-sm font-medium text-slate-600">Sin comprobantes en este período</p>
            <p className="text-xs">Ajusta las fechas o emite nuevos documentos.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Correlativo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Estado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {docs.map((doc) => {
                    const st   = STATUS_CFG[doc.estado] ?? { label: doc.estado, color: 'bg-slate-100 text-slate-600' };
                    const icon = STATUS_ICON[doc.estado];
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-mono font-semibold text-slate-800 text-xs leading-tight">{doc.numeroCompleto}</div>
                          <div className="text-[10px] text-slate-400 capitalize mt-0.5">{doc.tipo}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800 font-medium leading-tight text-xs">
                            {doc.customer?.nombreCompleto ?? 'Clientes Varios'}
                          </div>
                          {doc.customer?.numeroDocumento && (
                            <div className="text-[10px] text-slate-400 font-mono">{doc.customer.numeroDocumento}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {fmtDateShort(doc.fechaEmision)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${st.color}`}>
                            {icon} {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 text-xs whitespace-nowrap">
                          {fmtMoney(doc.total)}
                        </td>
                        <td className="px-4 py-3">
                          <RowActions
                            onDetail={() => setDetailId(doc.id)}
                            onPrint={() => setPrintDoc(doc)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  Página {page} de {totalPages} · {total} documentos
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer total general */}
      {docs.length > 0 && (
        <div className="flex items-center justify-end gap-6 px-2 text-xs text-slate-500">
          <span>{docs.filter((d) => d.tipo === 'boleta').length} boleta{docs.filter((d) => d.tipo === 'boleta').length !== 1 ? 's' : ''}</span>
          <span>{docs.filter((d) => d.tipo === 'factura').length} factura{docs.filter((d) => d.tipo === 'factura').length !== 1 ? 's' : ''}</span>
          <span className="font-semibold text-slate-700">
            Total general: {fmtMoney(totalBoletas + totalFacturas)}
          </span>
        </div>
      )}

      {/* Modales */}
      {detailId && (
        <DetailModal
          docId={detailId}
          onClose={() => setDetailId(null)}
          onRefresh={() => fetchDocs(page)}
        />
      )}
      {printDoc && (
        <PrintShareModal
          doc={printDoc}
          onClose={() => setPrintDoc(null)}
        />
      )}
    </div>
  );
}
