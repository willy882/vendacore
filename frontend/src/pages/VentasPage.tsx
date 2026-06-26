import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  User, CreditCard, CheckCircle, X, Package, ScanLine, Printer, UserPlus, MessageCircle,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { productsService } from '@/services/products.service';
import { salesService } from '@/services/sales.service';
import { customersService } from '@/services/customers.service';
import { cashService } from '@/services/cash.service';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Product, Customer } from '@/types';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface CartItem {
  product:        Product;
  cantidad:       number;
  precioUnitario: number;
  descuento:      number;      // discount percentage
  nota?:          string;      // observation per item
  esGratuito?:    boolean;     // free/courtesy item
}

interface PaymentLine {
  methodId: string;
  nombre:   string;
  monto:    string;
}

interface SaleReceipt {
  id:        string;
  fecha:     Date;
  customer:  { nombreCompleto: string; telefono?: string; numeroDocumento?: string; tipoDocumento?: string } | null;
  items:     CartItem[];
  subtotal:  number;
  igv:       number;
  total:     number;
  payments:  PaymentLine[];
  tipoVenta: 'contado' | 'credito';
}

const IGV_RATE = 0.18;

const DEFAULT_PAY_METHODS = [
  { id: 'efectivo',       nombre: 'Efectivo'       },
  { id: 'yape',           nombre: 'Yape'           },
  { id: 'plin',           nombre: 'Plin'           },
  { id: 'transferencia',  nombre: 'Transferencia'  },
  { id: 'tarjeta_debito', nombre: 'Tarjeta Débito' },
];

function calcIgv(product: Product, subtotal: number) {
  return product.igvTipo === 'gravado' ? subtotal * IGV_RATE : 0;
}

// ─── Componente producto card ─────────────────────────────────────────────────

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const sinStock = Number(product.stockActual) <= 0;
  return (
    <button
      disabled={sinStock}
      onClick={() => onAdd(product)}
      className="text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <p className="text-xs text-slate-500 font-mono">{product.codigoInterno ?? '—'}</p>
      <p className="text-sm font-semibold text-slate-800 mt-0.5 line-clamp-2">{product.nombre}</p>
      <div className="flex justify-between items-center mt-2">
        <span className="text-blue-700 font-bold text-sm">{formatCurrency(Number(product.precioVenta))}</span>
        <Badge variant={sinStock ? 'danger' : Number(product.stockActual) <= Number(product.stockMinimo) ? 'warning' : 'success'}>
          {formatNumber(Number(product.stockActual))} {product.unidadMedida ?? ''}
        </Badge>
      </div>
    </button>
  );
}

// ─── Modal editar ítem del carrito ───────────────────────────────────────────

function CartItemEditModal({ item, idx, onSave, onRemove, onClose }: {
  item:     CartItem | null;
  idx:      number;
  onSave:   (idx: number, changes: Partial<CartItem>) => void;
  onRemove: (idx: number) => void;
  onClose:  () => void;
}) {
  const [cantidad,   setCantidad]   = useState(1);
  const [precio,     setPrecio]     = useState('');
  const [descuento,  setDescuento]  = useState('0');
  const [nota,       setNota]       = useState('');
  const [esGratuito, setEsGratuito] = useState(false);

  useEffect(() => {
    if (item) {
      setCantidad(item.cantidad);
      setPrecio(item.precioUnitario.toFixed(2));
      setDescuento(String(item.descuento ?? 0));
      setNota(item.nota ?? '');
      setEsGratuito(item.esGratuito ?? false);
    }
  }, [item]);

  if (!item) return null;

  const precioNum   = parseFloat(precio) || 0;
  const descNum     = parseFloat(descuento) || 0;
  const subtotal    = esGratuito ? 0 : cantidad * precioNum * (1 - descNum / 100);

  const handleSave = () => {
    onSave(idx, {
      cantidad,
      precioUnitario: esGratuito ? 0 : precioNum,
      descuento:      descNum,
      nota:           nota.trim() || undefined,
      esGratuito,
    });
    onClose();
  };

  return (
    <Modal open={!!item} onClose={onClose} title={item.product.nombre} size="sm"
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="outline" onClick={() => { onRemove(idx); onClose(); }}
            className="text-red-600 border-red-200 hover:bg-red-50">
            Eliminar
          </Button>
          <Button onClick={handleSave} fullWidth icon={<CheckCircle size={15} />}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Cantidad */}
        <div>
          <p className="text-xs text-slate-500 mb-1">Cantidad</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setCantidad((v) => Math.max(1, v - 1))}
              className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700">
              <Minus size={14} />
            </button>
            <input
              type="number" min="1"
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 text-center text-lg font-bold border border-slate-300 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={() => setCantidad((v) => v + 1)}
              className="w-9 h-9 rounded-lg bg-blue-100 hover:bg-blue-200 flex items-center justify-center text-blue-700">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Precio */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Precio S/</p>
            <input
              type="number" step="0.01" min="0"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              disabled={esGratuito}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
          {/* Descuento % */}
          <div>
            <p className="text-xs text-slate-500 mb-1">Descuento %</p>
            <input
              type="number" step="1" min="0" max="100"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              disabled={esGratuito}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
        </div>

        {/* Es cortesía */}
        <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={esGratuito}
            onChange={(e) => { setEsGratuito(e.target.checked); if (e.target.checked) { setDescuento('0'); } }}
            className="w-4 h-4 rounded accent-blue-600"
          />
          <div>
            <p className="text-sm font-medium text-slate-700">Es cortesía / gratuito</p>
            <p className="text-xs text-slate-400">El precio se establece en S/ 0.00</p>
          </div>
        </label>

        {/* Observación */}
        <div>
          <p className="text-xs text-slate-500 mb-1">Observación (opcional)</p>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: sin cebolla, bien cocido..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Subtotal */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <span className="text-sm text-slate-500">Subtotal</span>
          <span className={`text-lg font-bold ${esGratuito ? 'text-emerald-600' : 'text-blue-700'}`}>
            {esGratuito ? 'CORTESÍA' : formatCurrency(subtotal)}
          </span>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal de confirmación de pago ───────────────────────────────────────────

interface PayModalProps {
  open:             boolean;
  onClose:          () => void;
  total:            number;
  cart:             CartItem[];
  paymentMethods:   { id: string; nombre: string }[];
  onConfirm:        (payments: PaymentLine[], tipoVenta: 'contado' | 'credito', tipoDoc: 'nota' | 'boleta' | 'factura') => void;
  loading:          boolean;
  customer:         Customer | null;
  onCustomerChange: (c: Customer | null) => void;
}

// Iconos/colores para métodos de pago
const METHOD_STYLES: Record<string, { bg: string; text: string; emoji: string }> = {
  efectivo:       { bg: 'bg-green-100',  text: 'text-green-700',  emoji: '💵' },
  yape:           { bg: 'bg-purple-100', text: 'text-purple-700', emoji: '💜' },
  plin:           { bg: 'bg-sky-100',    text: 'text-sky-700',    emoji: '🔵' },
  transferencia:  { bg: 'bg-amber-100',  text: 'text-amber-700',  emoji: '🏦' },
  tarjeta:        { bg: 'bg-blue-100',   text: 'text-blue-700',   emoji: '💳' },
  tarjeta_debito: { bg: 'bg-blue-100',   text: 'text-blue-700',   emoji: '💳' },
  tarjeta_credito:{ bg: 'bg-indigo-100', text: 'text-indigo-700', emoji: '💳' },
};
function getMethodStyle(nombre: string) {
  const key = nombre.toLowerCase().replace(/[^a-z_]/g, '');
  return METHOD_STYLES[key] ?? { bg: 'bg-slate-100', text: 'text-slate-700', emoji: '💰' };
}

function PayModal({ open, onClose, total, cart, paymentMethods, onConfirm, loading, customer, onCustomerChange }: PayModalProps) {
  const qc = useQueryClient();

  // ── Tipo de documento ──────────────────────────────────────────────────────
  const [tipoDoc, setTipoDoc] = useState<'nota' | 'boleta' | 'factura'>('nota');

  // ── Tipo de venta ──────────────────────────────────────────────────────────
  const [tipoVenta, setTipoVenta] = useState<'contado' | 'credito'>('contado');

  // ── Montos por método ──────────────────────────────────────────────────────
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  // ── Sección cliente ────────────────────────────────────────────────────────
  const [docSearch,  setDocSearch]  = useState('');
  const [newNombre,  setNewNombre]  = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const trimDoc    = docSearch.trim();
  const onlyDigits = /^\d+$/.test(trimDoc);
  const isDni      = onlyDigits && trimDoc.length === 8;
  const isRuc      = onlyDigits && trimDoc.length === 11;
  const tipoDocId  = isDni ? 'DNI' : isRuc ? 'RUC' : undefined;

  const { data: searchData, isFetching: searchFetching } = useQuery({
    queryKey: ['customers-paysearch', trimDoc],
    queryFn:  () => customersService.getAll({ search: trimDoc, limit: 5 }),
    enabled:  open && trimDoc.length >= 3,
    staleTime: 30_000,
  });

  const searchResults: Customer[] = (Array.isArray(searchData) ? searchData : (searchData as any)?.data) ?? [];

  useEffect(() => {
    if (tipoDocId && searchResults.length === 1 && searchResults[0].numeroDocumento === trimDoc) {
      onCustomerChange(searchResults[0]);
      setDocSearch('');
      setShowCreate(false);
    }
  }, [searchResults, tipoDocId, trimDoc]);

  useEffect(() => {
    if (tipoDocId && !searchFetching && searchResults.length === 0 && trimDoc.length >= 8) {
      setShowCreate(true);
    } else if (searchResults.length > 0) {
      setShowCreate(false);
    }
  }, [searchResults, searchFetching, tipoDocId, trimDoc]);

  const createCustomerMut = useMutation({
    mutationFn: () => customersService.create({
      nombreCompleto:  newNombre.trim(),
      tipoDocumento:   tipoDocId ?? 'DNI',
      numeroDocumento: trimDoc,
    }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      onCustomerChange(c);
      setDocSearch('');
      setNewNombre('');
      setShowCreate(false);
    },
  });

  // ── Inicializar montos ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setAmounts({});
      setDocSearch('');
      setNewNombre('');
      setShowCreate(false);
      setTipoVenta('contado');
      setTipoDoc('nota');
      return;
    }
    if (paymentMethods.length > 0) {
      const init: Record<string, string> = {};
      paymentMethods.forEach((m) => { init[m.id] = ''; });
      init[paymentMethods[0].id] = total.toFixed(2);
      setAmounts(init);
    }
  }, [open, paymentMethods]);

  const totalPagado = Object.values(amounts).reduce((a, v) => a + (parseFloat(v) || 0), 0);
  const vuelto      = totalPagado - total;
  const canPay      = tipoVenta === 'credito' || totalPagado >= total - 0.001;

  const setAmt = (id: string, v: string) => setAmounts((p) => ({ ...p, [id]: v }));

  // Botón "Exacto" — llena el primer método con el total
  const setExacto = () => {
    if (paymentMethods.length === 0) return;
    const init: Record<string, string> = {};
    paymentMethods.forEach((m) => { init[m.id] = ''; });
    init[paymentMethods[0].id] = total.toFixed(2);
    setAmounts(init);
  };

  const handleConfirm = () => {
    const payments: PaymentLine[] = paymentMethods
      .filter((m) => parseFloat(amounts[m.id] || '0') > 0)
      .map((m) => ({ methodId: m.id, nombre: m.nombre, monto: amounts[m.id] || '0' }));
    onConfirm(payments, tipoVenta, tipoDoc);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Procesar Venta"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            loading={loading}
            disabled={!canPay}
            icon={<CheckCircle size={16} />}
          >
            Confirmar Venta
          </Button>
        </>
      }
    >
      <div className="space-y-4">

        {/* ── TIPO DOCUMENTO ── */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {(['nota', 'boleta', 'factura'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipoDoc(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                tipoDoc === t
                  ? 'bg-white shadow text-blue-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'nota' ? '📋 Nota' : t === 'boleta' ? '🧾 Boleta' : '📄 Factura'}
            </button>
          ))}
        </div>

        {/* ── CLIENTE ── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <User size={12} /> Cliente
            {tipoDoc === 'nota' && <span className="font-normal normal-case text-slate-400 ml-1">— opcional para nota</span>}
            {tipoDoc === 'boleta' && <span className="font-normal normal-case text-slate-400 ml-1">— DNI o Consumidor Final</span>}
            {tipoDoc === 'factura' && <span className="font-normal normal-case text-amber-600 ml-1">— RUC obligatorio</span>}
          </p>

          {customer && !docSearch ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <User size={14} className="text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{customer.nombreCompleto}</p>
                <p className="text-xs text-slate-500">
                  {(customer as any).tipoDocumento && `${(customer as any).tipoDocumento}: ${(customer as any).numeroDocumento}`}
                  {(customer as any).telefono && ` · ${(customer as any).telefono}`}
                </p>
              </div>
              <button onClick={() => onCustomerChange(null)} className="text-slate-400 hover:text-red-500 p-1">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={docSearch}
                onChange={(e) => { setDocSearch(e.target.value); setShowCreate(false); setNewNombre(''); }}
                placeholder="DNI (8), RUC (11) o nombre del cliente..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-24"
              />
              {tipoDocId && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-md">
                  {tipoDocId} ✓
                </span>
              )}
              {searchFetching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 animate-pulse">buscando...</span>
              )}
            </div>
          )}

          {!customer && trimDoc.length >= 3 && searchResults.length > 0 && (
            <div className="border border-slate-200 bg-white rounded-lg overflow-hidden max-h-28 overflow-y-auto">
              {searchResults.map((c) => (
                <button key={c.id} onClick={() => { onCustomerChange(c); setDocSearch(''); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0 text-left">
                  <User size={13} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-800">{c.nombreCompleto}</p>
                    <p className="text-xs text-slate-400">{(c as any).tipoDocumento}: {(c as any).numeroDocumento}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showCreate && !customer && (
            <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-xs text-amber-700 font-medium">⚠ No encontrado — ingresa el nombre para crear:</p>
              <input
                autoFocus value={newNombre} onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Nombre completo del cliente"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter' && newNombre.trim()) createCustomerMut.mutate(); }}
              />
              <button
                onClick={() => createCustomerMut.mutate()}
                disabled={!newNombre.trim() || createCustomerMut.isPending}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {createCustomerMut.isPending ? 'Creando...' : `Crear — ${tipoDocId} ${trimDoc}`}
              </button>
            </div>
          )}
        </div>

        {/* ── PRODUCTOS + PAGO ── */}
        <div className="flex gap-4">
          {/* Productos */}
          <div className="flex-1 min-w-0">
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between items-center text-sm py-1 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{item.product.nombre}</p>
                    <p className="text-xs text-slate-400">
                      {formatCurrency(item.precioUnitario)} × {item.cantidad}
                      {item.descuento > 0 && <span className="ml-1 text-orange-500">-{item.descuento}%</span>}
                      {item.esGratuito && <span className="ml-1 text-emerald-600 font-semibold">CORTESÍA</span>}
                    </p>
                    {item.nota && <p className="text-xs text-slate-400 italic">{item.nota}</p>}
                  </div>
                  <span className="font-semibold text-slate-700 ml-2">
                    {item.esGratuito ? 'S/ 0.00' : formatCurrency(item.cantidad * item.precioUnitario * (1 - (item.descuento ?? 0) / 100))}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-800">
              <span>Total</span>
              <span className="text-blue-700">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Pago */}
          <div className="w-56 flex-shrink-0 space-y-2">
            {/* Contado / Crédito */}
            <div className="flex gap-1">
              {(['contado', 'credito'] as const).map((t) => (
                <button key={t} onClick={() => setTipoVenta(t)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-medium capitalize transition-colors ${
                    tipoVenta === t ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            {tipoVenta === 'contado' && (
              <>
                <div className="space-y-1.5">
                  {paymentMethods.map((m) => {
                    const style = getMethodStyle(m.nombre);
                    return (
                      <div key={m.id} className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${style.bg} flex-shrink-0`}>
                          {style.emoji}
                        </div>
                        <span className={`text-xs font-medium flex-1 truncate ${style.text}`}>{m.nombre}</span>
                        <input
                          type="number" step="0.01" min="0"
                          placeholder="0.00"
                          value={amounts[m.id] ?? ''}
                          onChange={(e) => setAmt(m.id, e.target.value)}
                          className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                        />
                      </div>
                    );
                  })}
                </div>

                <button onClick={setExacto}
                  className="w-full text-xs py-1.5 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                  Exacto ({formatCurrency(total)})
                </button>

                {totalPagado > 0 && (
                  <div className={`flex justify-between text-xs font-semibold px-2 py-1.5 rounded-lg ${vuelto >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    <span>{vuelto >= 0 ? 'Vuelto:' : 'Faltante:'}</span>
                    <span>{formatCurrency(Math.abs(vuelto))}</span>
                  </div>
                )}
              </>
            )}

            {tipoVenta === 'credito' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                La venta quedará pendiente de cobro en el crédito del cliente.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal selección cliente ──────────────────────────────────────────────────

function CustomerModal({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void; onSelect: (c: Customer | null) => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch]       = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newNombre, setNewNombre] = useState('');

  // Detectar si el input parece DNI (8 dígitos) o RUC (11 dígitos)
  const trimmed    = search.trim();
  const onlyDigits = /^\d+$/.test(trimmed);
  const isDni      = onlyDigits && trimmed.length === 8;
  const isRuc      = onlyDigits && trimmed.length === 11;
  const tipoDoc    = isDni ? 'DNI' : isRuc ? 'RUC' : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['customers-search', search],
    queryFn:  () => customersService.getAll({ search, limit: 20 }),
    enabled:  open,
  });

  const createMut = useMutation({
    mutationFn: () => customersService.create({
      nombreCompleto:  newNombre.trim(),
      tipoDocumento:   tipoDoc ?? 'DNI',
      numeroDocumento: trimmed,
    }),
    onSuccess: (customer) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      onSelect(customer);
      onClose();
    },
  });

  const customers: Customer[] = (Array.isArray(data) ? data : (data as any)?.data) ?? [];
  const noResults = !isLoading && trimmed && customers.length === 0;

  // Resetear al abrir/cerrar
  useEffect(() => {
    if (!open) { setSearch(''); setShowCreate(false); setNewNombre(''); }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Seleccionar Cliente" size="md">
      <div className="space-y-3">
        <Input
          placeholder="Nombre, DNI (8 dígitos) o RUC (11 dígitos)..."
          icon={<Search size={15} />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowCreate(false); setNewNombre(''); }}
          autoFocus
        />

        {/* Badge DNI/RUC detectado */}
        {tipoDoc && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            🔍 Buscando por <strong>{tipoDoc}</strong>: {trimmed}
          </div>
        )}

        {/* Consumidor final */}
        <button
          onClick={() => { onSelect(null); onClose(); }}
          className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-600 flex items-center gap-2"
        >
          <User size={15} className="text-slate-400" />
          Consumidor Final <span className="text-xs text-slate-400 ml-auto">sin identificación</span>
        </button>

        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c); onClose(); }}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
              >
                <p className="text-sm font-medium text-slate-800">{c.nombreCompleto}</p>
                <p className="text-xs text-slate-500">{c.tipoDocumento}: {c.numeroDocumento} {c.telefono ? `· ${c.telefono}` : ''}</p>
              </button>
            ))}
          </div>
        )}

        {/* Sin resultados → ofrecer crear */}
        {noResults && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-blue-600 border border-blue-200 border-dashed rounded-lg hover:bg-blue-50 transition-colors"
          >
            <UserPlus size={15} />
            {tipoDoc ? `Crear cliente con ${tipoDoc} ${trimmed}` : `Crear "${trimmed}"`}
          </button>
        )}

        {/* Formulario rápido de creación */}
        {showCreate && (
          <div className="border border-blue-200 rounded-xl p-3 space-y-3 bg-blue-50/50">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <UserPlus size={13} /> Nuevo cliente
            </p>
            {tipoDoc && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-slate-400 mb-0.5">Tipo</p>
                  <p className="font-semibold text-slate-700">{tipoDoc}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <p className="text-slate-400 mb-0.5">Número</p>
                  <p className="font-mono font-semibold text-slate-700">{trimmed}</p>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-600 mb-1">Nombre completo *</p>
              <input
                autoFocus
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Ej: Juan Pérez García"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => { if (e.key === 'Enter' && newNombre.trim() && !createMut.isPending) createMut.mutate(); }}
              />
            </div>
            {createMut.isError && (
              <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                {(createMut.error as any)?.response?.data?.message ?? 'Error al crear cliente'}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreate(false); setNewNombre(''); }}
                className="flex-1 py-2 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!newNombre.trim() || createMut.isPending}
                className="flex-1 py-2 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createMut.isPending ? 'Creando...' : 'Crear y seleccionar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Modal comprobante ────────────────────────────────────────────────────────

function ReceiptModal({ receipt, onClose }: { receipt: SaleReceipt | null; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [waPhone, setWaPhone]   = useState('');
  const [showWa, setShowWa]     = useState(false);
  const [waSending, setWaSending] = useState(false);
  const { data: biz } = useQuery({
    queryKey: ['business-me'],
    queryFn: () => api.get('/business/me').then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  });
  const businessName = biz?.nombreComercial ?? biz?.razonSocial ?? 'Mi Negocio';

  // Pre-llenar teléfono del cliente cuando se abre
  useEffect(() => {
    if (receipt) {
      setWaPhone((receipt.customer as any)?.telefono ?? '');
      setShowWa(false);
    }
  }, [receipt?.id]);

  const handleSendWhatsApp = async () => {
    if (!printRef.current || waSending) return;
    setWaSending(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(printRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
      const file = new File([blob], `comprobante-${receipt!.id.slice(-8)}.png`, { type: 'image/png' });

      // Web Share API con archivo (funciona en móvil)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Comprobante ${businessName}`,
          text: `Comprobante de venta — Total: S/ ${receipt!.total.toFixed(2)}`,
        });
      } else {
        // Fallback: descarga la imagen y abre WhatsApp con texto
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
        if (waPhone.length === 9) {
          const text = encodeURIComponent(`Hola, adjunto tu comprobante de *${businessName}* por S/ ${receipt!.total.toFixed(2)} 🧾`);
          window.open(`https://wa.me/51${waPhone}?text=${text}`, '_blank');
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally {
      setWaSending(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Comprobante</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 0; padding: 12px; color: #000; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        .title { font-size: 15px; font-weight: bold; text-align: center; margin-bottom: 2px; }
      </style></head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  if (!receipt) return null;

  const fecha = receipt.fecha.toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <Modal
      open={!!receipt}
      onClose={onClose}
      title="Comprobante de Venta"
      size="sm"
      footer={
        <div className="flex flex-col gap-2 w-full">
          {showWa && (
            <div className="flex gap-2 items-center bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <MessageCircle size={15} className="text-green-600 shrink-0" />
              <input
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="Celular destino (opcional)"
                className="flex-1 bg-transparent text-sm focus:outline-none"
                maxLength={9}
              />
              <button
                onClick={handleSendWhatsApp}
                disabled={waSending}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium whitespace-nowrap"
              >
                {waSending ? 'Generando...' : 'Enviar comprobante'}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} fullWidth>Nueva venta</Button>
            <button
              onClick={() => setShowWa((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showWa ? 'bg-green-600 border-green-600 text-white' : 'border-green-500 text-green-600 hover:bg-green-50'}`}
            >
              <MessageCircle size={15} /> WhatsApp
            </button>
            <Button icon={<Printer size={15} />} onClick={handlePrint} fullWidth>Imprimir</Button>
          </div>
        </div>
      }
    >
      {/* Área imprimible */}
      <div ref={printRef} className="font-mono text-xs text-slate-800 space-y-1">
        <p className="title text-center font-bold text-sm">{businessName.toUpperCase()}</p>
        <p className="text-center text-slate-500">Comprobante de Venta</p>
        <div className="border-t border-dashed border-slate-300 my-2" />

        <div className="flex justify-between">
          <span className="text-slate-500">Fecha:</span>
          <span>{fecha}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">N° Venta:</span>
          <span className="truncate max-w-[140px]">{receipt.id.slice(-8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Cliente:</span>
          <span className="truncate max-w-[140px]">{receipt.customer?.nombreCompleto ?? 'Consumidor Final'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tipo:</span>
          <span className="capitalize">{receipt.tipoVenta}</span>
        </div>

        <div className="border-t border-dashed border-slate-300 my-2" />
        <div className="flex justify-between font-semibold text-slate-500">
          <span>Producto</span>
          <span>Subtotal</span>
        </div>
        {receipt.items.map((item) => (
          <div key={item.product.id}>
            <p className="font-medium truncate">{item.product.nombre}</p>
            <div className="flex justify-between text-slate-500">
              <span>{item.cantidad} × {formatCurrency(item.precioUnitario)}</span>
              <span className="font-semibold text-slate-700">{formatCurrency(item.cantidad * item.precioUnitario)}</span>
            </div>
          </div>
        ))}

        <div className="border-t border-dashed border-slate-300 my-2" />
        <div className="flex justify-between text-slate-500">
          <span>Subtotal (sin IGV)</span>
          <span>{formatCurrency(receipt.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>IGV (18%)</span>
          <span>{formatCurrency(receipt.igv)}</span>
        </div>
        <div className="flex justify-between font-bold text-base text-slate-800 pt-1">
          <span>TOTAL</span>
          <span className="text-blue-700">{formatCurrency(receipt.total)}</span>
        </div>

        {receipt.tipoVenta === 'contado' && receipt.payments.length > 0 && (
          <>
            <div className="border-t border-dashed border-slate-300 my-2" />
            {receipt.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-slate-600">
                <span>{p.nombre}:</span>
                <span>{formatCurrency(parseFloat(p.monto) || 0)}</span>
              </div>
            ))}
            {(() => {
              const pagado = receipt.payments.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0);
              const vuelto = pagado - receipt.total;
              return vuelto > 0 ? (
                <div className="flex justify-between font-semibold text-emerald-600">
                  <span>Vuelto:</span>
                  <span>{formatCurrency(vuelto)}</span>
                </div>
              ) : null;
            })()}
          </>
        )}

        <div className="border-t border-dashed border-slate-300 mt-2 pt-2 text-center text-slate-400 text-xs">
          ¡Gracias por su compra!
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal escáner de código de barras ───────────────────────────────────────

// Beep corto via Web Audio API (no requiere archivos externos)
function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch { /* silenciar si el navegador no soporta AudioContext */ }
}

function ScannerModal({ open, onClose, onScan }: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const readerRef     = useRef<BrowserMultiFormatReader | null>(null);
  const cooldownRef   = useRef(false);           // evita doble-lectura del mismo frame
  const [error, setError]   = useState<string | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    setError(null);
    setScanned(null);
    cooldownRef.current = false;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const constraints: MediaStreamConstraints = {
      video: { facingMode: { ideal: 'environment' } },
    };

    reader.decodeFromConstraints(constraints, videoRef.current, (result) => {
      if (!result || cooldownRef.current) return;

      cooldownRef.current = true;               // bloquear lecturas durante 1 s
      const code = result.getText();
      setScanned(code);
      playBeep();
      onScan(code);

      // Mostrar feedback 900 ms y volver a escanear (modal sigue abierto)
      setTimeout(() => {
        setScanned(null);
        cooldownRef.current = false;
      }, 900);
    }).catch((e: Error) => {
      if (e.name === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Ve a Configuración del navegador y permite el acceso a la cámara para este sitio.');
      } else if (e.name === 'NotFoundError') {
        setError('No se encontró ninguna cámara en el dispositivo.');
      } else {
        setError('No se pudo iniciar la cámara. Intenta recargar la página.');
      }
    });

    return () => {
      readerRef.current = null;
      BrowserMultiFormatReader.releaseAllStreams();
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Escanear código de barras" size="sm">
      <div className="flex flex-col items-center gap-4">
        {error ? (
          <div className="w-full rounded-lg bg-red-50 border border-red-200 px-4 py-6 text-sm text-red-700 text-center">
            {error}
          </div>
        ) : (
          <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted autoPlay playsInline />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-56 h-28 rounded-lg border-2 transition-all duration-200 ${scanned ? 'border-emerald-400 bg-emerald-400/20' : 'border-white/60'}`}>
                {!scanned && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-400 animate-bounce" />
                )}
              </div>
            </div>
          </div>
        )}

        {scanned ? (
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm animate-pulse">
            <CheckCircle size={18} />
            +1 agregado — <span className="font-mono">{scanned}</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center">
            Apunta la cámara al código de barras del producto
          </p>
        )}
      </div>
    </Modal>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function VentasPage() {
  const qc = useQueryClient();

  // Estado del carrito (persistido en sessionStorage)
  const [cart, setCart]         = useState<CartItem[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('pos_cart') ?? '[]'); } catch { return []; }
  });
  const [customer, setCustomer] = useState<Customer | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('pos_customer') ?? 'null'); } catch { return null; }
  });

  useEffect(() => { sessionStorage.setItem('pos_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { sessionStorage.setItem('pos_customer', JSON.stringify(customer)); }, [customer]);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Modales
  const [payModal, setPayModal]     = useState(false);
  const [custModal, setCustModal]   = useState(false);
  const [scanModal, setScanModal]   = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [scanError, setScanError]   = useState<string | null>(null);
  const [editIdx, setEditIdx]     = useState<number>(-1);

  // Queries
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['products', { search, categoryId: catFilter, isActive: true }],
    queryFn:  () => productsService.getAll({ search, categoryId: catFilter || undefined, isActive: true, limit: 60 }),
    placeholderData: (p) => p,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn:  productsService.getCategories,
  });

  const { data: activeSession } = useQuery({
    queryKey: ['cash-active'],
    queryFn:  cashService.getActive,
  });


  const { data: payMethodsFromApi } = useQuery({
    queryKey: ['payment-methods'],
    queryFn:  () => salesService.getPaymentMethods(),
  });

  // Usar métodos de la API si cargaron, sino los defaults locales
  const payMethods = (payMethodsFromApi && payMethodsFromApi.length > 0)
    ? payMethodsFromApi
    : DEFAULT_PAY_METHODS;

  // Mutation crear venta
  const createMut = useMutation({
    mutationFn: salesService.create,
    onSuccess: (sale, variables) => {
      // Guardar recibo antes de limpiar carrito
      const payments = variables.tipoVenta === 'contado'
        ? (variables.payments ?? []).map((p: any) => ({
            methodId: p.paymentMethodId,
            nombre:   (payMethods ?? []).find((pm: { id: string; nombre: string }) => pm.id === p.paymentMethodId)?.nombre ?? '',
            monto:    String(p.monto),
          }))
        : [];
      setReceipt({
        id:        sale.id,
        fecha:     new Date(),
        customer:  customer,
        items:     [...cart],
        subtotal:  subtotalSinIgv,
        igv:       igvTotal,
        total:     total,
        payments,
        tipoVenta: variables.tipoVenta,
      });
      setCart([]);
      setCustomer(null);
      setPayModal(false);
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : (msg ?? 'Error al registrar la venta. Intenta de nuevo.'));
    },
  });

  // Carrito helpers
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.findIndex((i) => i.product.id === product.id);
      if (existing >= 0) {
        const copy = [...prev];
        const maxQty = Number(product.stockActual);
        copy[existing] = {
          ...copy[existing],
          cantidad: Math.min(copy[existing].cantidad + 1, maxQty),
        };
        return copy;
      }
      return [...prev, { product, cantidad: 1, precioUnitario: Number(product.precioVenta), descuento: 0, nota: undefined, esGratuito: false }];
    });
  }, []);

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const copy = [...prev];
      const item = copy[idx];
      const newQty = item.cantidad + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== idx);
      const maxQty = Number(item.product.stockActual);
      copy[idx] = { ...item, cantidad: Math.min(newQty, maxQty) };
      return copy;
    });
  };

  const removeItem = (idx: number) => setCart((p) => p.filter((_, i) => i !== idx));
  const clearCart  = () => { setCart([]); setCustomer(null); };

  const updateCartItem = (idx: number, changes: Partial<CartItem>) => {
    setCart((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...changes };
      return copy;
    });
  };

  // Totales
  const subtotalSinIgv = cart.reduce((a, i) => {
    const sub = i.cantidad * i.precioUnitario * (1 - i.descuento / 100);
    return a + (i.product.igvTipo === 'gravado' ? sub / (1 + IGV_RATE) : sub);
  }, 0);
  const igvTotal = cart.reduce((a, i) => {
    const sub = i.cantidad * i.precioUnitario * (1 - i.descuento / 100);
    return a + calcIgv(i.product, i.product.igvTipo === 'gravado' ? sub / (1 + IGV_RATE) : sub);
  }, 0);
  const total = cart.reduce((a, i) => a + i.cantidad * i.precioUnitario * (1 - i.descuento / 100), 0);

  const handleConfirmPay = (payments: PaymentLine[], tipoVenta: 'contado' | 'credito', _tipoDoc: 'nota' | 'boleta' | 'factura') => {
    createMut.mutate({
      customerId:    customer?.id,
      cashSessionId: activeSession?.id,
      tipoVenta,
      items: cart.map((i) => ({
        productId:      i.product.id,
        cantidad:       i.cantidad,
        precioUnitario: i.precioUnitario,
        descuento:      i.descuento,
      })),
      payments: tipoVenta === 'contado'
        ? payments.filter((p) => parseFloat(p.monto) > 0).map((p) => ({
            paymentMethodId: p.methodId,
            monto:           parseFloat(p.monto),
          }))
        : [],
    });
  };

  // Escáner: busca el producto por código y lo agrega al carrito
  const handleScan = useCallback((code: string) => {
    const allProducts = products?.data ?? [];
    const found = allProducts.find(
      (p) => p.codigoBarras === code || p.codigoInterno === code,
    );
    if (found) {
      addToCart(found);
      setScanError(null);
    } else {
      // Busca en la API si no está en la página actual
      productsService.getAll({ search: code, isActive: true, limit: 5 }).then((res) => {
        const match = res.data.find(
          (p) => p.codigoBarras === code || p.codigoInterno === code,
        );
        if (match) { addToCart(match); setScanError(null); }
        else setScanError(`No se encontró producto con código: ${code}`);
      });
    }
  }, [products, addToCart]);

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* ── Columna izquierda: productos ──────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 gap-3">
        {/* Buscador */}
        <div className="flex gap-2">
          <Input
            placeholder="Buscar producto o código..."
            icon={<Search size={15} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <button
            onClick={() => { setScanError(null); setScanModal(true); }}
            className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-blue-50 hover:border-blue-400 text-slate-500 hover:text-blue-600 transition-colors"
            title="Escanear código de barras"
          >
            <ScanLine size={18} />
          </button>
        </div>

        {/* Categorías */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCatFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              catFilter === '' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            Todos
          </button>
          {(categories ?? []).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCatFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                catFilter === cat.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
        {scanError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {scanError}
          </div>
        )}

        {/* Grid de productos */}
        <div className="flex-1 overflow-y-auto">
          {loadingProducts ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {products?.data.map((p) => (
                <ProductCard key={p.id} product={p} onAdd={addToCart} />
              ))}
              {products?.data.length === 0 && (
                <div className="col-span-full flex flex-col items-center py-16 text-slate-400 gap-2">
                  <Package size={32} />
                  <p className="text-sm">Sin productos encontrados</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Columna derecha: carrito ───────────────────────────────────── */}
      <div className="w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm flex-shrink-0">
        {/* Header carrito */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
            <ShoppingCart size={16} />
            Venta actual
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700">
              Limpiar
            </button>
          )}
        </div>

        {/* Cliente */}
        <button
          onClick={() => setCustModal(true)}
          className="flex items-center gap-2 mx-3 mt-3 px-3 py-2 rounded-lg border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm"
        >
          <User size={15} className="text-slate-400" />
          <span className={customer ? 'text-slate-800 font-medium' : 'text-slate-400'}>
            {customer ? customer.nombreCompleto : 'Consumidor Final'}
          </span>
        </button>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-2">
              <ShoppingCart size={28} />
              <p className="text-xs">El carrito está vacío</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={item.product.id} className="flex gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors">
                <button className="flex-1 min-w-0 text-left" onClick={() => setEditIdx(idx)}>
                  <p className="text-xs font-medium text-slate-800 line-clamp-2">{item.product.nombre}</p>
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">
                    {formatCurrency(item.precioUnitario)}
                    {item.descuento > 0 && <span className="ml-1 text-orange-500 font-normal">-{item.descuento}%</span>}
                    {item.esGratuito && <span className="ml-1 text-emerald-600 font-bold">CORTESÍA</span>}
                  </p>
                  {item.nota && <p className="text-xs text-slate-400 italic truncate">{item.nota}</p>}
                </button>
                <div className="flex flex-col items-end gap-1">
                  <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(idx, -1)} className="w-5 h-5 rounded flex items-center justify-center bg-slate-200 hover:bg-slate-300 text-slate-700">
                      <Minus size={10} />
                    </button>
                    <span className="text-xs font-bold text-slate-800 w-6 text-center">{item.cantidad}</span>
                    <button onClick={() => updateQty(idx, 1)} className="w-5 h-5 rounded flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-700">
                      <Plus size={10} />
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    {formatCurrency(item.cantidad * item.precioUnitario)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totales */}
        <div className="border-t border-slate-100 px-4 py-3 space-y-1 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotalSinIgv)}</span>
          </div>
          <div className="flex justify-between">
            <span>IGV (18%)</span>
            <span>{formatCurrency(igvTotal)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-800 pt-1 border-t border-slate-100">
            <span>Total</span>
            <span className="text-blue-700">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Botón pagar */}
        <div className="px-3 pb-4">
          <Button
            fullWidth
            size="lg"
            icon={<CreditCard size={17} />}
            disabled={cart.length === 0}
            onClick={() => setPayModal(true)}
          >
            Cobrar
          </Button>
        </div>
      </div>

      {/* ── Modales ───────────────────────────────────────────────────── */}
      <PayModal
        open={payModal}
        onClose={() => setPayModal(false)}
        total={total}
        cart={cart}
        paymentMethods={payMethods ?? []}
        onConfirm={handleConfirmPay}
        loading={createMut.isPending}
        customer={customer}
        onCustomerChange={setCustomer}
      />

      <CartItemEditModal
        item={editIdx >= 0 ? cart[editIdx] : null}
        idx={editIdx}
        onSave={updateCartItem}
        onRemove={removeItem}
        onClose={() => setEditIdx(-1)}
      />

      <CustomerModal
        open={custModal}
        onClose={() => setCustModal(false)}
        onSelect={setCustomer}
      />

      <ScannerModal
        open={scanModal}
        onClose={() => setScanModal(false)}
        onScan={handleScan}
      />

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
