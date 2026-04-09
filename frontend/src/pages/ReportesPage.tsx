import { useState } from 'react';
import {
  FileSpreadsheet, FileText, Calendar,
  ShoppingCart, Package, DollarSign, FileCheck, CreditCard,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { currentMonthRange } from '@/lib/utils';
import api from '@/lib/api';

interface ReportDef {
  key:         string;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  color:       string;
  hasDateRange: boolean;
  excelPath?:  string;
  pdfPath?:    string;
}

const REPORTS: ReportDef[] = [
  {
    key:          'ventas',
    label:        'Ventas',
    description:  'Resumen diario y detalle completo de ventas. Incluye cliente, vendedor, método de pago e IGV.',
    icon:         <ShoppingCart size={22} />,
    color:        'bg-blue-50 text-blue-600',
    hasDateRange: true,
    excelPath:    '/reports/excel/ventas',
    pdfPath:      '/reports/pdf/ventas',
  },
  {
    key:          'inventario',
    label:        'Inventario',
    description:  'Stock actual de todos los productos con valorizado, precio de compra/venta y estado crítico.',
    icon:         <Package size={22} />,
    color:        'bg-emerald-50 text-emerald-600',
    hasDateRange: false,
    excelPath:    '/reports/excel/inventario',
    pdfPath:      '/reports/pdf/inventario',
  },
  {
    key:          'compras',
    label:        'Compras',
    description:  'Registro de compras a proveedores con estado de pago, IGV y totales.',
    icon:         <FileSpreadsheet size={22} />,
    color:        'bg-purple-50 text-purple-600',
    hasDateRange: true,
    excelPath:    '/reports/excel/compras',
  },
  {
    key:          'gastos',
    label:        'Gastos',
    description:  'Detalle de gastos por categoría con totales y porcentajes.',
    icon:         <DollarSign size={22} />,
    color:        'bg-red-50 text-red-600',
    hasDateRange: true,
    excelPath:    '/reports/excel/gastos',
    pdfPath:      '/reports/pdf/gastos',
  },
  {
    key:          'comprobantes',
    label:        'Comprobantes SUNAT',
    description:  'Estado de comprobantes electrónicos emitidos (boletas y facturas) con respuesta SUNAT.',
    icon:         <FileCheck size={22} />,
    color:        'bg-amber-50 text-amber-600',
    hasDateRange: true,
    pdfPath:      '/reports/pdf/comprobantes',
  },
  {
    key:          'cobranzas',
    label:        'Cobranzas',
    description:  'Historial de cobros registrados en ventas a crédito. Detalle de montos cobrados, saldos y métodos de pago.',
    icon:         <CreditCard size={22} />,
    color:        'bg-teal-50 text-teal-600',
    hasDateRange: true,
    excelPath:    '/reports/excel/cobranzas',
    pdfPath:      '/reports/pdf/cobranzas',
  },
];

async function downloadReport(path: string, params: Record<string, string>, filename: string) {
  try {
    const res = await api.get(path, { params, responseType: 'blob' });
    const blob = new Blob([res.data]);
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objUrl), 100);
  } catch {
    alert('Error al generar reporte');
  }
}

interface ReportCardProps {
  report:    ReportDef;
  from:      string;
  to:        string;
}

function ReportCard({ report, from, to }: ReportCardProps) {
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingPdf,   setLoadingPdf]   = useState(false);

  const handleDownload = async (type: 'excel' | 'pdf') => {
    const path = type === 'excel' ? report.excelPath : report.pdfPath;
    if (!path) return;
    const ext  = type === 'excel' ? 'xlsx' : 'pdf';
    const dateStr = report.hasDateRange ? `_${from}_${to}` : `_${new Date().toISOString().split('T')[0]}`;
    const filename = `${report.key}${dateStr}.${ext}`;
    const params: Record<string, string> = {};
    if (report.hasDateRange) { params.from = from; params.to = to; }

    if (type === 'excel') setLoadingExcel(true);
    else setLoadingPdf(true);

    try {
      await downloadReport(path, params, filename);
    } finally {
      setTimeout(() => {
        setLoadingExcel(false);
        setLoadingPdf(false);
      }, 1500);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${report.color}`}>
          {report.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800">{report.label}</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{report.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {report.excelPath && (
          <Button
            size="sm"
            variant="outline"
            icon={<FileSpreadsheet size={14} className="text-emerald-600" />}
            loading={loadingExcel}
            onClick={() => handleDownload('excel')}
            className="border-emerald-300 hover:bg-emerald-50 text-emerald-700"
          >
            Excel
          </Button>
        )}
        {report.pdfPath && (
          <Button
            size="sm"
            variant="outline"
            icon={<FileText size={14} className="text-red-500" />}
            loading={loadingPdf}
            onClick={() => handleDownload('pdf')}
            className="border-red-300 hover:bg-red-50 text-red-600"
          >
            PDF
          </Button>
        )}
        {!report.excelPath && !report.pdfPath && (
          <Badge variant="warning">Próximamente</Badge>
        )}
      </div>
    </Card>
  );
}

export default function ReportesPage() {
  const range = currentMonthRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo]     = useState(range.to);

  return (
    <div className="space-y-6">
      {/* Selector de rango global */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            <CardTitle>Período de los Reportes</CardTitle>
          </div>
          <p className="text-xs text-slate-500">Se aplica a reportes con rango de fechas</p>
        </CardHeader>
        <div className="flex flex-wrap gap-4 items-end">
          <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input label="Hasta" type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="w-40" />
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Hoy',         fn: () => { const d = new Date().toISOString().split('T')[0]; setFrom(d); setTo(d); } },
              { label: 'Esta semana', fn: () => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1); setFrom(mon.toISOString().split('T')[0]); setTo(now.toISOString().split('T')[0]); } },
              { label: 'Este mes',    fn: () => { setFrom(range.from); setTo(range.to); } },
            ].map(({ label, fn }) => (
              <button key={label} onClick={fn} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Grid de reportes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <ReportCard key={r.key} report={r} from={from} to={to} />
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Los reportes se generan en tiempo real con los datos actuales del sistema.
      </p>
    </div>
  );
}
