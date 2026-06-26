import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, ChevronLeft, Plus, Trash2, BookOpen, FileText, X, Eye, ToggleLeft, ToggleRight, Square, CheckCircle, AlertCircle } from 'lucide-react';
import { productsService } from '@/services/products.service';
import { salesService } from '@/services/sales.service';
import { businessService } from '@/services/business.service';
import { customersService } from '@/services/customers.service';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import type { ProductCategory } from '@/types';

// ── Persistencia del carrito ──────────────────────────────────────────────────
const CART_KEY_PREFIX = 'pos_cart_';

interface OrderItem { id: string; productId?: string; descripcion: string; precio: number; cantidad: number; descuento?: number; stock?: number; }

function loadCart(key: string): OrderItem[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}
function saveCart(key: string, items: OrderItem[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

// ── Modal Editar Ítem del Carrito ─────────────────────────────────────────────

function EditItemModal({ item, onSave, onDelete, onClose }: {
  item: OrderItem;
  onSave: (updated: OrderItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [cantidad,    setCantidad]    = useState(String(item.cantidad));
  const [descripcion, setDescripcion] = useState(item.descripcion);
  const [precio,      setPrecio]      = useState(String(item.precio));
  const [descAbs,     setDescAbs]     = useState(String(item.descuento ?? 0));
  const [descPct,     setDescPct]     = useState(
    item.descuento ? ((item.descuento / (item.precio * item.cantidad)) * 100).toFixed(2) : '0'
  );

  const cant  = Math.max(1, parseFloat(cantidad) || 1);
  const prec  = parseFloat(precio)  || 0;
  const dAbs  = parseFloat(descAbs) || 0;
  const subtotal = Math.max(0, prec * cant - dAbs);

  const handleDescAbsChange = (v: string) => {
    setDescAbs(v);
    const abs = parseFloat(v) || 0;
    const base = prec * cant;
    setDescPct(base > 0 ? ((abs / base) * 100).toFixed(2) : '0');
  };

  const handleDescPctChange = (v: string) => {
    setDescPct(v);
    const pct = parseFloat(v) || 0;
    setDescAbs(((prec * cant * pct) / 100).toFixed(2));
  };

  const handleCantChange = (v: number) => {
    const newCant = Math.max(1, v);
    setCantidad(String(newCant));
    const pct = parseFloat(descPct) || 0;
    setDescAbs(((prec * newCant * pct) / 100).toFixed(2));
  };

  const handleGrabar = () => {
    onSave({
      ...item,
      cantidad:    cant,
      descripcion: descripcion.trim() || item.descripcion,
      precio:      prec,
      descuento:   dAbs,
    });
    onClose();
  };

  const handleEliminar = () => {
    onDelete(item.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900">
          <button onClick={onClose} className="text-red-400 hover:text-red-300 transition-colors">
            <X size={20} strokeWidth={2.5} />
          </button>
          <span className="text-white font-bold text-sm tracking-wide">Editar Ítem</span>
          <div className="w-5" />
        </div>

        <div className="p-5 space-y-4">

          {/* Cantidad */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cantidad</span>
            <div className="flex items-center gap-3">
              <button onClick={() => handleCantChange(cant - 1)}
                className="w-9 h-9 rounded-full bg-red-50 text-red-500 hover:bg-red-100 text-lg font-bold flex items-center justify-center transition-colors">
                −
              </button>
              <input
                type="number" min="1" value={cantidad}
                onChange={(e) => handleCantChange(parseFloat(e.target.value) || 1)}
                className="w-16 text-center text-xl font-bold text-slate-800 border-b-2 border-slate-300 focus:border-blue-500 outline-none bg-transparent"
              />
              <button onClick={() => handleCantChange(cant + 1)}
                className="w-9 h-9 rounded-full bg-green-50 text-green-600 hover:bg-green-100 text-lg font-bold flex items-center justify-center transition-colors">
                +
              </button>
            </div>
          </div>

          {/* Descripción */}
          <div className="relative border border-slate-300 rounded-lg px-3 pt-4 pb-2 focus-within:border-blue-500 transition-colors">
            <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-semibold text-slate-500">Descripción</span>
            <input
              type="text" value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full outline-none text-sm text-slate-800 bg-transparent"
            />
          </div>

          {/* Precio */}
          <div className="relative border border-slate-300 rounded-lg px-3 pt-4 pb-2 focus-within:border-blue-500 transition-colors">
            <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-semibold text-slate-500">Precio unitario (S/)</span>
            <input
              type="number" min="0" step="0.01" value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              className="w-full outline-none text-sm text-slate-800 bg-transparent"
            />
          </div>

          {/* Descuento row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative border border-slate-300 rounded-lg px-3 pt-4 pb-2 focus-within:border-orange-400 transition-colors">
              <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-semibold text-slate-500">Descuento (S/)</span>
              <input
                type="number" min="0" step="0.01" value={descAbs}
                onChange={(e) => handleDescAbsChange(e.target.value)}
                className="w-full outline-none text-sm text-slate-800 bg-transparent"
              />
            </div>
            <div className="relative border border-slate-300 rounded-lg px-3 pt-4 pb-2 focus-within:border-orange-400 transition-colors">
              <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-semibold text-slate-500">Descuento (%)</span>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="100" step="0.01" value={descPct}
                  onChange={(e) => handleDescPctChange(e.target.value)}
                  className="flex-1 outline-none text-sm text-slate-800 bg-transparent"
                />
                <span className="text-sm text-slate-400">%</span>
              </div>
            </div>
          </div>

          {/* Ahorro */}
          {dAbs > 0 && (
            <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
              <span className="text-xs font-semibold text-orange-600">Descuento aplicado</span>
              <span className="text-sm font-bold text-orange-600">− S/{dAbs.toFixed(2)}</span>
            </div>
          )}

          {/* Total línea */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <span className="text-sm font-semibold text-slate-600">Total línea</span>
            <span className="text-xl font-bold text-slate-900">S/{subtotal.toFixed(2)}</span>
          </div>

        </div>

        {/* Botones */}
        <div className="grid grid-cols-2 border-t border-slate-200">
          <button onClick={handleEliminar}
            className="py-4 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors">
            ELIMINAR
          </button>
          <button onClick={handleGrabar}
            className="py-4 text-green-600 font-bold text-sm hover:bg-green-50 transition-colors border-l border-slate-200">
            GUARDAR
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Modal Agregar Catálogo ────────────────────────────────────────────────────

function AddItemModal({ onAdd, onClose }: {
  onAdd: (item: Omit<OrderItem, 'id'>) => void;
  onClose: () => void;
}) {
  const [cantidad,    setCantidad]    = useState('');
  const [precio,      setPrecio]      = useState('');
  const [descripcion, setDescripcion] = useState('');
  const cantidadRef = useRef<HTMLInputElement>(null);

  useEffect(() => { cantidadRef.current?.focus(); }, []);

  const handleAgregar = () => {
    const cant = parseFloat(cantidad);
    const prec = parseFloat(precio);
    if (!descripcion.trim() || isNaN(cant) || cant <= 0 || isNaN(prec) || prec < 0) return;
    onAdd({ descripcion: descripcion.trim().toUpperCase(), precio: prec, cantidad: cant });
    onClose();
  };

  const labelClass = "absolute -top-2 left-3 bg-white px-1 text-[10px] font-medium text-slate-500";
  const inputClass  = "w-full outline-none text-sm text-slate-800 bg-transparent";
  const fieldBox    = "relative border border-slate-400 rounded px-3 pt-4 pb-2";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
          <button onClick={onClose} className="text-red-500 hover:text-red-400 transition-colors">
            <X size={20} strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Square size={16} className="text-white" />
            Agregar Item Libre
          </div>
          <div className="w-5" />
        </div>

        {/* Campos */}
        <div className="p-4 space-y-3">

          {/* Fila: Cantidad + Precio */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`${fieldBox} border-blue-500 border-2`}>
              <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-medium text-blue-500">Cantidad</span>
              <input
                ref={cantidadRef}
                type="number" min="0.01" step="1"
                value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className={fieldBox}>
              <span className={labelClass}>Precio</span>
              <input
                type="number" min="0" step="0.01"
                value={precio} onChange={(e) => setPrecio(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Descripcion */}
          <div className="relative">
            <input
              value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripcion del ítem"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAgregar(); }}
              className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm bg-slate-100 outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder-slate-400"
            />
          </div>

          {/* Botón AGREGAR */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleAgregar}
              className="text-green-600 hover:text-green-700 font-bold text-sm tracking-wide transition-colors">
              AGREGAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Busca Proforma ──────────────────────────────────────────────────────

interface ProformaRow { id: string; numero: string; cliente: string; fecha: string; total: number; }

function ProformaModal({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (items: OrderItem[]) => void;
}) {
  const todayISO = new Date().toISOString().split('T')[0];
  const [emision, setEmision]   = useState(todayISO);
  const [ruc, setRuc]           = useState('');
  const [rows, setRows]         = useState<ProformaRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const fetchProformas = useCallback(async (params: Record<string, string>) => {
    setLoading(true);
    try {
      const { data } = await api.get('/proformas', { params });
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setRows(list.map((p: any) => ({
        id:      p.id,
        numero:  p.numero ?? p.id.slice(0, 8),
        cliente: p.customer?.nombreCompleto ?? 'Clientes Varios',
        fecha:   p.fecha ? new Date(p.fecha).toLocaleDateString('es-PE') : '—',
        total:   Number(p.total ?? 0),
      })));
    } catch { setRows([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProformas({ from: emision }); }, []);

  const handleSelectRow = async (row: ProformaRow) => {
    setLoadingId(row.id);
    try {
      const { data } = await api.get(`/proformas/${row.id}`);
      const cartItems: OrderItem[] = (data.items ?? []).map((it: any) => ({
        id:          crypto.randomUUID(),
        productId:   it.productId ?? undefined,
        descripcion: it.product?.nombre ?? it.descripcion ?? 'Producto',
        precio:      Number(it.precioUnitario ?? 0),
        cantidad:    Number(it.cantidad ?? 1),
        descuento:   0,
      }));
      onSelect(cartItems);
    } catch { /* silent */ } finally { setLoadingId(null); }
  };

  const fmtMoney = (v: number) => `S/ ${v.toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>

        <div className="bg-black px-4 py-3 flex-shrink-0">
          <button onClick={onClose} className="text-white hover:text-slate-300 transition-colors">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="text-center py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-900 tracking-wide">BUSCA PROFORMA</h2>
        </div>

        <div className="px-6 pt-5 pb-3 space-y-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 border border-slate-400 rounded px-3 pt-4 pb-2">
              <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-medium text-slate-500">Emision</span>
              <input type="date" value={emision} onChange={(e) => setEmision(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchProformas({ from: emision })}
                className="w-full outline-none text-sm text-slate-800 bg-transparent" />
            </div>
            <button onClick={() => fetchProformas({ from: emision })}
              className="text-green-600 hover:text-green-700 transition-colors flex-shrink-0">
              <Search size={28} strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 border-2 border-blue-500 rounded px-3 pt-4 pb-2">
              <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-medium text-blue-500">RUC / Cliente</span>
              <input type="text" value={ruc} onChange={(e) => setRuc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchProformas({ search: ruc })}
                className="w-full outline-none text-sm text-slate-800 bg-transparent" autoFocus />
            </div>
            <button onClick={() => fetchProformas({ search: ruc })}
              className="text-green-600 hover:text-green-700 transition-colors flex-shrink-0">
              <Search size={28} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid border-b border-slate-300 pb-2 mb-1" style={{ gridTemplateColumns: '100px 1fr 110px 90px' }}>
            <span className="text-xs font-semibold text-slate-600 uppercase">Número</span>
            <span className="text-xs font-semibold text-slate-600 uppercase">Cliente</span>
            <span className="text-xs font-semibold text-slate-600 uppercase">Fecha</span>
            <span className="text-xs font-semibold text-slate-600 uppercase text-right">Total</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-slate-400 text-sm">Cargando...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-slate-400 text-sm">Sin resultados</p>
            </div>
          ) : rows.map((row) => (
            <div
              key={row.id}
              onClick={() => loadingId === null && handleSelectRow(row)}
              className={`grid py-2.5 border-b border-slate-100 transition-colors ${
                loadingId === row.id
                  ? 'bg-blue-50 cursor-wait'
                  : 'hover:bg-slate-50 cursor-pointer'
              }`}
              style={{ gridTemplateColumns: '100px 1fr 110px 90px' }}
            >
              <span className="text-sm font-mono text-slate-700">{row.numero}</span>
              <span className="text-sm text-slate-700 truncate pr-2">{row.cliente}</span>
              <span className="text-sm text-slate-500">{row.fecha}</span>
              <span className="text-sm font-semibold text-slate-800 text-right">{fmtMoney(row.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal de Cobro ────────────────────────────────────────────────────────────

// ── Números a palabras (español, soles) ──────────────────────────────────────

function numToWords(n: number): string {
  const unidades = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
    'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
  const decenas  = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const centenas = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  if (n === 0) return 'CERO';
  if (n === 100) return 'CIEN';
  if (n >= 1000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const milStr = miles === 1 ? 'MIL' : `${numToWords(miles)} MIL`;
    return resto > 0 ? `${milStr} ${numToWords(resto)}` : milStr;
  }
  if (n >= 100) return `${centenas[Math.floor(n/100)]}${n%100 > 0 ? ' ' + numToWords(n%100) : ''}`;
  if (n >= 20) {
    const d = Math.floor(n/10), u = n%10;
    return u > 0 ? `${decenas[d]} Y ${unidades[u]}` : decenas[d];
  }
  return unidades[n];
}

function solesEnLetras(monto: number): string {
  const entero = Math.floor(monto);
  const cents  = Math.round((monto - entero) * 100);
  const palabras = numToWords(entero);
  return `Son: ${palabras} CON ${String(cents).padStart(2,'0')}/100 SOLES`;
}

// ── Generador de HTML para Vista Previa ──────────────────────────────────────

function generarHTMLPrevia(opts: {
  tipo: TipoComprobante;
  items: OrderItem[];
  total: number;
  nombres: string;
  numDoc: string;
  tipoDoc: string;
  metodo: string;
  biz: { razonSocial: string; ruc: string; direccion?: string } | null;
}): string {
  const { tipo, items, total, nombres, numDoc, tipoDoc, metodo, biz } = opts;
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' }) +
    ' ' + now.toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' }) + ' pm';
  const tipoLabel = tipo === 'nota' ? 'NOTA DE VENTA' : tipo === 'boleta' ? 'BOLETA DE VENTA ELECTRÓNICA' : 'FACTURA ELECTRÓNICA';
  const serie = tipo === 'nota' ? 'T001' : tipo === 'boleta' ? 'B001' : 'F001';
  const numero = `${serie}-PREVIEW`;

  const itemsHTML = items.map(item =>
    `<tr>
      <td style="padding:4px 2px;border-bottom:1px dashed #ccc;vertical-align:top;">${item.cantidad}</td>
      <td style="padding:4px 2px;border-bottom:1px dashed #ccc;vertical-align:top;">${item.descripcion}</td>
      <td style="padding:4px 2px;border-bottom:1px dashed #ccc;text-align:right;vertical-align:top;">${item.precio.toFixed(2)}</td>
      <td style="padding:4px 2px;border-bottom:1px dashed #ccc;text-align:right;vertical-align:top;">${(item.precio * item.cantidad).toFixed(2)}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${tipoLabel} - ${numero}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 20px; max-width: 380px; margin: 0 auto; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #999; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { font-weight: bold; padding: 4px 2px; border-bottom: 1px solid #000; font-size: 11px; }
    .total-row td { font-weight: bold; padding: 4px 2px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:14px;">${biz?.razonSocial ?? 'MI NEGOCIO'}</div>
  <div class="center">Ruc: ${biz?.ruc ?? '00000000000'}</div>
  ${biz?.direccion ? `<div class="center">${biz.direccion}</div>` : ''}
  <div class="divider"></div>
  <div class="center bold" style="font-size:13px;">${tipoLabel}</div>
  <div class="center bold">${numero}</div>
  <div class="center" style="color:#666;font-size:11px;">EMISION: ${fechaStr}</div>
  <div class="divider"></div>
  <div>Nombre : ${nombres || 'CLIENTES VARIOS'}</div>
  <div>Documento: ${numDoc ? `${tipoDoc}: ${numDoc}` : ''}</div>
  <div>Condiciones: Contado</div>
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;width:30px;">Cant</th>
        <th style="text-align:left;">Descripcion</th>
        <th style="text-align:right;width:50px;">P.U</th>
        <th style="text-align:right;width:55px;">P.T</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>
  <div class="divider"></div>
  <table>
    <tr class="total-row">
      <td>Total</td>
      <td style="text-align:right;">S/${total.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="padding:2px;">${metodo.toUpperCase()}</td>
      <td style="text-align:right;padding:2px;">S/${total.toFixed(2)}</td>
    </tr>
  </table>
  <div class="divider"></div>
  <div class="center" style="font-size:11px;color:#555;">${solesEnLetras(total)}</div>
  <div style="margin-top:10px;text-align:center;font-size:10px;color:#aaa;">*** VISTA PREVIA - No es documento válido ***</div>
</body>
</html>`;
}

type TipoComprobante = 'nota' | 'boleta' | 'factura';
type MetodoPago = 'efectivo' | 'credito' | 'otros';

// Colores e iniciales para métodos de pago sin imagen
const PM_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  efectivo:       { bg: 'bg-emerald-500', text: 'text-white', label: 'EF' },
  yape:           { bg: 'bg-purple-600',  text: 'text-white', label: 'YP' },
  plin:           { bg: 'bg-teal-500',    text: 'text-white', label: 'PL' },
  tarjeta:        { bg: 'bg-blue-600',    text: 'text-white', label: 'TC' },
  tarjeta_debito: { bg: 'bg-blue-400',    text: 'text-white', label: 'TD' },
  transferencia:  { bg: 'bg-orange-500',  text: 'text-white', label: 'TR' },
};

function pmStyle(id: string) {
  const key = Object.keys(PM_STYLE).find((k) => id.toLowerCase().includes(k)) ?? '';
  return PM_STYLE[key] ?? { bg: 'bg-slate-500', text: 'text-white', label: id.slice(0, 2).toUpperCase() };
}

function CobrarModal({ total, items, onClose, onVentaOk }: {
  total: number;
  items: OrderItem[];
  onClose: () => void;
  onVentaOk: () => void;
}) {
  const [tipo, setTipo]               = useState<TipoComprobante>('boleta');
  const [tipoDoc, setTipoDoc]         = useState('DNI');
  const [numDoc, setNumDoc]           = useState('');
  const [nombres, setNombres]         = useState('');
  const [observacion, setObservacion] = useState('');
  const [vuelto, setVuelto]           = useState('');
  const [generaGRem, setGeneraGRem]   = useState(false);
  const [metodoActivo, setMetodoActivo] = useState<MetodoPago>('efectivo');
  const [previaHTML, setPreviaHTML]   = useState<string | null>(null);
  const [showOtrosPanel, setShowOtrosPanel] = useState(false);

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [resultado, setResultado]     = useState<any>(null);
  const [otrosAmounts, setOtrosAmounts] = useState<Record<string, string>>({});

  const { data: payMethodsRaw } = useQuery({
    queryKey: ['payment-methods'],
    queryFn:  () => salesService.getPaymentMethods(),
    staleTime: 5 * 60 * 1000,
  });

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMsg,     setLookupMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Factura requiere obligatoriamente RUC
  useEffect(() => {
    if (tipo === 'factura' && tipoDoc !== 'RUC') {
      setTipoDoc('RUC');
      setNumDoc('');
      setNombres('');
      setLookupMsg(null);
    }
  }, [tipo]);

  const buscarDocumento = async () => {
    const num = numDoc.trim();
    if (!num) return;
    setLookupLoading(true);
    setLookupMsg(null);
    try {
      const data = await customersService.lookup(tipoDoc, num);
      setNombres(data.nombreCompleto ?? '');
      const src = data.source === 'local' ? 'Cliente encontrado en sistema' : data.source === 'reniec' ? 'Datos de RENIEC' : 'Datos de SUNAT';
      setLookupMsg({ type: 'ok', text: src });
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Documento no encontrado';
      setLookupMsg({ type: 'err', text: Array.isArray(msg) ? msg[0] : msg });
    } finally {
      setLookupLoading(false);
    }
  };

  const { data: biz } = useQuery({
    queryKey: ['business-me'],
    queryFn: businessService.getMe,
    staleTime: 5 * 60 * 1000,
  });

  const vueltoNum  = parseFloat(vuelto) || 0;
  const vueltoInsuf = vueltoNum > 0 && vueltoNum < total;
  const cambio     = vueltoNum >= total ? vueltoNum - total : 0;

  const abrirVistaPrevia = () => {
    const html = generarHTMLPrevia({
      tipo, items, total, nombres, numDoc, tipoDoc,
      metodo: metodoActivo,
      biz: biz ?? null,
    });
    setPreviaHTML(html);
  };

  const procesarVenta = async (
    metodo: MetodoPago,
    customPaymentId?: string,
    customPayments?: { paymentMethodId: string; monto: number }[],
  ) => {
    if (tipo === 'factura') {
      if (tipoDoc !== 'RUC') {
        setError('La factura solo puede emitirse a un cliente con RUC. Cambia el tipo de documento a RUC.');
        return;
      }
      if (!/^\d{11}$/.test(numDoc.trim())) {
        setError('Ingresa un RUC válido de 11 dígitos para emitir una factura.');
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      let customerId: string | undefined;
      if (tipo !== 'nota' && numDoc.trim() && nombres.trim()) {
        const cliente = await customersService.upsert({
          nombreCompleto:  nombres.trim(),
          tipoDocumento:   tipoDoc,
          numeroDocumento: numDoc.trim(),
        });
        customerId = cliente.id;
      }

      const result = await salesService.create({
        tipoVenta: metodo === 'credito' ? 'credito' : 'contado',
        customerId,
        items: items.map((item) => ({
          productId:      item.productId,
          descripcion:    item.descripcion,
          cantidad:       item.cantidad,
          precioUnitario: item.precio,
          descuento:      item.descuento ?? 0,
        })),
        payments: metodo === 'credito' ? [] : (customPayments ?? [{
          paymentMethodId: customPaymentId ?? metodo,
          monto: total,
        }]),
        observaciones:     observacion || undefined,
        emitirComprobante: tipo !== 'nota',
        tipoComprobante:   tipo !== 'nota' ? tipo : undefined,
      });
      setResultado(result);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al procesar la venta');
    } finally {
      setLoading(false);
    }
  };

  // ── Vista de éxito (va antes que los paneles para que siempre se muestre) ─
  if (resultado) {
    const comp = resultado.comprobante;
    const compNumero = comp?.numeroCompleto ?? null;
    const compEstado = comp?.estado ?? null;
    const estaAceptado = compEstado === 'aceptado';

    const whatsappShare = () => {
      const pdfUrl = comp?.id
        ? `https://vendacore-backend.fly.dev/api/v1/documents/${comp.id}/pdf`
        : null;
      const msg = compNumero
        ? encodeURIComponent(
            `Hola! Le compartimos su comprobante:\n\n*${compNumero}*\nTotal: S/ ${total.toFixed(2)}\n\n${pdfUrl ? `Descargue su PDF aquí:\n${pdfUrl}\n\n` : ''}Gracias por su preferencia.`
          )
        : encodeURIComponent(`Hola! Le compartimos los datos de su venta:\n\nTotal: S/ ${total.toFixed(2)}\nFecha: ${new Date().toLocaleDateString('es-PE')}\n\nGracias por su preferencia.`);
      window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { onVentaOk(); onClose(); }}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="bg-green-600 px-4 py-4 text-center relative">
            <button onClick={() => { onVentaOk(); onClose(); }} className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors">
              <X size={18} />
            </button>
            <CheckCircle size={40} className="text-white mx-auto mb-2" />
            <p className="text-white font-bold text-lg">Venta registrada</p>
            <p className="text-green-100 text-sm">S/ {total.toFixed(2)}</p>
          </div>

          <div className="p-5 space-y-3">
            {compNumero ? (
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                <p className="text-xs text-slate-500 font-medium mb-1">Comprobante</p>
                <p className="font-bold text-slate-800 text-base">{compNumero}</p>
                {compEstado && (
                  <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    estaAceptado ? 'bg-green-100 text-green-700' :
                    compEstado === 'rechazado' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {estaAceptado ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                    {compEstado === 'pendiente' ? 'Enviando a SUNAT...' : compEstado}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                <p className="text-xs text-slate-500">Venta sin comprobante (nota)</p>
                <p className="font-mono text-xs text-slate-400 mt-1">{String(resultado.id).slice(-8).toUpperCase()}</p>
              </div>
            )}

            {resultado.vuelto > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
                <p className="text-xs text-blue-600 font-medium">Cambio a entregar</p>
                <p className="text-xl font-bold text-blue-700">S/ {Number(resultado.vuelto).toFixed(2)}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={whatsappShare}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-[#25D366] hover:bg-[#1da851] text-white transition-colors">
                WhatsApp
              </button>
              <button
                onClick={() => { onVentaOk(); onClose(); }}
                className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white transition-colors">
                Nueva venta
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Panel Otros métodos de pago ───────────────────────────────────────────
  if (showOtrosPanel) {
    const methods = (payMethodsRaw && payMethodsRaw.length > 0)
      ? payMethodsRaw.filter((m: any) => m.isActive !== false)
      : [];

    const totalAsignado = methods.reduce((sum: number, m: any) => {
      return sum + (parseFloat(otrosAmounts[m.id] || '0') || 0);
    }, 0);
    const restante = total - totalAsignado;

    const handleCobrarOtros = async () => {
      const payments = methods
        .filter((m: any) => parseFloat(otrosAmounts[m.id] || '0') > 0)
        .map((m: any) => ({ paymentMethodId: m.id, monto: parseFloat(otrosAmounts[m.id]) }));
      if (payments.length === 0) { setError('Ingresa al menos un monto de pago.'); return; }
      const sum = payments.reduce((s: number, p: any) => s + p.monto, 0);
      if (sum < total - 0.01) { setError(`Faltan S/ ${(total - sum).toFixed(2)} por asignar.`); return; }
      await procesarVenta('otros', undefined, payments);
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 flex-shrink-0">
            <button onClick={() => { setShowOtrosPanel(false); setError(''); setOtrosAmounts({}); }}
              className="flex items-center gap-1 text-slate-300 hover:text-white text-sm transition-colors">
              <ChevronLeft size={16} /> Volver
            </button>
            <span className="text-white font-bold text-sm">Total = S/ {total.toFixed(2)}</span>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Inputs por método */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {methods.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-6">
                No hay métodos de pago configurados.<br />
                Ve a Configuración → Métodos de pago.
              </p>
            )}
            {methods.map((m: any) => {
              const st = pmStyle(m.nombre ?? '');
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${st.bg} ${st.text}`}>
                    {st.label}
                  </div>
                  <div className="relative flex-1 border border-slate-300 rounded-lg px-3 pt-4 pb-2 focus-within:border-blue-500 transition-colors">
                    <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      {m.nombre}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-slate-400 font-medium">S/</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={otrosAmounts[m.id] ?? ''}
                        onChange={(e) => {
                          setOtrosAmounts((prev) => ({ ...prev, [m.id]: e.target.value }));
                          setError('');
                        }}
                        placeholder="0.00"
                        className="flex-1 outline-none text-sm text-slate-800 bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumen asignado / pendiente */}
          {methods.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Asignado</span>
                <span className="font-semibold text-slate-700">S/ {totalAsignado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={restante > 0.005 ? 'text-red-500 font-semibold' : 'text-emerald-600 font-semibold'}>
                  {restante > 0.005 ? 'Pendiente' : '✓ Completo'}
                </span>
                <span className={`font-bold ${restante > 0.005 ? 'text-red-500' : 'text-emerald-600'}`}>
                  S/ {Math.max(0, restante).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mx-4 mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {methods.length > 0 && (
            <div className="px-4 pb-4 pt-2 flex-shrink-0">
              <button
                onClick={handleCobrarOtros}
                disabled={loading || totalAsignado < total - 0.01}
                className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-colors">
                {loading ? 'Procesando...' : 'COBRAR'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Modal Vista Previa ────────────────────────────────────────────────────
  if (previaHTML) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 flex-shrink-0">
            <span className="text-sm font-bold text-white">Vista Previa — Comprobante</span>
            <button onClick={() => setPreviaHTML(null)} className="text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <iframe
            srcDoc={previaHTML}
            title="Vista Previa"
            style={{ width: '100%', flex: 1, border: 'none', minHeight: '60vh' }}
          />
          <div className="flex gap-2 px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex-shrink-0">
            <button
              onClick={() => setPreviaHTML(null)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Vista principal del cobro ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 flex-shrink-0">
          <span className="text-white font-bold text-base">
            Total = <span className="text-yellow-400">S/ {total.toFixed(2)}</span>
          </span>
          <div className="flex items-center gap-2">
            <button onClick={abrirVistaPrevia} className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors">
              <Eye size={13} /> VISTA PREVIA
            </button>
            <button onClick={onClose} disabled={loading} className="text-slate-400 hover:text-white transition-colors ml-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">

          {/* Tipo comprobante */}
          <div className="flex gap-4">
            {(['nota', 'boleta', 'factura'] as TipoComprobante[]).map((t) => (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)}
                  className="accent-blue-600" />
                <span className="text-sm font-semibold text-slate-700 capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
              </label>
            ))}
          </div>

          {/* Tipo Doc + Número */}
          <div className="flex gap-2">
            <select value={tipoDoc} onChange={(e) => { setTipoDoc(e.target.value); setLookupMsg(null); }}
              disabled={tipo === 'factura'}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-700 bg-white outline-none focus:border-blue-500 w-24 flex-shrink-0 disabled:bg-slate-100 disabled:cursor-not-allowed">
              <option>DNI</option>
              <option>RUC</option>
              <option>CE</option>
              <option>Pasaporte</option>
              <option>Sin Doc</option>
            </select>
            <div className="relative flex-1">
              <input
                value={numDoc}
                onChange={(e) => { setNumDoc(e.target.value); setLookupMsg(null); }}
                onKeyDown={(e) => e.key === 'Enter' && buscarDocumento()}
                placeholder="Número de documento"
                className="w-full border border-slate-300 rounded px-3 py-1.5 pr-8 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={buscarDocumento}
                disabled={lookupLoading || !numDoc.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
                title="Buscar por documento"
              >
                {lookupLoading
                  ? <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  : <Search size={14} />}
              </button>
            </div>
          </div>
          {lookupMsg && (
            <p className={`text-xs font-medium px-2 py-1 rounded ${
              lookupMsg.type === 'ok' ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
            }`}>
              {lookupMsg.type === 'ok' ? '✓' : '✗'} {lookupMsg.text}
            </p>
          )}

          {/* Nombres */}
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Nombres Completos</label>
            <input value={nombres} onChange={(e) => setNombres(e.target.value)}
              placeholder="Nombres y Apellidos"
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
          </div>

          {/* Observación */}
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Observación</label>
            <input value={observacion} onChange={(e) => setObservacion(e.target.value)}
              placeholder="Observación (opcional)"
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
          </div>

          {/* Vuelto de */}
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-1">Vuelto de</label>
            <input value={vuelto} onChange={(e) => setVuelto(e.target.value)}
              placeholder="0.00" type="number" min="0" step="0.10"
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
            {vueltoInsuf && (
              <p className="text-red-500 text-xs mt-1 font-medium">ES MENOR AL TOTAL</p>
            )}
            {cambio > 0 && (
              <p className="text-green-600 text-xs mt-1 font-medium">Cambio: S/ {cambio.toFixed(2)}</p>
            )}
          </div>

          {/* Genera G-Rem */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-slate-700">Genera G-Rem</span>
            <button onClick={() => setGeneraGRem((v) => !v)} className="flex items-center gap-1 transition-colors">
              {generaGRem
                ? <ToggleRight size={28} className="text-blue-500" />
                : <ToggleLeft size={28} className="text-slate-400" />}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Botones de pago */}
        <div className="flex gap-2 px-4 py-3 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={() => { setMetodoActivo('efectivo'); procesarVenta('efectivo'); }}
            disabled={loading}
            className="flex-1 py-2.5 rounded font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60">
            {loading ? 'Procesando...' : 'EFECTIVO (F3)'}
          </button>
          <button
            onClick={() => { setMetodoActivo('credito'); procesarVenta('credito'); }}
            disabled={loading}
            className="flex-1 py-2.5 rounded font-bold text-sm bg-slate-500 hover:bg-slate-600 text-white transition-colors disabled:opacity-60">
            CRÉDITO
          </button>
          <button
            onClick={() => { setMetodoActivo('otros'); setShowOtrosPanel(true); }}
            disabled={loading}
            className="flex-1 py-2.5 rounded font-bold text-sm bg-yellow-400 hover:bg-yellow-500 text-white transition-colors disabled:opacity-60">
            OTROS
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página POS ────────────────────────────────────────────────────────────────

export default function PuntoVentaPage() {
  const qc = useQueryClient();
  const [view, setView]               = useState<'categories' | 'products'>('categories');
  const [selectedCat, setSelectedCat] = useState<ProductCategory | null>(null);
  const [search, setSearch]           = useState('');
  const cartKey = `${CART_KEY_PREFIX}${useAuthStore.getState().user?.id ?? 'guest'}`;
  const [items, setItems]             = useState<OrderItem[]>(() => loadCart(cartKey));
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [showAddModal, setShowAddModal]           = useState(false);
  const [showCobrarModal, setShowCobrarModal]     = useState(false);
  const [showProformaModal, setShowProformaModal] = useState(false);
  const searchRef  = useRef<HTMLInputElement>(null);
  const stockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stockMsg, setStockMsg] = useState<string | null>(null);

  const showStockAlert = (msg: string) => {
    setStockMsg(msg);
    if (stockTimer.current) clearTimeout(stockTimer.current);
    stockTimer.current = setTimeout(() => setStockMsg(null), 2500);
  };

  const todayISO = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState(todayISO);

  useEffect(() => { saveCart(cartKey, items); }, [items]);

  const { data: categories = [], isLoading: loadingCats } = useQuery<ProductCategory[]>({
    queryKey: ['categories'],
    queryFn: productsService.getCategories,
    staleTime: 10 * 60 * 1000,   // 10 min — categorías no cambian frecuentemente
    gcTime:    30 * 60 * 1000,   // 30 min en caché
  });

  const { data: productsData, isLoading: loadingProds, isFetching: fetchingProds } = useQuery({
    queryKey: ['pos-products', selectedCat?.id, search],
    queryFn: () => productsService.getAll({ search: search || undefined, categoryId: selectedCat?.id, limit: 100 }),
    enabled: view === 'products' || search.length > 0,
    staleTime: 0,                 // POS siempre necesita stock fresco
    gcTime:    10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const products = productsData?.data ?? [];

  // Sincronizar stock actual hacia los items del carrito cuando se cargan productos del catálogo
  useEffect(() => {
    if (products.length === 0) return;
    setItems((prev) => prev.map((item) => {
      const match = products.find((p) => p.id === item.productId);
      return match ? { ...item, stock: match.stockActual } : item;
    }));
  }, [products]);

  // Al iniciar, buscar el stock actual de los productos que están en el carrito
  const cartProductIds = items.filter((i) => i.productId && i.stock === undefined).map((i) => i.productId!);
  useQuery({
    queryKey: ['pos-cart-stock', cartProductIds],
    queryFn: () => productsService.getAll({ limit: 200 }),
    enabled: cartProductIds.length > 0,
    staleTime: 0,
    select: (data) => {
      setItems((prev) => prev.map((item) => {
        const match = data.data.find((p: any) => p.id === item.productId);
        return match ? { ...item, stock: match.stockActual } : item;
      }));
      return null;
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F2' && items.length > 0) { e.preventDefault(); setShowCobrarModal(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items]);

  const addItem = (item: Omit<OrderItem, 'id'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => (item.productId ? i.productId === item.productId : i.descripcion === item.descripcion));
      if (existing) {
        if (item.stock !== undefined && existing.cantidad >= item.stock) {
          showStockAlert(`Sin stock disponible para "${item.descripcion}"`);
          return prev;
        }
        return prev.map((i) => ((item.productId ? i.productId === item.productId : i.descripcion === item.descripcion) ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      if (item.stock !== undefined && item.stock <= 0) {
        showStockAlert(`Sin stock disponible para "${item.descripcion}"`);
        return prev;
      }
      return [...prev, { ...item, id: crypto.randomUUID() }];
    });
  };

  const removeItem = (id: string) => setItems((p) => p.filter((i) => i.id !== id));

  const updateItem = (updated: OrderItem) =>
    setItems((p) => p.map((i) => i.id === updated.id ? updated : i));

  const total = items.reduce((s, i) => s + Math.max(0, i.precio * i.cantidad - (i.descuento ?? 0)), 0);

  const handleVentaOk = () => {
    setItems([]);
    saveCart(cartKey, []);
    qc.invalidateQueries({ queryKey: ['documents'] });
    qc.refetchQueries({ queryKey: ['pos-products'] });
    qc.refetchQueries({ queryKey: ['products'] });
  };

  const handleCatalogo = () => { setSelectedCat(null); setView('products'); };
  const handleCategory = (cat: ProductCategory) => { setSelectedCat(cat); setView('products'); };
  const handleBack = () => { setSelectedCat(null); setView('categories'); setSearch(''); };

  const filteredCats = categories.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex overflow-hidden bg-white" style={{ height: 'calc(100vh - 56px)' }}>

      {/* ── Panel izquierdo ── */}
      <div className="flex flex-col border-r border-slate-200 flex-shrink-0 bg-white" style={{ width: '38%' }}>

        {/* Buscador */}
        <div className="p-3 border-b border-slate-200">
          <div className="relative border-2 border-blue-500 rounded px-3 py-2">
            <span className="absolute -top-2.5 left-2 bg-white px-1 text-[11px] text-blue-500 font-medium">
              Escriba para Buscar (F1)
            </span>
            <div className="flex items-center gap-2">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) setView('products'); else if (!selectedCat) setView('categories');
                }}
                className="flex-1 text-sm outline-none"
              />
              <Search size={18} className="text-blue-500 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Botón volver */}
        {view === 'products' && (
          <button onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 text-xs text-blue-600 hover:bg-blue-50 border-b border-slate-100 font-medium">
            <ChevronLeft size={14} /> Volver a categorías
          </button>
        )}

        {/* Grid categorías / productos */}
        <div className="flex-1 overflow-y-auto">
          {view === 'categories' ? (
            <div className="grid grid-cols-2">
              {loadingCats
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="border border-slate-200 py-6 px-3 animate-pulse">
                      <div className="h-4 bg-slate-200 rounded mx-auto w-3/4" />
                    </div>
                  ))
                : filteredCats.map((cat) => (
                    <button key={cat.id} onClick={() => handleCategory(cat)}
                      className="border border-slate-200 py-6 px-3 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors text-center uppercase tracking-wide cursor-pointer">
                      {cat.nombre}
                    </button>
                  ))
              }
              {!loadingCats && filteredCats.length === 0 && (
                <p className="col-span-2 text-center text-slate-400 py-12 text-sm">Sin categorías</p>
              )}
            </div>
          ) : (
            <div className={`grid grid-cols-2 transition-opacity duration-150 ${fetchingProds ? 'opacity-60' : 'opacity-100'}`}>
              {loadingProds
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="border border-slate-200 py-4 px-3 animate-pulse">
                      <div className="h-3 bg-slate-200 rounded w-4/5 mb-2" />
                      <div className="h-4 bg-blue-100 rounded w-1/3" />
                    </div>
                  ))
                : products.map((p) => {
                    const sinStock = Number(p.stockActual ?? 0) <= 0;
                    return (
                      <button key={p.id}
                        disabled={sinStock}
                        onClick={() => addItem({ productId: p.id, descripcion: p.nombre, precio: Number(p.precioVenta), cantidad: 1, stock: p.stockActual })}
                        className={`border py-4 px-3 text-left transition-colors ${sinStock ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed' : 'border-slate-200 hover:bg-blue-50 hover:border-blue-300 cursor-pointer'}`}>
                        <p className="text-xs font-semibold text-slate-700 uppercase leading-tight">{p.nombre}</p>
                        <p className={`text-sm font-bold mt-1 ${sinStock ? 'text-slate-400' : 'text-blue-600'}`}>
                          {sinStock ? 'Agotado' : `S/${Number(p.precioVenta).toFixed(2)}`}
                        </p>
                      </button>
                    );
                  })
              }
              {!loadingProds && products.length === 0 && (
                <p className="col-span-2 text-center text-slate-400 py-12 text-sm">Sin productos</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel derecho ── */}
      <div className="flex flex-col flex-1 overflow-hidden relative">

        {/* Fecha + botones */}
        <div className="border-b border-slate-200 px-5 py-3 flex-shrink-0 flex items-center gap-3">
          <div className="flex gap-3 flex-1">
            <button onClick={handleCatalogo}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors">
              <BookOpen size={15} /> CATÁLOGO
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold transition-colors">
              <Plus size={15} /> AGREGAR +
            </button>
            <button onClick={() => setShowProformaModal(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-bold transition-colors">
              <FileText size={15} /> PROFORMA
            </button>
          </div>

          {/* Campo fecha */}
          <div className="relative inline-flex items-center border-2 border-blue-500 rounded px-3 py-1.5 flex-shrink-0">
            <span className="absolute -top-2.5 left-2 bg-white px-1 text-[11px] text-blue-500 font-medium">Fecha de Emisión</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="text-sm text-slate-700 font-medium outline-none cursor-pointer bg-transparent"
            />
          </div>
        </div>

        {/* Tabla items */}
        <div className="flex-1 bg-slate-900 overflow-y-auto">
          <div className="grid px-4 py-2.5 border-b border-slate-700 sticky top-0 bg-slate-900 z-10"
            style={{ gridTemplateColumns: '1fr 80px 110px 110px 32px' }}>
            <span className="text-xs text-slate-400 font-semibold uppercase">Descripcion</span>
            <span className="text-xs text-slate-400 font-semibold uppercase text-center">Cant.</span>
            <span className="text-xs text-slate-400 font-semibold uppercase text-right">Precio</span>
            <span className="text-xs text-slate-400 font-semibold uppercase text-right">Total</span>
            <span />
          </div>

          {items.length === 0 && (
            <div className="flex items-center justify-center h-40">
              <p className="text-slate-600 text-sm">Sin productos agregados</p>
            </div>
          )}

          {items.map((item) => {
            const lineTotal = Math.max(0, item.precio * item.cantidad - (item.descuento ?? 0));
            return (
            <div key={item.id}
              onClick={() => setEditingItem(item)}
              className="grid items-center px-4 py-2.5 border-b border-slate-800 hover:bg-slate-700 cursor-pointer group"
              style={{ gridTemplateColumns: '1fr 80px 110px 110px 32px' }}>
              <div className="pr-2 min-w-0">
                <span className="text-sm text-white truncate block">{item.cantidad} x {item.descripcion}</span>
                {(item.descuento ?? 0) > 0 && (
                  <span className="text-[10px] text-orange-400">− S/{item.descuento!.toFixed(2)} dto</span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setItems((p) => p.map((i) => i.id === item.id ? { ...i, cantidad: Math.max(1, i.cantidad - 1) } : i))}
                  className="w-5 h-5 rounded bg-slate-700 text-white text-xs hover:bg-slate-600 flex items-center justify-center">−</button>
                <span className="text-sm text-white w-4 text-center">{item.cantidad}</span>
                <button
                  onClick={() => {
                    if (item.stock !== undefined && item.cantidad >= item.stock) {
                      showStockAlert(`Sin stock disponible para "${item.descripcion}"`);
                      return;
                    }
                    setItems((p) => p.map((i) => i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i));
                  }}
                  disabled={item.stock !== undefined && item.cantidad >= item.stock}
                  className="w-5 h-5 rounded bg-slate-700 text-white text-xs hover:bg-slate-600 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed">+</button>
              </div>
              <span className="text-sm text-slate-300 text-right">S/{item.precio.toFixed(2)}</span>
              <span className="text-sm text-white font-semibold text-right">S/{lineTotal.toFixed(2)}</span>
              <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 flex justify-center">
                <Trash2 size={13} />
              </button>
            </div>
            );
          })}
        </div>

        {/* Toast stock */}
        {stockMsg && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg whitespace-nowrap animate-pulse">
            {stockMsg}
          </div>
        )}

        {/* Footer: Total + Cobrar */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0 bg-white">
          <span className="text-base font-bold text-slate-700">
            Total: <span className="text-red-500">S/{total.toFixed(2)}</span>
          </span>
          {items.length > 0 && (
            <button onClick={() => setShowCobrarModal(true)}
              className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-2 rounded-full text-sm transition-colors">
              COBRAR (F2)
            </button>
          )}
        </div>
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={updateItem}
          onDelete={removeItem}
          onClose={() => setEditingItem(null)}
        />
      )}
      {showAddModal && <AddItemModal onAdd={addItem} onClose={() => setShowAddModal(false)} />}
      {showProformaModal && (
        <ProformaModal
          onClose={() => setShowProformaModal(false)}
          onSelect={(cartItems) => { setItems(cartItems); setShowProformaModal(false); }}
        />
      )}
      {showCobrarModal && (
        <CobrarModal
          total={total}
          items={items}
          onClose={() => setShowCobrarModal(false)}
          onVentaOk={handleVentaOk}
        />
      )}
    </div>
  );
}
