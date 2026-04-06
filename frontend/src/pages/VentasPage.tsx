import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  User, CreditCard, CheckCircle, X, Package, ScanLine, Printer,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { productsService } from '@/services/products.service';
import { salesService } from '@/services/sales.service';
import { customersService } from '@/services/customers.service';
import { cashService } from '@/services/cash.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Product, Customer } from '@/types';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface CartItem {
  product:       Product;
  cantidad:      number;
  precioUnitario: number;
  descuento:     number;
}

interface PaymentLine {
  methodId: string;
  nombre:   string;
  monto:    string;
}

interface SaleReceipt {
  id:        string;
  fecha:     Date;
  customer:  { nombreCompleto: string } | null;
  items:     CartItem[];
  subtotal:  number;
  igv:       number;
  total:     number;
  payments:  PaymentLine[];
  tipoVenta: 'contado' | 'credito';
}

const IGV_RATE = 0.18;

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

// ─── Modal de confirmación de pago ───────────────────────────────────────────

interface PayModalProps {
  open:           boolean;
  onClose:        () => void;
  total:          number;
  cart:           CartItem[];
  paymentMethods: { id: string; nombre: string }[];
  onConfirm:      (payments: PaymentLine[], tipoVenta: 'contado' | 'credito') => void;
  loading:        boolean;
}

function PayModal({ open, onClose, total, cart, paymentMethods, onConfirm, loading }: PayModalProps) {
  const [tipoVenta, setTipoVenta] = useState<'contado' | 'credito'>('contado');
  const [payments, setPayments]   = useState<PaymentLine[]>([]);

  // Pre-cargar primer método cuando el modal abre O cuando llegan los métodos (carga async)
  useEffect(() => {
    if (!open) return;
    if (paymentMethods.length > 0 && payments.length === 0) {
      const m = paymentMethods[0];
      setPayments([{ methodId: m.id, nombre: m.nombre, monto: total.toFixed(2) }]);
    }
  }, [open, paymentMethods]);

  const addLine = () => {
    if (paymentMethods.length === 0) return;
    const m = paymentMethods[0];
    setPayments((p) => [...p, { methodId: m.id, nombre: m.nombre, monto: '' }]);
  };

  const updateLine = (i: number, field: keyof PaymentLine, value: string) => {
    setPayments((prev) => {
      const copy = [...prev];
      if (field === 'methodId') {
        const m = paymentMethods.find((m) => m.id === value);
        copy[i] = { ...copy[i], methodId: value, nombre: m?.nombre ?? '' };
      } else {
        (copy[i] as any)[field] = value;
      }
      return copy;
    });
  };

  const removeLine = (i: number) => setPayments((p) => p.filter((_, idx) => idx !== i));

  const totalPagado = payments.reduce((a, p) => a + (parseFloat(p.monto) || 0), 0);
  const vuelto      = totalPagado - total;
  const canPay      = tipoVenta === 'credito' || (payments.length > 0 && totalPagado >= total);

  const methodOptions = paymentMethods.map((m) => ({ value: m.id, label: m.nombre }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Procesar Pago"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => canPay && onConfirm(payments, tipoVenta)} loading={loading} disabled={!canPay} icon={<CheckCircle size={16} />}>
            Confirmar Venta
          </Button>
        </>
      }
    >
      <div className="flex gap-5">
        {/* Columna izquierda: productos */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Productos</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {cart.map((item) => (
              <div key={item.product.id} className="flex justify-between items-center text-sm py-1 border-b border-slate-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{item.product.nombre}</p>
                  <p className="text-xs text-slate-400">{formatCurrency(item.precioUnitario)} × {item.cantidad}</p>
                </div>
                <span className="font-semibold text-slate-700 ml-2">
                  {formatCurrency(item.cantidad * item.precioUnitario)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="flex justify-between text-base font-bold text-slate-800">
              <span>Total</span>
              <span className="text-blue-700">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Columna derecha: pago */}
        <div className="w-56 flex-shrink-0 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setTipoVenta('contado'); }}
              className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                tipoVenta === 'contado' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Contado
            </button>
            <button
              onClick={() => setTipoVenta('credito')}
              className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                tipoVenta === 'credito' ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Crédito
            </button>
          </div>

          {tipoVenta === 'contado' && (
            <>
              <div className="space-y-2">
                {payments.map((p, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex gap-1 items-center">
                      <Select
                        options={methodOptions}
                        value={p.methodId}
                        onChange={(e) => updateLine(i, 'methodId', e.target.value)}
                        className="flex-1 text-xs"
                      />
                      <button onClick={() => removeLine(i)} className="p-1.5 text-slate-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                    <Input
                      type="number" step="0.01" min="0"
                      placeholder="Monto S/"
                      value={p.monto}
                      onChange={(e) => updateLine(i, 'monto', e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={addLine}
                className="w-full text-xs py-1.5 border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-1"
              >
                <Plus size={12} /> Agregar método de pago
              </button>

              {payments.length > 0 && (
                <div className="pt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Recibido:</span>
                    <span className="font-medium">{formatCurrency(totalPagado)}</span>
                  </div>
                  <div className={`flex justify-between font-semibold ${vuelto >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    <span>{vuelto >= 0 ? 'Vuelto:' : 'Faltante:'}</span>
                    <span>{formatCurrency(Math.abs(vuelto))}</span>
                  </div>
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
    </Modal>
  );
}

// ─── Modal selección cliente ──────────────────────────────────────────────────

function CustomerModal({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void; onSelect: (c: Customer | null) => void;
}) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['customers-search', search],
    queryFn:  () => customersService.getAll({ search, limit: 20 }),
    enabled:  open,
  });

  return (
    <Modal open={open} onClose={onClose} title="Seleccionar Cliente" size="md">
      <div className="space-y-3">
        <Input
          placeholder="Buscar por nombre o documento..."
          icon={<Search size={15} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <button
          onClick={() => { onSelect(null); onClose(); }}
          className="w-full text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm text-slate-600 flex items-center gap-2"
        >
          <User size={15} className="text-slate-400" />
          Consumidor Final
        </button>

        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {data?.data.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelect(c); onClose(); }}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
              >
                <p className="text-sm font-medium text-slate-800">{c.nombreCompleto}</p>
                <p className="text-xs text-slate-500">{c.tipoDocumento}: {c.numeroDocumento}</p>
              </button>
            ))}
            {data?.data.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin resultados</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Modal comprobante ────────────────────────────────────────────────────────

function ReceiptModal({ receipt, onClose }: { receipt: SaleReceipt | null; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

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
        <div className="flex gap-2 w-full">
          <Button variant="outline" onClick={onClose} fullWidth>Nueva venta</Button>
          <Button icon={<Printer size={15} />} onClick={handlePrint} fullWidth>Imprimir</Button>
        </div>
      }
    >
      {/* Área imprimible */}
      <div ref={printRef} className="font-mono text-xs text-slate-800 space-y-1">
        <p className="title text-center font-bold text-sm">OZZO COFFEE</p>
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

  // Estado del carrito
  const [cart, setCart]         = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Modales
  const [payModal, setPayModal]     = useState(false);
  const [custModal, setCustModal]   = useState(false);
  const [scanModal, setScanModal]   = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [scanError, setScanError]   = useState<string | null>(null);

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

  const { data: payMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn:  () => salesService.getPaymentMethods(),
  });

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
      return [...prev, { product, cantidad: 1, precioUnitario: Number(product.precioVenta), descuento: 0 }];
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

  const handleConfirmPay = (payments: PaymentLine[], tipoVenta: 'contado' | 'credito') => {
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

  const catOptions = [
    { value: '', label: 'Todas' },
    ...(categories ?? []).map((c) => ({ value: c.id, label: c.nombre })),
  ];

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
          <Select
            options={catOptions}
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="w-40"
          />
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
              <div key={item.product.id} className="flex gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 line-clamp-2">{item.product.nombre}</p>
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">
                    {formatCurrency(item.precioUnitario)}
                  </p>
                </div>
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
