import { useState, useEffect } from 'react';
import {
  Search, ChevronLeft, ChevronRight,
  Receipt, FileText, Eye, Printer,
} from 'lucide-react';
import api from '@/lib/api';

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtMoney = (v: number | string) =>
  `S/.${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};
const fmtDateTime = (d: string | Date) => {
  const dt = new Date(d);
  const h = dt.getHours(); const m = String(dt.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12;
  return `${fmtDate(dt)} ${String(h12).padStart(2, '0')}:${m} ${ampm}`;
};

interface Sale {
  id: string;
  fecha: string;
  total: number | string;
  subtotal: number | string;
  igv: number | string;
  estado: string;
  tipoVenta: string;
  observaciones?: string;
  customer?: { id: string; nombreCompleto: string; numeroDocumento: string } | null;
  user?: { nombre: string; apellido: string };
  payments?: { paymentMethod?: { nombre: string; tipo: string } }[];
  electronicDocuments: { id: string; tipo: string; numeroCompleto: string; estado: string; pdfUrl?: string }[];
}

// Genera e imprime un ticket básico
function printTicket(sale: Sale, businessName: string) {
  const items = (sale as any).items ?? [];
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>Ticket</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      body { font-family: 'Courier New', monospace; font-size: 10px; margin: 0; color: #000; }
      .c { text-align: center; } .b { font-weight: bold; }
      .hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 1px 0; vertical-align: top; }
      .tot { border-top: 1px solid #000; font-weight: bold; }
    </style></head><body>
    <p class="c b" style="font-size:1.2em">${businessName.toUpperCase()}</p>
    <hr class="hr"/>
    <p class="c b">TICKET DE VENTA</p>
    <p class="c">${fmtDateTime(sale.fecha)}</p>
    <hr class="hr"/>
    <p>Cliente : ${sale.customer?.nombreCompleto ?? 'VARIOS'}</p>
    <p>Cajero  : ${sale.user ? `${sale.user.nombre} ${sale.user.apellido}` : '—'}</p>
    <hr class="hr"/>
    <table>
      <tbody>
        ${items.map((it: any) =>
          `<tr><td>${it.descripcion ?? it.product?.nombre ?? ''}</td>
           <td style="text-align:right">${Number(it.cantidad)}x${Number(it.precioUnitario).toFixed(2)}</td>
           <td style="text-align:right">${Number(it.total).toFixed(2)}</td></tr>`
        ).join('')}
      </tbody>
    </table>
    <hr class="hr"/>
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">S/${Number(sale.subtotal).toFixed(2)}</td></tr>
      <tr><td>IGV 18%</td><td style="text-align:right">S/${Number(sale.igv).toFixed(2)}</td></tr>
      <tr class="tot"><td>TOTAL</td><td style="text-align:right">S/${Number(sale.total).toFixed(2)}</td></tr>
    </table>
    <hr class="hr"/>
    <p class="c" style="font-size:.85em">Gracias por su compra</p>
    <p class="c" style="font-size:.8em">Este ticket no tiene valor tributario</p>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
  win.document.close();
}

export default function SunatTicketsPage() {
  const [desde, setDesde]   = useState(todayStr());
  const [hasta, setHasta]   = useState(todayStr());
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const limit = 25;

  const [sales, setSales]       = useState<Sale[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [biz, setBiz]           = useState('Mi Negocio');

  // Cargar nombre del negocio
  useEffect(() => {
    api.get('/business/me').then((r) => {
      setBiz(r.data?.razonSocial ?? r.data?.nombre ?? 'Mi Negocio');
    }).catch(() => {});
  }, []);

  const fetchSales = async (p = page) => {
    setLoading(true); setError('');
    try {
      const params: Record<string, any> = { page: p, limit };
      if (desde) params.from   = desde;
      if (hasta) params.to     = hasta;
      if (search) params.search = search;
      const { data } = await api.get('/sales', { params });
      const all: Sale[] = data.data ?? [];
      // Tickets = ventas SIN documento electrónico
      const tickets = all.filter((s) => !s.electronicDocuments || s.electronicDocuments.length === 0);
      setSales(tickets);
      setTotal(tickets.length);
      setTotalPages(Math.ceil(tickets.length / limit) || 1);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al cargar tickets');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSales(1); setPage(1); }, [desde, hasta, search]);
  useEffect(() => { fetchSales(page); }, [page]);

  const totalMonto = sales
    .filter((s) => s.estado !== 'anulada')
    .reduce((a, s) => a + Number(s.total), 0);

  const [creatingDoc, setCreatingDoc] = useState<string | null>(null);
  const handleGenerarDoc = async (sale: Sale, tipo: 'boleta' | 'factura') => {
    setCreatingDoc(sale.id);
    try {
      await api.post('/documents/from-sale', { saleId: sale.id, tipo });
      fetchSales(page);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al generar el documento');
    } finally { setCreatingDoc(null); }
  };

  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Receipt size={17} className="text-indigo-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-800">Tickets de Venta</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ventas registradas <span className="font-semibold text-indigo-600">sin comprobante electrónico</span> (sin boleta ni factura emitida).
            Desde aquí puedes generar el documento oficial para SUNAT o imprimir el ticket interno.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Inicio</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white text-slate-700" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Fin</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 bg-white text-slate-700" />
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-1">Buscar cliente</span>
          <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-white">
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <input className="flex-1 text-sm outline-none placeholder:text-slate-400"
              placeholder="Nombre del cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-sm font-semibold text-slate-500">Total tickets:</span>
          <span className="text-sm font-bold text-indigo-700">{fmtMoney(totalMonto)}</span>
          <span className="text-xs text-slate-400">({total} venta{total !== 1 ? 's' : ''} sin comprobante)</span>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 text-sm">{error}</div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Receipt size={26} className="text-indigo-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">Sin tickets en este período</p>
            <p className="text-xs">Todas las ventas de este rango tienen comprobante electrónico.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-indigo-50/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Fecha / Hora</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Método pago</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Estado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Comprobante</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sales.map((sale) => {
                    const metodoPago = sale.payments?.[0]?.paymentMethod?.nombre ?? '—';
                    const isAnulada = sale.estado === 'anulada';
                    return (
                      <tr key={sale.id} className={`hover:bg-slate-50/50 transition-colors ${isAnulada ? 'opacity-50' : ''}`}>
                        <td className="px-5 py-3">
                          <div className="text-xs text-slate-700 whitespace-nowrap">{fmtDateTime(sale.fecha)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium text-slate-800 leading-tight">
                            {sale.customer?.nombreCompleto ?? 'Clientes Varios'}
                          </div>
                          {sale.customer?.numeroDocumento && (
                            <div className="text-[10px] text-slate-400 font-mono">{sale.customer.numeroDocumento}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                            {metodoPago}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            isAnulada
                              ? 'bg-red-100 text-red-600'
                              : sale.estado === 'pendiente_pago'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isAnulada ? 'Anulada' : sale.estado === 'pendiente_pago' ? 'Pend. pago' : 'Activa'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 text-xs whitespace-nowrap">
                          {fmtMoney(sale.total)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                              Sin doc.
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center items-center gap-1">
                            {!isAnulada && (
                              <>
                                {/* Generar boleta */}
                                <button
                                  disabled={creatingDoc === sale.id}
                                  onClick={() => handleGenerarDoc(sale, 'boleta')}
                                  title="Generar Boleta"
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold disabled:opacity-50"
                                >
                                  <FileText size={11} /> B
                                </button>
                                {/* Generar factura */}
                                <button
                                  disabled={creatingDoc === sale.id}
                                  onClick={() => handleGenerarDoc(sale, 'factura')}
                                  title="Generar Factura"
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold disabled:opacity-50"
                                >
                                  <FileText size={11} /> F
                                </button>
                              </>
                            )}
                            {/* Imprimir ticket interno */}
                            <button
                              onClick={() => printTicket(sale, biz)}
                              title="Imprimir ticket"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Printer size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">Página {page} de {totalPages} · {total} tickets</span>
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

      {/* Nota al pie */}
      {sales.length > 0 && (
        <div className="flex items-start gap-2 px-1 text-xs text-slate-400">
          <Eye size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            Los botones <span className="font-bold text-blue-600">B</span> y <span className="font-bold text-emerald-600">F</span> generan
            una boleta o factura electrónica para esa venta. El ícono de impresora genera un ticket interno sin valor tributario.
          </span>
        </div>
      )}
    </div>
  );
}
