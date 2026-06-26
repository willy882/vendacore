import { useState, useEffect, useRef } from 'react';
import {
  Search, ChevronDown, Eye, Download, Send,
  ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, Clock, XCircle, FileText,
  FileMinus, Printer, X, MessageCircle, RefreshCw, Trash2,
} from 'lucide-react';
import api from '@/lib/api';

// ── Utilidades ────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtMoney = (v: number | string) =>
  `S/.${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
};
const fmtDateShort = (d: string | Date) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PaperSize = '80mm' | '58mm' | 'A5' | 'A4';
type ShareStep = 'main' | 'whatsapp' | 'correo';

interface NcDoc {
  id: string;
  tipo: string;
  serie: string;
  correlativo: number;
  numeroCompleto: string;
  estado: string;
  fechaEmision: string;
  total: number | string;
  subtotal: number | string;
  igv: number | string;
  xmlUrl?: string;
  pdfUrl?: string;
  respuestaSunat?: string;
  hashCpe?: string;
  errorDescripcion?: string;
  customer?: {
    id: string;
    nombreCompleto: string;
    numeroDocumento: string;
    telefono?: string;
    email?: string;
    tipoDocumento?: string;
  } | null;
  sale?: {
    id: string;
    items?: { cantidad: number; precioUnitario: number; product?: { nombre: string; codigoInterno?: string } }[];
    payments?: { monto: number; paymentMethod?: { nombre: string } }[];
  } | null;
}

// ── Config de estados ─────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700'     },
  enviado:   { label: 'Enviado',   color: 'bg-blue-100 text-blue-700'       },
  aceptado:  { label: 'Aceptado',  color: 'bg-emerald-100 text-emerald-700' },
  observado: { label: 'Observado', color: 'bg-orange-100 text-orange-700'   },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700'         },
  anulado:   { label: 'Anulado',   color: 'bg-slate-100 text-slate-500'     },
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  pendiente: <Clock size={11} />,
  enviado:   <FileText size={11} />,
  aceptado:  <CheckCircle size={11} />,
  observado: <AlertCircle size={11} />,
  rechazado: <XCircle size={11} />,
  anulado:   <XCircle size={11} />,
};

// ── Modal Detalle ─────────────────────────────────────────────────────────────

function DetailModal({ docId, onClose, onRefresh }: { docId: string; onClose: () => void; onRefresh: () => void }) {
  const [doc, setDoc]                 = useState<NcDoc | null>(null);
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [annulling, setAnnulling]     = useState(false);
  const [confirmAnular, setConfirmAnular] = useState(false);
  const [sendResult, setSendResult]   = useState<{ ok?: boolean; msg?: string } | null>(null);

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

  // Extraer doc original desde metadatos (PENDING|original:BC01-00000001|tipNota:01|motivo:...)
  const originalNumero = doc?.respuestaSunat?.match(/original:([^|]+)/)?.[1]?.trim() ?? null;
  const tipNotaCode    = doc?.respuestaSunat?.match(/tipNota:([^|]+)/)?.[1]?.trim() ?? null;
  const motivoMeta     = doc?.respuestaSunat?.match(/motivo:([^|]+)/)?.[1]?.trim() ?? null;

  const handleReenviar = async () => {
    if (!doc) return;
    setSending(true); setSendResult(null);
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
          `Hola! Le compartimos su nota de crédito:\n\n` +
          `${doc.numeroCompleto}\n` +
          `Total: ${total}\n\n` +
          `Descargue aquí:\n${pdfUrl}`
        )
      : encodeURIComponent(
          `Hola! Le informamos que se emitió una nota de crédito:\n\n` +
          `${doc.numeroCompleto}\n` +
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
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-purple-100 text-purple-700">
                <FileMinus size={11} />
                {doc?.tipo === 'nota_credito' ? 'N. Crédito' : 'N. Débito'}
              </span>
              <p className="font-bold text-slate-800">{doc?.numeroCompleto ?? '...'}</p>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{doc ? fmtDateShort(doc.fechaEmision) : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Cargando...</div>
        ) : !doc ? (
          <div className="flex items-center justify-center py-16 text-red-500 text-sm">Error al cargar el documento</div>
        ) : (
          <div className="p-5 space-y-4 text-sm">

            {/* Info general */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4">
              <div>
                <p className="text-xs text-slate-500">Número</p>
                <p className="font-bold text-slate-800 font-mono">{doc.numeroCompleto}</p>
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

            {/* Doc original (desde metadatos) */}
            {(originalNumero || tipNotaCode || motivoMeta) && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-purple-700">Comprobante original</p>
                {originalNumero && (
                  <p className="text-xs text-purple-700 font-mono font-semibold">{originalNumero}</p>
                )}
                {tipNotaCode && (
                  <p className="text-xs text-purple-600">Tipo nota: <span className="font-semibold">{tipNotaCode}</span></p>
                )}
                {motivoMeta && (
                  <p className="text-xs text-purple-600">Motivo: {motivoMeta}</p>
                )}
              </div>
            )}

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
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-600 mb-1">Total NC</p>
                <p className="font-bold text-purple-700">-{fmtMoney(doc.total)}</p>
              </div>
            </div>

            {/* Items */}
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
                          <td className="px-3 py-2 text-slate-700">{item.product?.nombre ?? '—'}</td>
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

            {/* Respuesta SUNAT */}
            {doc.estado === 'aceptado' && doc.hashCpe && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-emerald-700">Aceptado por SUNAT</p>
                <p className="text-xs text-slate-500 font-mono break-all">Hash: {doc.hashCpe}</p>
              </div>
            )}
            {doc.estado === 'rechazado' && doc.errorDescripcion && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Error SUNAT</p>
                <p className="text-xs text-red-600">{doc.errorDescripcion}</p>
              </div>
            )}

            {/* Resultado de reenvío */}
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
                    <Trash2 size={13} /> Anular nota de crédito
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

              {doc.estado === 'anulado' && (
                <div className="bg-slate-100 rounded-xl p-3 text-center text-xs text-slate-500">
                  Esta nota de crédito está anulada
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

function PrintShareModal({ doc, onClose }: { doc: NcDoc; onClose: () => void }) {
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

  const execPrint = (sz: PaperSize) => {
    const dims: Record<PaperSize, { w: string; h: string }> = {
      '80mm': { w: '80mm',  h: 'auto' },
      '58mm': { w: '58mm',  h: 'auto' },
      'A5':   { w: '148mm', h: '210mm' },
      'A4':   { w: '210mm', h: '297mm' },
    };
    const { w, h } = dims[sz];
    const html = `
      <html><head><style>
        @page { size: ${w} ${h}; margin: 0; }
        body { font-family: monospace; font-size: 11px; padding: 8px; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        .nc { text-align: center; background: #f3e8ff; padding: 3px; border-radius: 3px; }
      </style></head><body>
        <div class="center bold">${doc.numeroCompleto}</div>
        <div class="nc">NOTA DE CRÉDITO ELECTRÓNICA</div>
        <div class="center">${fechaStr}</div>
        <div class="line"></div>
        <div>${clienteLabel}</div>
        <div class="line"></div>
        <div class="row bold"><span>TOTAL NC:</span><span>-${fmtMoney(doc.total)}</span></div>
        <div class="line"></div>
        <div class="center">Estado: ${doc.estado.toUpperCase()}</div>
      </body></html>`;
    const w2 = window.open('', '_blank', `width=400,height=500`);
    if (!w2) return;
    w2.document.write(html);
    w2.document.close();
    w2.focus();
    w2.print();
  };

  const handleShare = () => {
    if (pdfUrl && navigator.share) {
      navigator.share({ title: doc.numeroCompleto, url: pdfUrl }).catch(() => {});
    } else if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleWhatsapp = () => {
    const num = phone ? `51${phone}` : '';
    const msg = encodeURIComponent(
      pdfUrl
        ? `Hola! Le compartimos su nota de crédito ${doc.numeroCompleto}\nTotal: -${fmtMoney(doc.total)}\nDescargue aquí: ${pdfUrl}`
        : `Hola! Se emitió nota de crédito ${doc.numeroCompleto}\nTotal: -${fmtMoney(doc.total)}`
    );
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const handleCorreo = () => {
    const sub = encodeURIComponent(`Nota de Crédito ${doc.numeroCompleto}`);
    const body = encodeURIComponent(
      pdfUrl
        ? `Estimado cliente,\n\nLe adjuntamos la nota de crédito ${doc.numeroCompleto}.\nTotal: -${fmtMoney(doc.total)}\nDescargue aquí: ${pdfUrl}\n\nGracias.`
        : `Estimado cliente,\n\nLe informamos que se emitió la nota de crédito ${doc.numeroCompleto}.\nTotal: -${fmtMoney(doc.total)}\n\nGracias.`
    );
    window.open(`mailto:${email}?subject=${sub}&body=${body}`);
  };

  const SIZES: PaperSize[] = ['A4', 'A5', '80mm', '58mm'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>

        {/* Dark bar — siempre visible */}
        <div className="bg-slate-900 rounded-t-2xl sm:rounded-t-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileMinus size={15} className="text-purple-400 flex-shrink-0" />
            <span className="text-white text-xs font-semibold truncate">{doc.numeroCompleto}</span>
          </div>
          {/* Selector de tamaño siempre visible */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  size === s ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          {step === 'main' && (
            <>
              <p className="text-xs text-slate-500 mb-3">{clienteLabel}</p>
              <div className="grid grid-cols-2 gap-3">
                {/* IMPRIMIR */}
                <button
                  onClick={() => execPrint(size)}
                  className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-slate-800 text-white hover:bg-slate-700 active:scale-[0.98] transition-all"
                >
                  <Printer size={22} />
                  <span className="text-xs font-semibold">IMPRIMIR</span>
                  <span className="text-[10px] text-slate-400">{size}</span>
                </button>

                {/* COMPARTIR */}
                <button
                  onClick={handleShare}
                  className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all"
                >
                  <Send size={22} />
                  <span className="text-xs font-semibold">COMPARTIR</span>
                  <span className="text-[10px] text-blue-200">PDF / Link</span>
                </button>

                {/* WHATSAPP */}
                <button
                  onClick={() => setStep('whatsapp')}
                  className="flex flex-col items-center gap-2 py-5 rounded-2xl text-white hover:opacity-90 active:scale-[0.98] transition-all"
                  style={{ background: '#25D366' }}
                >
                  <MessageCircle size={22} />
                  <span className="text-xs font-semibold">WHATSAPP</span>
                  <span className="text-[10px] text-green-100">Enviar NC</span>
                </button>

                {/* CORREO */}
                <button
                  onClick={() => setStep('correo')}
                  className="flex flex-col items-center gap-2 py-5 rounded-2xl bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.98] transition-all"
                >
                  <FileText size={22} />
                  <span className="text-xs font-semibold">CORREO</span>
                  <span className="text-[10px] text-violet-200">Enviar por email</span>
                </button>
              </div>
            </>
          )}

          {step === 'whatsapp' && (
            <div className="space-y-3">
              <button onClick={() => setStep('main')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                ← Volver
              </button>
              <p className="text-sm font-semibold text-slate-800">Enviar por WhatsApp</p>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Número (ej. 987654321)"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-400"
              />
              <button
                onClick={handleWhatsapp}
                disabled={!phone}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                style={{ background: '#25D366' }}
              >
                Abrir WhatsApp
              </button>
            </div>
          )}

          {step === 'correo' && (
            <div className="space-y-3">
              <button onClick={() => setStep('main')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
                ← Volver
              </button>
              <p className="text-sm font-semibold text-slate-800">Enviar por correo</p>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="correo@ejemplo.com"
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400"
              />
              <button
                onClick={handleCorreo}
                disabled={!email}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                Abrir cliente de correo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Row Actions ───────────────────────────────────────────────────────────────

function RowActions({ onDetail, onPrint }: { onDetail: () => void; onPrint: () => void }) {
  return (
    <div className="flex justify-center items-center gap-1">
      <button
        onClick={onDetail}
        title="Ver detalle"
        className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
      >
        <Eye size={14} />
      </button>
      <button
        onClick={onPrint}
        title="Imprimir / Compartir"
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <Printer size={14} />
      </button>
    </div>
  );
}

// ── Opciones dropdown ─────────────────────────────────────────────────────────

function OpcionesDropdown({ docs }: { docs: NcDoc[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
      >
        OPCIONES <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-44 py-1">
          <button
            onClick={() => {
              setOpen(false);
              docs.filter((d) => d.xmlUrl).slice(0, 10).forEach((d) => window.open(d.xmlUrl!, '_blank'));
            }}
            className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <Download size={14} className="text-slate-400" /> Masivo XML
          </button>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SunatNotaCreditoPage() {
  const [desde, setDesde]   = useState(todayStr());
  const [hasta, setHasta]   = useState(todayStr());
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const limit = 25;

  const [docs, setDocs]             = useState<NcDoc[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [detailDocId, setDetailDocId]   = useState<string | null>(null);
  const [printDoc, setPrintDoc]         = useState<NcDoc | null>(null);

  const fetchDocs = async (p = page) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page: p, limit };
      if (desde)  params.from   = desde;
      if (hasta)  params.to     = hasta;
      if (search) params.search = search;
      const { data } = await api.get('/documents', { params });
      const all: NcDoc[] = data.data ?? data ?? [];
      const filtered = all.filter((d) => d.tipo === 'nota_credito' || d.tipo === 'nota_debito');
      setDocs(filtered);
      setTotal(filtered.length);
      setTotalPages(Math.ceil(filtered.length / limit) || 1);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al cargar notas de crédito');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDocs(1); setPage(1); }, [desde, hasta, search]);
  useEffect(() => { fetchDocs(page); }, [page]);

  const totalMonto = docs.reduce((a, d) => a + Number(d.total), 0);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
          <FileMinus size={18} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800">Notas de Crédito / Débito</h1>
          <p className="text-xs text-slate-500">Documentos que corrigen o anulan comprobantes electrónicos emitidos ante SUNAT.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Inicio</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400 bg-white text-slate-700" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Fin</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400 bg-white text-slate-700" />
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Buscar</span>
          <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-white">
            <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">NC</span>
            <input className="flex-1 text-sm outline-none placeholder:text-slate-400"
              placeholder="Número de nota..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Search size={14} className="text-slate-400 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Totales + OPCIONES */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-sm font-semibold text-slate-500">Notas emitidas:</span>
          <span className="text-sm font-bold text-purple-700">-{fmtMoney(totalMonto)}</span>
          <span className="text-xs text-slate-400">({total} doc.)</span>
        </div>
        <div className="ml-auto"><OpcionesDropdown docs={docs} /></div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 text-sm">{error}</div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center">
              <FileMinus size={26} className="text-purple-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">Sin notas de crédito en este período</p>
            <p className="text-xs">Las notas se generan al corregir o anular una boleta/factura.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-purple-50/40">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">N° Nota</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Estado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Monto</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {docs.map((doc) => {
                    const st = STATUS_CFG[doc.estado] ?? { label: doc.estado, color: 'bg-slate-100 text-slate-600' };
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-mono font-semibold text-slate-800 text-xs">{doc.numeroCompleto}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ${
                            doc.tipo === 'nota_credito'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {doc.tipo === 'nota_credito' ? 'N. Crédito' : 'N. Débito'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium text-slate-800">{doc.customer?.nombreCompleto ?? 'Clientes Varios'}</div>
                          {doc.customer?.numeroDocumento && (
                            <div className="text-[10px] text-slate-400 font-mono">{doc.customer.numeroDocumento}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{fmtDateShort(doc.fechaEmision)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${st.color}`}>
                            {STATUS_ICON[doc.estado]} {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-purple-700 text-xs whitespace-nowrap">
                          -{fmtMoney(doc.total)}
                        </td>
                        <td className="px-4 py-3">
                          <RowActions
                            onDetail={() => setDetailDocId(doc.id)}
                            onPrint={() => setPrintDoc(doc)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modales */}
      {detailDocId && (
        <DetailModal
          docId={detailDocId}
          onClose={() => setDetailDocId(null)}
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
