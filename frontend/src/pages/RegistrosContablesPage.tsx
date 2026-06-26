import { useState } from 'react';
import {
  BookOpen, FileSpreadsheet, FileText, Calendar,
  ShoppingCart, ChevronDown, ChevronUp, Info,
  Download, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtS = (v: number) =>
  `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// Tipo SUNAT codes (para mostrar en Excel con etiqueta legible)
const TIPO_COMP_LABEL: Record<string, string> = {
  '01': 'Factura', '03': 'Boleta', '07': 'N. Crédito', '08': 'N. Débito', '00': 'Otros',
};

// ── PLE generation helpers ────────────────────────────────────────────────────

// Genera texto PLE pipe-delimited y lo descarga como .txt
function downloadPle(rows: Record<string, string>[], fields: string[], filename: string) {
  const lines = rows.map((r) => fields.map((f) => r[f] ?? '').join('|') + '|');
  const content = lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

// Genera Excel CSV con cabeceras legibles
function downloadExcelCsv(headers: string[], rows: Record<string, string>[], fields: string[], filename: string) {
  const csvRows = [
    headers.join(','),
    ...rows.map((r) => fields.map((f) => {
      const v = r[f] ?? '';
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')),
  ];
  const csv = '﻿' + csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

// ── PLE fields ────────────────────────────────────────────────────────────────

const PLE_VENTAS_FIELDS = [
  'periodo','cuo','correlativoAsiento','fechaEmision','fechaVencimiento',
  'tipoComprobante','serie','numero','tipoDocIdentidad','numDocIdentidad','nombre',
  'exportacion','baseGravada','descuento','igv','baseInafecta','baseExonerada',
  'isc','icbper','ivap','otrosTributos','total','tipoCambio',
  'fechaCompRef','tipoCompRef','serieRef','numeroRef','estado',
];

const PLE_VENTAS_HEADERS = [
  'Período','CUO','Corr. Asiento','Fecha Emisión','Fecha Venc.',
  'Tipo Comp.','Serie','Número','Tipo Doc.','N° Identidad','Cliente',
  'Export.','Base Gravada','Descuento','IGV','Base Inafecta','Base Exonerada',
  'ISC','ICBPER','IVAP','Otros Tributos','Total','T. Cambio',
  'Fecha Ref.','Tipo Comp. Ref.','Serie Ref.','N° Ref.','Estado',
];

const PLE_COMPRAS_FIELDS = [
  'periodo','cuo','correlativoAsiento','fechaEmision','fechaVencimiento',
  'tipoComprobante','serie','anio','numero','tipoDocProveedor','numDocProveedor','nombreProveedor',
  'baseGravada','igv','baseNoGravada','igvNoGravado','baseInafecta',
  'isc','icbper','ivap','otrosTributos','total','moneda','tipoCambio',
  'fechaCompRef','tipoCompRef','numeroRef','estado',
];

const PLE_COMPRAS_HEADERS = [
  'Período','CUO','Corr. Asiento','Fecha Emisión','Fecha Venc.',
  'Tipo Comp.','Serie','Año DUA','Número','Tipo Doc.','RUC Proveedor','Proveedor',
  'Base Gravada','IGV','Base No Grav.','IGV No Grav.','Base Inafecta',
  'ISC','ICBPER','IVAP','Otros Tributos','Total','Moneda','T. Cambio',
  'Fecha Ref.','Tipo Comp. Ref.','N° Ref.','Estado',
];

// ── MonthYearPicker ───────────────────────────────────────────────────────────

function MonthYearPicker({
  year, month, onYear, onMonth,
}: { year: number; month: number; onYear(y: number): void; onMonth(m: number): void }) {
  return (
    <div className="flex items-center gap-2">
      <select value={month} onChange={(e) => onMonth(Number(e.target.value))}
        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400 bg-white">
        {MESES_ES.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
      </select>
      <select value={year} onChange={(e) => onYear(Number(e.target.value))}
        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400 bg-white">
        {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

// ── Card shell ────────────────────────────────────────────────────────────────

function ActionCard({ icon, title, subtitle, color, children }: {
  icon: React.ReactNode; title: string; subtitle: string;
  color: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── RegistrosContablesPage ────────────────────────────────────────────────────

export default function RegistrosContablesPage() {

  // ── Registro Ventas ──
  const [rvYear,    setRvYear]    = useState(currentYear);
  const [rvMonth,   setRvMonth]   = useState(currentMonth);
  const [rvLoading, setRvLoading] = useState(false);
  const [rvTotales, setRvTotales] = useState<any>(null);

  const fetchAndExportVentas = async (format: 'excel' | 'ple') => {
    setRvLoading(true);
    try {
      const { data } = await api.get('/reports/ple-ventas', { params: { year: rvYear, month: rvMonth } });
      setRvTotales(data.totales);
      const periodo = `${rvYear}${String(rvMonth).padStart(2, '0')}`;
      if (format === 'ple') {
        downloadPle(data.rows, PLE_VENTAS_FIELDS, `LE_RV_${periodo}.txt`);
      } else {
        const rows = (data.rows as Record<string, string>[]).map((r) => ({
          ...r,
          tipoComprobante: `${r.tipoComprobante} - ${TIPO_COMP_LABEL[r.tipoComprobante] ?? r.tipoComprobante}`,
          estado: r.estado === '9' ? 'ANULADO' : 'ACTIVO',
        }));
        downloadExcelCsv(PLE_VENTAS_HEADERS, rows, PLE_VENTAS_FIELDS, `RegistroVentas_${periodo}.csv`);
      }
    } catch { /* swallow */ }
    finally { setRvLoading(false); }
  };

  // ── Ventas Anuales ──
  const [vaYear,    setVaYear]    = useState(currentYear);
  const [vaData,    setVaData]    = useState<any[]>([]);
  const [vaTotal,   setVaTotal]   = useState(0);
  const [vaLoading, setVaLoading] = useState(false);
  const [vaOpen,    setVaOpen]    = useState(false);

  const fetchVentasAnuales = async () => {
    setVaLoading(true);
    try {
      const { data } = await api.get('/reports/ventas-anuales', { params: { year: vaYear } });
      setVaData(data.meses ?? []);
      setVaTotal(data.totalAnual ?? 0);
      setVaOpen(true);
    } catch { /* swallow */ }
    finally { setVaLoading(false); }
  };

  // ── Registro Compras ──
  const [rcYear,    setRcYear]    = useState(currentYear);
  const [rcMonth,   setRcMonth]   = useState(currentMonth);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcTotales, setRcTotales] = useState<any>(null);

  const fetchAndExportCompras = async (format: 'excel' | 'ple') => {
    setRcLoading(true);
    try {
      const { data } = await api.get('/reports/ple-compras', { params: { year: rcYear, month: rcMonth } });
      setRcTotales(data.totales);
      const periodo = `${rcYear}${String(rcMonth).padStart(2, '0')}`;
      if (format === 'ple') {
        downloadPle(data.rows, PLE_COMPRAS_FIELDS, `LE_RC_${periodo}.txt`);
      } else {
        downloadExcelCsv(PLE_COMPRAS_HEADERS, data.rows, PLE_COMPRAS_FIELDS, `RegistroCompras_${periodo}.csv`);
      }
    } catch { /* swallow */ }
    finally { setRcLoading(false); }
  };

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <BookOpen size={20} className="text-blue-700" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-800">Registros contables</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Exportación de registros de ventas y compras por periodo tributario.
          </p>
        </div>
      </div>

      {/* Info banner legal */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3 flex items-start gap-3">
        <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">Formato SUNAT PLE (Programa de Libros Electrónicos):</span>{' '}
          El archivo <span className="font-mono">.txt</span> sigue el formato oficial de SUNAT (pipe-delimited) listo para importar al validador PLE.
          El <span className="font-mono">.csv</span> es para uso del contador con columnas legibles.
          Los tipos de comprobante usan los códigos oficiales: 01=Factura, 03=Boleta, 07=N.Crédito, 08=N.Débito.
        </p>
      </div>

      {/* 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ── Registro de Ventas ── */}
        <ActionCard
          icon={<FileSpreadsheet size={22} className="text-emerald-600" />}
          title="Registro de ventas"
          subtitle="Exporta un mes seleccionado."
          color="bg-emerald-50"
        >
          <MonthYearPicker year={rvYear} month={rvMonth} onYear={setRvYear} onMonth={setRvMonth} />

          {rvTotales && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {rvTotales.ventas} registros
              </span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                Total {fmtS(rvTotales.total)}
              </span>
              <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                IGV {fmtS(rvTotales.igv)}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => fetchAndExportVentas('excel')}
              disabled={rvLoading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 transition-colors"
            >
              {rvLoading ? <RefreshCw size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
              EXCEL
            </button>
            <button
              onClick={() => fetchAndExportVentas('ple')}
              disabled={rvLoading}
              className="flex-1 flex items-center justify-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 transition-colors"
            >
              <Download size={12} />
              PLE .txt
            </button>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            PLE 14.1 · Resolución RS 379-2013-SUNAT. Incluye boletas, facturas y notas de crédito.
          </p>
        </ActionCard>

        {/* ── Ventas Anuales ── */}
        <ActionCard
          icon={<Calendar size={22} className="text-blue-600" />}
          title="Ventas anuales"
          subtitle="Consulta y consolida mes por mes."
          color="bg-blue-50"
        >
          <div className="flex items-center gap-2">
            <select value={vaYear} onChange={(e) => setVaYear(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400 bg-white flex-1">
              {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={fetchVentasAnuales} disabled={vaLoading}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-colors">
              {vaLoading ? <RefreshCw size={12} className="animate-spin" /> : <FileText size={12} />}
              VER
            </button>
          </div>

          {vaData.length > 0 && (
            <>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2 text-slate-500 font-semibold">Mes</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-semibold">Ventas</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {vaData.map((m: any) => (
                      <tr key={m.mes} className={`hover:bg-slate-50/50 ${m.total === 0 ? 'opacity-40' : ''}`}>
                        <td className="px-3 py-1.5 font-medium text-slate-700">{m.mesNombre}</td>
                        <td className="px-3 py-1.5 text-right text-slate-500">{m.ventas}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-slate-800">{fmtS(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td className="px-3 py-2 font-bold text-slate-700">TOTAL {vaYear}</td>
                      <td />
                      <td className="px-3 py-2 text-right font-bold text-blue-700">{fmtS(vaTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <button
                onClick={() => setVaOpen((p) => !p)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors self-start"
              >
                {vaOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {vaOpen ? 'Ocultar' : 'Mostrar'} tabla
              </button>
            </>
          )}

          {vaData.length === 0 && !vaLoading && (
            <p className="text-xs text-slate-400 text-center py-4">
              Selecciona el año y pulsa VER
            </p>
          )}
        </ActionCard>

        {/* ── Registro de Compras ── */}
        <ActionCard
          icon={<ShoppingCart size={22} className="text-red-500" />}
          title="Registro de compras"
          subtitle="Exporta compras de un mes."
          color="bg-red-50"
        >
          <MonthYearPicker year={rcYear} month={rcMonth} onYear={setRcYear} onMonth={setRcMonth} />

          {rcTotales && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {rcTotales.compras} registros
              </span>
              <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                Total {fmtS(rcTotales.total)}
              </span>
              <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                IGV {fmtS(rcTotales.igv)}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => fetchAndExportCompras('excel')}
              disabled={rcLoading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 transition-colors"
            >
              {rcLoading ? <RefreshCw size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
              EXCEL
            </button>
            <button
              onClick={() => fetchAndExportCompras('ple')}
              disabled={rcLoading}
              className="flex-1 flex items-center justify-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 transition-colors"
            >
              <Download size={12} />
              PLE .txt
            </button>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            PLE 8.1 · Incluye tipo de comprobante, RUC proveedor, base imponible e IGV separados.
          </p>
        </ActionCard>

      </div>

      {/* Feature badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { icon: <FileSpreadsheet size={13} />, label: 'Ventas con notas de crédito', color: 'border-emerald-300 text-emerald-700 bg-emerald-50' },
          { icon: <RefreshCw size={13} />,       label: 'Proceso por lotes',           color: 'border-blue-300 text-blue-700 bg-blue-50' },
          { icon: <FileText size={13} />,        label: 'XLSX optimizado',             color: 'border-slate-300 text-slate-600 bg-white' },
        ].map(({ icon, label, color }) => (
          <span key={label} className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
            {icon} {label}
          </span>
        ))}
      </div>

    </div>
  );
}
