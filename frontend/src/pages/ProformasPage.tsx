import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MoreVertical, Send, Eye, Printer, Pencil, Trash2,
  X, FileText, AlertTriangle,
} from 'lucide-react';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProformaItem {
  id:             string;
  descripcion:    string | null;
  cantidad:       number;
  precioUnitario: number;
  igvMonto:       number;
  subtotal:       number;
  total:          number;
  product?:       { nombre: string; codigoInterno: string | null } | null;
}

interface Proforma {
  id:           string;
  numero:       string;
  fecha:        string;
  total:        number;
  estado:       'pendiente' | 'emitida' | 'cancelada';
  observaciones?: string | null;
  customer?:    { nombreCompleto: string; numeroDocumento: string | null } | null;
  items?:       ProformaItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  `S/ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });

// ── Modal: Emitir ─────────────────────────────────────────────────────────────

function EmitirModal({ proforma, onClose }: { proforma: Proforma; onClose: () => void }) {
  const openPdf = (tipo: 'factura' | 'guia') => {
    window.open(
      `${api.defaults.baseURL}/proformas/${proforma.id}/pdf?format=a4&tipo=${tipo}`,
      '_blank',
    );
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900">
          <span className="text-sm font-semibold text-white">Emitir Proforma {proforma.numero}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[
            { label: 'FACTURA / BOLETA', tipo: 'factura' as const },
            { label: 'GUIA REM',         tipo: 'guia'    as const },
          ].map(({ label, tipo }) => (
            <button
              key={tipo}
              onClick={() => openPdf(tipo)}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-slate-100
                hover:border-rose-200 hover:bg-rose-50 active:scale-95 transition-all group"
            >
              <div className="relative">
                <FileText size={40} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
                <span className="absolute -bottom-1 -right-1 text-[8px] font-black text-white bg-rose-500 px-1 rounded">PDF</span>
              </div>
              <span className="text-xs font-bold text-slate-700 text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal: Visualizar ─────────────────────────────────────────────────────────

function VisualizarModal({ proforma, onClose }: { proforma: Proforma; onClose: () => void }) {
  const [detail, setDetail] = useState<Proforma | null>(null);

  useEffect(() => {
    api.get<Proforma>(`/proformas/${proforma.id}`).then(r => setDetail(r.data));
  }, [proforma.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700">
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={16} /></button>
        </div>

        {!detail ? (
          <div className="p-8 text-center text-zinc-400 text-sm">Cargando...</div>
        ) : (
          <div className="p-5">
            {detail.observaciones && (
              <p className="text-sm font-bold text-zinc-200 mb-3">OBSERVACION: {detail.observaciones}</p>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-800">
                  <th className="text-left px-3 py-2 text-zinc-300 font-semibold">Descripcion</th>
                  <th className="text-right px-3 py-2 text-blue-400 font-semibold">Und.</th>
                  <th className="text-right px-3 py-2 text-amber-400 font-semibold">Precio</th>
                  <th className="text-right px-3 py-2 text-zinc-200 font-semibold">Tot.</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items ?? []).map((item, i) => (
                  <tr key={i} className="border-t border-zinc-800">
                    <td className="px-3 py-2.5 text-zinc-200">{item.descripcion || item.product?.nombre || '—'}</td>
                    <td className="px-3 py-2.5 text-zinc-300 text-right">{Number(item.cantidad)}</td>
                    <td className="px-3 py-2.5 text-zinc-300 text-right">S/.{Number(item.precioUnitario).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-zinc-200 font-semibold text-right">S/.{Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end gap-6 text-sm pr-3">
              <span className="text-zinc-400">Subtotal: <strong className="text-zinc-200">{fmt(Number(detail.total))}</strong></span>
              <span className="text-zinc-400">Total: <strong className="text-emerald-400 text-base">{fmt(Number(detail.total))}</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal: Imprimir ───────────────────────────────────────────────────────────

function ImprimirModal({ proforma, onClose }: { proforma: Proforma; onClose: () => void }) {
  const openPdf = (format: 'a4' | '80mm' | '58mm') => {
    window.open(`${api.defaults.baseURL}/proformas/${proforma.id}/pdf?format=${format}`, '_blank');
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900">
          <span className="text-sm font-semibold text-white">Imprimir — {proforma.numero}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-6 grid grid-cols-3 gap-3">
          {(['a4', '80mm', '58mm'] as const).map((f) => (
            <button
              key={f}
              onClick={() => openPdf(f)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-100
                hover:border-blue-200 hover:bg-blue-50 active:scale-95 transition-all group"
            >
              <Printer size={28} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
              <span className="text-[11px] font-bold text-slate-700 uppercase">{f === 'a4' ? 'PDF A4' : `PDF ${f}`}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal: Confirmar ──────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, confirmClass, onConfirm, onClose,
}: {
  title: string; message: string; confirmLabel: string;
  confirmClass: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2 text-sm rounded-xl font-semibold text-white transition-colors ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Action Menu ───────────────────────────────────────────────────────────────

function ActionMenu({ onAction }: {
  onAction: (action: 'emitir' | 'visualizar' | 'imprimir' | 'editar' | 'borrar') => void;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    { key: 'emitir',     Icon: Send,     label: 'Emitir',     color: 'text-blue-600' },
    { key: 'visualizar', Icon: Eye,      label: 'Visualizar', color: 'text-emerald-600' },
    { key: 'imprimir',   Icon: Printer,  label: 'Imprime',    color: 'text-orange-500' },
    { key: 'editar',     Icon: Pencil,   label: 'Editar',     color: 'text-amber-500' },
    { key: 'borrar',     Icon: Trash2,   label: 'Borrar',     color: 'text-red-500' },
  ] as const;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 bg-white rounded-xl border border-slate-100 shadow-xl py-1 w-44 overflow-hidden">
            <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accion</p>
            {items.map(({ key, Icon, label, color }) => (
              <button
                key={key}
                onClick={() => { setOpen(false); onAction(key); }}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Icon size={15} className={color} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProformasPage() {
  const navigate = useNavigate();
  const today    = new Date().toISOString().split('T')[0];
  const firstDay = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const [from, setFrom]             = useState(firstDay);
  const [to,   setTo]               = useState(today);
  const [data, setData]             = useState<Proforma[]>([]);
  const [loading, setLoading]       = useState(true);

  const [emitir,     setEmitir]     = useState<Proforma | null>(null);
  const [visualizar, setVisualizar] = useState<Proforma | null>(null);
  const [imprimir,   setImprimir]   = useState<Proforma | null>(null);
  const [editarConf, setEditarConf] = useState<Proforma | null>(null);
  const [borrar,     setBorrar]     = useState<Proforma | null>(null);
  const [delLoading, setDelLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<Proforma[]>('/proformas', { params: { from, to } })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const handleAction = (proforma: Proforma, action: 'emitir' | 'visualizar' | 'imprimir' | 'editar' | 'borrar') => {
    if (action === 'emitir')     setEmitir(proforma);
    if (action === 'visualizar') setVisualizar(proforma);
    if (action === 'imprimir')   setImprimir(proforma);
    if (action === 'editar')     setEditarConf(proforma);
    if (action === 'borrar')     setBorrar(proforma);
  };

  const confirmDelete = async () => {
    if (!borrar) return;
    setDelLoading(true);
    await api.delete(`/proformas/${borrar.id}`);
    setDelLoading(false);
    setBorrar(null);
    load();
  };

  const confirmEdit = () => {
    if (!editarConf) return;
    setEditarConf(null);
    navigate(`/proformas/${editarConf.id}/editar`);
  };

  return (
    <div className="min-h-full bg-white p-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">PROFORMAS</h1>
        <button
          onClick={() => navigate('/proformas/nueva')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white
            bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all shadow-sm"
        >
          <Plus size={16} />
          NUEVO
        </button>
      </div>

      {/* ── Filtros fecha ── */}
      <div className="flex items-end gap-4 mb-5">
        <div className="relative">
          <label className="absolute -top-2 left-3 text-[10px] font-bold text-slate-500 bg-white px-1 uppercase tracking-wider">INICIO</label>
          <input
            type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="relative">
          <label className="absolute -top-2 left-3 text-[10px] font-bold text-slate-500 bg-white px-1 uppercase tracking-wider">FIN</label>
          <input
            type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Id</th>
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha Emision</th>
              <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
              <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
              <th className="text-center px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm">Cargando...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-sm">Sin proformas en este período</td></tr>
            ) : (
              data.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-slate-700 font-semibold">{p.numero}</td>
                  <td className="px-5 py-3.5 text-slate-600">{fmtDate(p.fecha)}</td>
                  <td className="px-5 py-3.5 text-slate-700">
                    {p.customer
                      ? `${p.customer.numeroDocumento ?? ''} - ${p.customer.nombreCompleto}`.toUpperCase()
                      : <span className="text-slate-400">Sin cliente</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-800">{fmt(Number(p.total))}</td>
                  <td className="px-5 py-3.5 flex justify-center">
                    <ActionMenu onAction={(action) => handleAction(p, action)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modals ── */}
      {emitir     && <EmitirModal     proforma={emitir}     onClose={() => setEmitir(null)}     />}
      {visualizar && <VisualizarModal proforma={visualizar} onClose={() => setVisualizar(null)} />}
      {imprimir   && <ImprimirModal   proforma={imprimir}   onClose={() => setImprimir(null)}   />}

      {editarConf && (
        <ConfirmModal
          title="¿Editar proforma?"
          message={`¿Deseas editar la proforma ${editarConf.numero}? Se abrirá el formulario de edición.`}
          confirmLabel="Sí, editar"
          confirmClass="bg-amber-500 hover:bg-amber-600"
          onConfirm={confirmEdit}
          onClose={() => setEditarConf(null)}
        />
      )}
      {borrar && (
        <ConfirmModal
          title="¿Eliminar proforma?"
          message={`¿Estás seguro de que deseas eliminar la proforma ${borrar.numero}? Esta acción no se puede deshacer.`}
          confirmLabel={delLoading ? 'Eliminando...' : 'Sí, eliminar'}
          confirmClass="bg-red-500 hover:bg-red-600"
          onConfirm={confirmDelete}
          onClose={() => setBorrar(null)}
        />
      )}
    </div>
  );
}
