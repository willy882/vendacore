import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

// ─── Excel helpers ───────────────────────────────────────────────────────────

const BRAND = '1E40AF';
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BRAND },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true, color: { argb: 'FFFFFFFF' }, size: 11,
};
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, bottom: { style: 'thin' },
  left: { style: 'thin' }, right: { style: 'thin' },
};

function applyTableHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.border = BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  row.height = 22;
}

function applyDataRow(row: ExcelJS.Row, alt: boolean) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = BORDER;
    if (alt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
    cell.alignment = { vertical: 'middle' };
  });
  row.height = 18;
}

function addWorkbookMeta(wb: ExcelJS.Workbook, title: string, businessName: string) {
  wb.creator = 'VendaCore'; wb.created = new Date(); wb.modified = new Date();
  wb.title = `${title} — ${businessName}`;
}

// ─── PDF helpers ─────────────────────────────────────────────────────────────

/** Genera un PDF en memoria y retorna el Buffer completo */
async function buildPdf(
  options: PDFKit.PDFDocumentOptions,
  build: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument(options);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      build(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function addPdfHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  businessName: string,
  from?: string,
  to?: string,
) {
  const pageW = doc.page.width;
  doc.rect(0, 0, pageW, 70).fill('#1E40AF');
  doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
    .text('VendaCore', 40, 16, { lineBreak: false });
  doc.fontSize(10).font('Helvetica')
    .text(title, 40, 44, { lineBreak: false });
  doc.fontSize(8).font('Helvetica')
    .text(businessName, 0, 16, { align: 'right', width: pageW - 40, lineBreak: false });
  if (from && to) {
    doc.fillColor('#BFDBFE').fontSize(7)
      .text(`Período: ${from} — ${to}`, 0, 30, { align: 'right', width: pageW - 40, lineBreak: false });
  }
  // Avanzar el cursor por debajo del header
  doc.fillColor('#000000').font('Helvetica').fontSize(10);
  doc.y = 90;
}

function addPdfFooter(doc: PDFKit.PDFDocument) {
  const pageW = doc.page.width;
  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(pageW - 40, doc.y).strokeColor('#E2E8F0').stroke();
  doc.moveDown(0.4);
  doc.fontSize(7).fillColor('#94A3B8').font('Helvetica')
    .text(`Generado: ${new Date().toLocaleString('es-PE')} | VendaCore`, { align: 'center' });
}

function pdfTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: (string | number)[][],
  colWidths: number[],
) {
  const startX = 40;
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const rowH   = 20;
  const pageH  = doc.page.height;
  const margin = 50; // espacio reservado para footer
  let y = doc.y + 4;

  // ── Cabecera de tabla ──
  doc.rect(startX, y, tableW, rowH).fill('#1E40AF');
  let x = startX;
  headers.forEach((h, i) => {
    doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
      .text(h, x + 4, y + 5, { width: colWidths[i] - 8, lineBreak: false });
    x += colWidths[i];
  });
  y += rowH;

  // ── Sin datos ──
  if (rows.length === 0) {
    doc.rect(startX, y, tableW, rowH).fill('#F8FAFC');
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica')
      .text('Sin datos en el período seleccionado', startX + 4, y + 5, {
        width: tableW - 8, lineBreak: false,
      });
    y += rowH;
    doc.y = y + 8;
    return;
  }

  // ── Filas ──
  rows.forEach((row, ri) => {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = 50;
      // Repetir cabecera en nueva página
      doc.rect(startX, y, tableW, rowH).fill('#1E40AF');
      x = startX;
      headers.forEach((h, i) => {
        doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
          .text(h, x + 4, y + 5, { width: colWidths[i] - 8, lineBreak: false });
        x += colWidths[i];
      });
      y += rowH;
    }
    const bg = ri % 2 === 0 ? '#FFFFFF' : '#EFF6FF';
    doc.rect(startX, y, tableW, rowH).fill(bg);
    x = startX;
    row.forEach((cell, i) => {
      doc.fillColor('#1E293B').fontSize(8).font('Helvetica')
        .text(String(cell), x + 4, y + 5, { width: colWidths[i] - 8, lineBreak: false });
      x += colWidths[i];
    });
    y += rowH;
  });

  doc.y = y + 8;
}

// ══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ── Helpers de datos ──────────────────────────────────────────────────────

  private async getBusinessName(businessId: string) {
    const b = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { razonSocial: true, ruc: true },
    });
    return b ? `${b.razonSocial} (RUC: ${b.ruc})` : 'VendaCore';
  }

  async getSalesData(businessId: string, from: Date, to: Date) {
    return this.prisma.sale.findMany({
      where: { businessId, estado: 'activa', fecha: { gte: from, lte: to } },
      include: {
        customer: { select: { nombreCompleto: true, numeroDocumento: true } },
        user:     { select: { nombre: true, apellido: true } },
        items:    { include: { product: { select: { nombre: true } } } },
        payments: { include: { paymentMethod: { select: { nombre: true } } } },
        electronicDocuments: { select: { numeroCompleto: true }, take: 1 },
      },
      orderBy: { fecha: 'asc' },
    });
  }

  async getInventoryData(businessId: string) {
    return this.prisma.product.findMany({
      where: { businessId, isActive: true },
      include: { category: { select: { nombre: true } } },
      orderBy: [{ category: { nombre: 'asc' } }, { nombre: 'asc' }],
    });
  }

  async getPurchasesData(businessId: string, from: Date, to: Date) {
    return this.prisma.purchase.findMany({
      where: { businessId, fecha: { gte: from, lte: to } },
      include: {
        supplier: { select: { razonSocial: true } },
        user:     { select: { nombre: true, apellido: true } },
        items:    { include: { product: { select: { nombre: true } } } },
      },
      orderBy: { fecha: 'asc' },
    });
  }

  async getExpensesData(businessId: string, from: Date, to: Date) {
    return this.prisma.expense.findMany({
      where: { businessId, fecha: { gte: from, lte: to } },
      include: { category: { select: { nombre: true } } },
      orderBy: { fecha: 'asc' },
    });
  }

  async getDocumentsData(businessId: string, from: Date, to: Date) {
    return this.prisma.electronicDocument.findMany({
      where: { businessId, createdAt: { gte: from, lte: to } },
      include: {
        sale: { select: { fecha: true } },
        customer: { select: { nombreCompleto: true, numeroDocumento: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── EXCEL: Ventas ─────────────────────────────────────────────────────────

  async exportSalesExcel(businessId: string, from: Date, to: Date, res: Response) {
    const [sales, businessName] = await Promise.all([
      this.getSalesData(businessId, from, to),
      this.getBusinessName(businessId),
    ]);

    const wb = new ExcelJS.Workbook();
    addWorkbookMeta(wb, 'Reporte de Ventas', businessName);

    // Hoja 1: Resumen por día
    const wsResumen = wb.addWorksheet('Resumen por Día');
    wsResumen.mergeCells('A1:F1');
    wsResumen.getCell('A1').value = `REPORTE DE VENTAS — ${businessName}`;
    wsResumen.getCell('A1').font  = { bold: true, size: 13, color: { argb: 'FF1E40AF' } };
    wsResumen.getCell('A1').alignment = { horizontal: 'center' };
    wsResumen.mergeCells('A2:F2');
    wsResumen.getCell('A2').value = `Período: ${fmtDate(from)} al ${fmtDate(to)}`;
    wsResumen.getCell('A2').alignment = { horizontal: 'center' };
    wsResumen.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };

    wsResumen.columns = [
      { key: 'dia',   header: 'Fecha',          width: 14 },
      { key: 'cant',  header: 'N° Ventas',       width: 12 },
      { key: 'sub',   header: 'Subtotal (S/)',   width: 16 },
      { key: 'igv',   header: 'IGV (S/)',         width: 14 },
      { key: 'desc',  header: 'Descuentos (S/)', width: 16 },
      { key: 'total', header: 'Total (S/)',       width: 16 },
    ];

    const byDay: Record<string, { cant: number; sub: number; igv: number; desc: number; total: number }> = {};
    for (const s of sales) {
      const d = fmtDate(s.fecha);
      if (!byDay[d]) byDay[d] = { cant: 0, sub: 0, igv: 0, desc: 0, total: 0 };
      byDay[d].cant++;
      byDay[d].sub   += Number(s.subtotal ?? 0);
      byDay[d].igv   += Number(s.igv ?? 0);
      byDay[d].desc  += Number(s.descuentoTotal ?? 0);
      byDay[d].total += Number(s.total);
    }

    applyTableHeader(wsResumen.getRow(3));
    wsResumen.getRow(3).values = ['Fecha', 'N° Ventas', 'Subtotal (S/)', 'IGV (S/)', 'Descuentos (S/)', 'Total (S/)'];

    let ri = 4;
    const totales = { cant: 0, sub: 0, igv: 0, desc: 0, total: 0 };
    for (const [dia, v] of Object.entries(byDay)) {
      const row = wsResumen.getRow(ri++);
      row.values = [dia, v.cant, fmt(v.sub), fmt(v.igv), fmt(v.desc), fmt(v.total)];
      applyDataRow(row, ri % 2 === 0);
      totales.cant  += v.cant;
      totales.sub   += v.sub;
      totales.igv   += v.igv;
      totales.desc  += v.desc;
      totales.total += v.total;
    }

    const totalRow = wsResumen.getRow(ri);
    totalRow.values = ['TOTAL', totales.cant, fmt(totales.sub), fmt(totales.igv), fmt(totales.desc), fmt(totales.total)];
    totalRow.eachCell((cell) => {
      cell.font   = { bold: true };
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.border = BORDER;
    });

    // Hoja 2: Detalle
    const wsDetalle = wb.addWorksheet('Detalle de Ventas');
    wsDetalle.columns = [
      { key: 'n',          header: 'N°',            width: 6  },
      { key: 'fecha',      header: 'Fecha',          width: 14 },
      { key: 'comprobante',header: 'Comprobante',    width: 16 },
      { key: 'cliente',    header: 'Cliente',        width: 28 },
      { key: 'doc',        header: 'Doc. Cliente',   width: 14 },
      { key: 'vendedor',   header: 'Vendedor',       width: 22 },
      { key: 'tipoVenta',  header: 'Tipo Venta',     width: 12 },
      { key: 'sub',        header: 'Subtotal',       width: 12 },
      { key: 'igv',        header: 'IGV',            width: 10 },
      { key: 'desc',       header: 'Descuento',      width: 12 },
      { key: 'total',      header: 'Total',          width: 12 },
    ];
    applyTableHeader(wsDetalle.getRow(1));

    sales.forEach((s, idx) => {
      const row = wsDetalle.addRow({
        n:           idx + 1,
        fecha:       fmtDate(s.fecha),
        comprobante: s.electronicDocuments?.[0]?.numeroCompleto ?? '—',
        cliente:     s.customer?.nombreCompleto ?? 'Consumidor Final',
        doc:         s.customer?.numeroDocumento ?? '—',
        vendedor:    s.user ? `${s.user.nombre} ${s.user.apellido}` : '—',
        tipoVenta:   s.tipoVenta,
        sub:         fmt(Number(s.subtotal ?? 0)),
        igv:         fmt(Number(s.igv ?? 0)),
        desc:        fmt(Number(s.descuentoTotal ?? 0)),
        total:       fmt(Number(s.total)),
      });
      applyDataRow(row, idx % 2 !== 0);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="ventas_${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }

  // ── EXCEL: Inventario ─────────────────────────────────────────────────────

  async exportInventoryExcel(businessId: string, res: Response) {
    const [products, businessName] = await Promise.all([
      this.getInventoryData(businessId),
      this.getBusinessName(businessId),
    ]);

    const wb = new ExcelJS.Workbook();
    addWorkbookMeta(wb, 'Reporte de Inventario', businessName);
    const ws = wb.addWorksheet('Inventario');

    ws.mergeCells('A1:I1');
    ws.getCell('A1').value = `INVENTARIO — ${businessName}`;
    ws.getCell('A1').font  = { bold: true, size: 13, color: { argb: 'FF1E40AF' } };
    ws.getCell('A1').alignment = { horizontal: 'center' };
    ws.mergeCells('A2:I2');
    ws.getCell('A2').value = `Generado: ${fmtDate(new Date())}`;
    ws.getCell('A2').alignment = { horizontal: 'center' };
    ws.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };

    ws.columns = [
      { key: 'cod',        header: 'Código',           width: 14 },
      { key: 'nombre',     header: 'Producto',          width: 32 },
      { key: 'cat',        header: 'Categoría',         width: 18 },
      { key: 'stock',      header: 'Stock Actual',      width: 14 },
      { key: 'min',        header: 'Stock Mínimo',      width: 14 },
      { key: 'estado',     header: 'Estado',            width: 12 },
      { key: 'costo',      header: 'Costo Unit. (S/)',  width: 16 },
      { key: 'precio',     header: 'Precio Vta (S/)',   width: 16 },
      { key: 'valorizado', header: 'Valorizado (S/)',   width: 16 },
    ];

    applyTableHeader(ws.getRow(3));

    let totalValorizado = 0;
    products.forEach((p, idx) => {
      const stock      = Number(p.stockActual);
      const costo      = Number(p.precioCompra ?? 0);
      const valorizado = stock * costo;
      totalValorizado += valorizado;
      const critico = stock <= Number(p.stockMinimo);
      const row = ws.addRow({
        cod:        p.codigoInterno ?? '—',
        nombre:     p.nombre,
        cat:        p.category?.nombre ?? '—',
        stock,
        min:        Number(p.stockMinimo),
        estado:     critico ? 'CRÍTICO' : 'Normal',
        costo:      fmt(costo),
        precio:     fmt(Number(p.precioVenta)),
        valorizado: fmt(valorizado),
      });
      applyDataRow(row, idx % 2 !== 0);
      if (critico) row.getCell('estado').font = { bold: true, color: { argb: 'FFEF4444' } };
    });

    const totalRow = ws.addRow({
      cod: '', nombre: 'TOTAL VALORIZADO', cat: '', stock: '', min: '', estado: '',
      costo: '', precio: '', valorizado: fmt(totalValorizado),
    });
    totalRow.eachCell((cell) => {
      cell.font   = { bold: true };
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.border = BORDER;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="inventario_${new Date().toISOString().split('T')[0]}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }

  // ── EXCEL: Compras ────────────────────────────────────────────────────────

  async exportPurchasesExcel(businessId: string, from: Date, to: Date, res: Response) {
    const [purchases, businessName] = await Promise.all([
      this.getPurchasesData(businessId, from, to),
      this.getBusinessName(businessId),
    ]);

    const wb = new ExcelJS.Workbook();
    addWorkbookMeta(wb, 'Reporte de Compras', businessName);
    const ws = wb.addWorksheet('Compras');

    ws.columns = [
      { key: 'n',         header: 'N°',             width: 6  },
      { key: 'fecha',     header: 'Fecha',           width: 14 },
      { key: 'proveedor', header: 'Proveedor',       width: 30 },
      { key: 'doc',       header: 'N° Documento',    width: 16 },
      { key: 'tipo',      header: 'Tipo Doc.',        width: 12 },
      { key: 'subtotal',  header: 'Subtotal (S/)',   width: 14 },
      { key: 'igv',       header: 'IGV (S/)',         width: 12 },
      { key: 'total',     header: 'Total (S/)',       width: 14 },
      { key: 'estado',    header: 'Estado Pago',     width: 14 },
      { key: 'usuario',   header: 'Registrado por',  width: 22 },
    ];
    applyTableHeader(ws.getRow(1));

    let grandTotal = 0;
    purchases.forEach((p, idx) => {
      const row = ws.addRow({
        n:         idx + 1,
        fecha:     fmtDate(p.fecha),
        proveedor: p.supplier.razonSocial,
        doc:       p.numeroDocumento ?? '—',
        tipo:      p.tipoDocumento ?? '—',
        subtotal:  fmt(Number(p.subtotal)),
        igv:       fmt(Number(p.igv)),
        total:     fmt(Number(p.total)),
        estado:    p.estadoPago,
        usuario:   p.user ? `${p.user.nombre} ${p.user.apellido}` : '—',
      });
      applyDataRow(row, idx % 2 !== 0);
      grandTotal += Number(p.total);
      if (p.estadoPago === 'pendiente')
        row.getCell('estado').font = { bold: true, color: { argb: 'FFEF4444' } };
      else if (p.estadoPago === 'parcial')
        row.getCell('estado').font = { bold: true, color: { argb: 'FFF59E0B' } };
    });

    const totalRow = ws.addRow({
      n: '', fecha: '', proveedor: `TOTAL (${purchases.length} compras)`,
      doc: '', tipo: '', subtotal: '', igv: '',
      total: fmt(grandTotal), estado: '', usuario: '',
    });
    totalRow.eachCell((cell) => {
      cell.font   = { bold: true };
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.border = BORDER;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="compras_${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }

  // ── EXCEL: Gastos ─────────────────────────────────────────────────────────

  async exportExpensesExcel(businessId: string, from: Date, to: Date, res: Response) {
    const [expenses, businessName] = await Promise.all([
      this.getExpensesData(businessId, from, to),
      this.getBusinessName(businessId),
    ]);

    const wb = new ExcelJS.Workbook();
    addWorkbookMeta(wb, 'Reporte de Gastos', businessName);

    // Hoja 1: Detalle
    const wsDetalle = wb.addWorksheet('Detalle');
    wsDetalle.columns = [
      { key: 'n',           header: 'N°',          width: 6  },
      { key: 'fecha',       header: 'Fecha',        width: 14 },
      { key: 'cat',         header: 'Categoría',    width: 22 },
      { key: 'descripcion', header: 'Descripción',  width: 34 },
      { key: 'monto',       header: 'Monto (S/)',   width: 14 },
      { key: 'observ',      header: 'Observaciones',width: 28 },
    ];
    applyTableHeader(wsDetalle.getRow(1));

    let total = 0;
    expenses.forEach((e, idx) => {
      const row = wsDetalle.addRow({
        n:           idx + 1,
        fecha:       fmtDate(e.fecha),
        cat:         e.category?.nombre ?? 'Sin categoría',
        descripcion: e.descripcion,
        monto:       fmt(Number(e.monto)),
        observ:      e.observaciones ?? '—',
      });
      applyDataRow(row, idx % 2 !== 0);
      total += Number(e.monto);
    });

    const totalRow = wsDetalle.addRow({
      n: '', fecha: '', cat: '', descripcion: `TOTAL (${expenses.length} gastos)`,
      monto: fmt(total), observ: '',
    });
    totalRow.eachCell((cell) => {
      cell.font   = { bold: true };
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      cell.border = BORDER;
    });

    // Hoja 2: Por categoría
    const wsCat = wb.addWorksheet('Por Categoría');
    wsCat.columns = [
      { key: 'cat',   header: 'Categoría',  width: 28 },
      { key: 'cant',  header: 'Cantidad',   width: 12 },
      { key: 'monto', header: 'Total (S/)', width: 16 },
      { key: 'pct',   header: '% del Total',width: 14 },
    ];
    applyTableHeader(wsCat.getRow(1));

    const byCat: Record<string, { cant: number; monto: number }> = {};
    for (const e of expenses) {
      const cat = e.category?.nombre ?? 'Sin categoría';
      if (!byCat[cat]) byCat[cat] = { cant: 0, monto: 0 };
      byCat[cat].cant++;
      byCat[cat].monto += Number(e.monto);
    }

    Object.entries(byCat)
      .sort((a, b) => b[1].monto - a[1].monto)
      .forEach(([cat, v], idx) => {
        const row = wsCat.addRow({
          cat,
          cant:  v.cant,
          monto: fmt(v.monto),
          pct:   `${total > 0 ? ((v.monto / total) * 100).toFixed(1) : '0.0'}%`,
        });
        applyDataRow(row, idx % 2 !== 0);
      });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="gastos_${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }

  // ── PDF: Ventas ───────────────────────────────────────────────────────────

  async exportSalesPdf(businessId: string, from: Date, to: Date, res: Response) {
    const [sales, businessName] = await Promise.all([
      this.getSalesData(businessId, from, to),
      this.getBusinessName(businessId),
    ]);

    const buf = await buildPdf({ margin: 40, size: 'A4', layout: 'landscape' }, (doc) => {
      addPdfHeader(doc, 'REPORTE DE VENTAS', businessName, fmtDate(from), fmtDate(to));

      const totalVentas = sales.reduce((a, s) => a + Number(s.total), 0);
      const totalIgv    = sales.reduce((a, s) => a + Number(s.igv ?? 0), 0);
      const ticket      = sales.length > 0 ? totalVentas / sales.length : 0;

      doc.fontSize(10).fillColor('#1E293B')
        .text(
          `Total: S/ ${fmt(totalVentas)}   |   Transacciones: ${sales.length}   |   ` +
          `Ticket Promedio: S/ ${fmt(ticket)}   |   IGV: S/ ${fmt(totalIgv)}`,
          { align: 'center' },
        );
      doc.moveDown(0.5);

      pdfTable(
        doc,
        ['Fecha', 'Comprobante', 'Cliente', 'Vendedor', 'Tipo', 'Subtotal', 'IGV', 'Desc.', 'Total'],
        sales.map((s) => [
          fmtDate(s.fecha),
          s.electronicDocuments?.[0]?.numeroCompleto ?? '—',
          (s.customer?.nombreCompleto ?? 'Consumidor Final').substring(0, 22),
          s.user ? `${s.user.nombre} ${s.user.apellido[0] ?? ''}.` : '—',
          s.tipoVenta,
          `S/ ${fmt(Number(s.subtotal ?? 0))}`,
          `S/ ${fmt(Number(s.igv ?? 0))}`,
          `S/ ${fmt(Number(s.descuentoTotal ?? 0))}`,
          `S/ ${fmt(Number(s.total))}`,
        ]),
        [62, 80, 120, 80, 55, 68, 55, 55, 70],
      );

      addPdfFooter(doc);
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ventas_${from.toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }

  // ── PDF: Inventario ───────────────────────────────────────────────────────

  async exportInventoryPdf(businessId: string, res: Response) {
    const [products, businessName] = await Promise.all([
      this.getInventoryData(businessId),
      this.getBusinessName(businessId),
    ]);

    const buf = await buildPdf({ margin: 40, size: 'A4', layout: 'landscape' }, (doc) => {
      addPdfHeader(doc, 'REPORTE DE INVENTARIO', businessName);

      const totalValorizado = products.reduce((a, p) => {
        return a + Number(p.stockActual) * Number(p.precioCompra ?? 0);
      }, 0);
      const criticos = products.filter((p) => Number(p.stockActual) <= Number(p.stockMinimo)).length;

      doc.fontSize(10).fillColor('#1E293B')
        .text(
          `Productos: ${products.length}   |   Stock Crítico: ${criticos}   |   ` +
          `Valor Inventario: S/ ${fmt(totalValorizado)}`,
          { align: 'center' },
        );
      doc.moveDown(0.5);

      pdfTable(
        doc,
        ['Código', 'Producto', 'Categoría', 'Stock', 'Mínimo', 'Estado', 'Costo Unit.', 'Precio Vta.', 'Valorizado'],
        products.map((p) => {
          const stock = Number(p.stockActual);
          const costo = Number(p.precioCompra ?? 0);
          return [
            p.codigoInterno ?? '—',
            p.nombre.substring(0, 26),
            (p.category?.nombre ?? '—').substring(0, 14),
            stock,
            Number(p.stockMinimo),
            stock <= Number(p.stockMinimo) ? 'CRÍTICO' : 'Normal',
            `S/ ${fmt(costo)}`,
            `S/ ${fmt(Number(p.precioVenta))}`,
            `S/ ${fmt(stock * costo)}`,
          ];
        }),
        [62, 140, 80, 46, 52, 55, 70, 72, 73],
      );

      addPdfFooter(doc);
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="inventario_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }

  // ── PDF: Gastos ───────────────────────────────────────────────────────────

  async exportExpensesPdf(businessId: string, from: Date, to: Date, res: Response) {
    const [expenses, businessName] = await Promise.all([
      this.getExpensesData(businessId, from, to),
      this.getBusinessName(businessId),
    ]);

    const buf = await buildPdf({ margin: 40, size: 'A4' }, (doc) => {
      addPdfHeader(doc, 'REPORTE DE GASTOS', businessName, fmtDate(from), fmtDate(to));

      const total = expenses.reduce((a, e) => a + Number(e.monto), 0);
      doc.fontSize(10).fillColor('#1E293B')
        .text(`Total Gastos: S/ ${fmt(total)}   |   Registros: ${expenses.length}`, { align: 'center' });
      doc.moveDown(0.5);

      pdfTable(
        doc,
        ['Fecha', 'Categoría', 'Descripción', 'Monto', 'Observaciones'],
        expenses.map((e) => [
          fmtDate(e.fecha),
          (e.category?.nombre ?? 'Sin cat.').substring(0, 18),
          e.descripcion.substring(0, 32),
          `S/ ${fmt(Number(e.monto))}`,
          (e.observaciones ?? '—').substring(0, 24),
        ]),
        [65, 105, 175, 80, 130],
      );

      addPdfFooter(doc);
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="gastos_${from.toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }

  // ── PDF: Comprobantes SUNAT ───────────────────────────────────────────────

  async exportDocumentsPdf(businessId: string, from: Date, to: Date, res: Response) {
    const [documents, businessName] = await Promise.all([
      this.getDocumentsData(businessId, from, to),
      this.getBusinessName(businessId),
    ]);

    const buf = await buildPdf({ margin: 40, size: 'A4', layout: 'landscape' }, (doc) => {
      addPdfHeader(doc, 'REPORTE DE COMPROBANTES SUNAT', businessName, fmtDate(from), fmtDate(to));

      const total = documents.reduce((a, d) => a + Number(d.total ?? 0), 0);
      doc.fontSize(10).fillColor('#1E293B')
        .text(`Total Comprobantes: ${documents.length}   |   Monto Total: S/ ${fmt(total)}`, { align: 'center' });
      doc.moveDown(0.5);

      pdfTable(
        doc,
        ['Fecha', 'Tipo', 'N° Completo', 'Cliente', 'Doc. Cliente', 'Estado', 'Total', 'Enviado SUNAT'],
        documents.map((d) => [
          fmtDate(d.createdAt),
          d.tipo,
          d.numeroCompleto,
          (d.customer?.nombreCompleto ?? 'Consumidor Final').substring(0, 22),
          d.customer?.numeroDocumento ?? '—',
          d.estado,
          `S/ ${fmt(Number(d.total ?? 0))}`,
          d.fechaEnvio ? fmtDate(d.fechaEnvio) : 'Pendiente',
        ]),
        [60, 55, 80, 120, 70, 65, 65, 85],
      );

      addPdfFooter(doc);
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="comprobantes_${from.toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }

  // ── EXCEL: Cobranzas ─────────────────────────────────────────────────────

  async exportCobranzasExcel(businessId: string, from: Date, to: Date, res: Response) {
    const [payments, businessName] = await Promise.all([
      this.prisma.salePayment.findMany({
        where: { sale: { businessId }, fecha: { gte: from, lte: to } },
        include: {
          paymentMethod: { select: { nombre: true, tipo: true } },
          sale: {
            select: {
              id: true, total: true, saldoPendiente: true,
              customer: { select: { nombreCompleto: true, numeroDocumento: true } },
              user:     { select: { nombre: true, apellido: true } },
            },
          },
        },
        orderBy: { fecha: 'asc' },
      }),
      this.getBusinessName(businessId),
    ]);

    const wb = new ExcelJS.Workbook();
    addWorkbookMeta(wb, 'Reporte de Cobranzas', businessName);

    // Hoja principal
    const ws = wb.addWorksheet('Cobros');
    ws.columns = [
      { key: 'fecha',    header: 'Fecha Cobro',    width: 20 },
      { key: 'cliente',  header: 'Cliente',         width: 32 },
      { key: 'doc',      header: 'Doc. Cliente',    width: 16 },
      { key: 'venta',    header: 'Venta #',         width: 14 },
      { key: 'metodo',   header: 'Método Pago',     width: 20 },
      { key: 'monto',    header: 'Monto Cobrado',   width: 16 },
      { key: 'totalVenta',header: 'Total Venta',    width: 16 },
      { key: 'saldo',    header: 'Saldo Restante',  width: 16 },
      { key: 'referencia',header: 'Referencia',     width: 22 },
      { key: 'vendedor', header: 'Registrado por',  width: 24 },
    ];
    applyTableHeader(ws.getRow(1));

    const totalCobrado = payments.reduce((a, p) => a + Number(p.monto), 0);

    payments.forEach((p, idx) => {
      const row = ws.addRow({
        fecha:      new Date(p.fecha).toLocaleString('es-PE'),
        cliente:    p.sale?.customer?.nombreCompleto ?? '—',
        doc:        p.sale?.customer?.numeroDocumento ?? '—',
        venta:      p.sale?.id?.slice(-8).toUpperCase() ?? '—',
        metodo:     p.paymentMethod?.nombre ?? '—',
        monto:      fmt(Number(p.monto)),
        totalVenta: fmt(Number(p.sale?.total ?? 0)),
        saldo:      fmt(Number(p.sale?.saldoPendiente ?? 0)),
        referencia: p.referencia ?? '—',
        vendedor:   p.sale?.user ? `${p.sale.user.nombre} ${p.sale.user.apellido}` : '—',
      });
      applyDataRow(row, idx % 2 !== 0);
    });

    // Fila de total
    const totalRow = ws.addRow({ monto: `TOTAL: S/ ${fmt(totalCobrado)}` });
    totalRow.font = { bold: true };
    totalRow.getCell('monto').fill = HEADER_FILL;
    totalRow.getCell('monto').font = { ...HEADER_FONT };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="cobranzas_${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  }

  // ── PDF: Cobranzas ────────────────────────────────────────────────────────

  async exportCobranzasPdf(businessId: string, from: Date, to: Date, res: Response) {
    const [payments, businessName] = await Promise.all([
      this.prisma.salePayment.findMany({
        where: { sale: { businessId }, fecha: { gte: from, lte: to } },
        include: {
          paymentMethod: { select: { nombre: true } },
          sale: {
            select: {
              id: true, total: true, saldoPendiente: true,
              customer: { select: { nombreCompleto: true, numeroDocumento: true } },
            },
          },
        },
        orderBy: { fecha: 'asc' },
      }),
      this.getBusinessName(businessId),
    ]);

    const totalCobrado = payments.reduce((a, p) => a + Number(p.monto), 0);

    const buf = await buildPdf({ margin: 40, size: 'A4', layout: 'landscape' }, (doc) => {
      addPdfHeader(doc, 'REPORTE DE COBRANZAS', businessName, fmtDate(from), fmtDate(to));

      doc.fontSize(10).fillColor('#1E293B')
        .text(
          `Total cobrado: S/ ${fmt(totalCobrado)}   |   Registros: ${payments.length}`,
          { align: 'center' },
        );
      doc.moveDown(0.6);

      pdfTable(
        doc,
        ['Fecha', 'Cliente', 'Venta #', 'Método', 'Cobrado', 'Saldo Rest.', 'Referencia'],
        payments.map((p) => [
          new Date(p.fecha).toLocaleDateString('es-PE'),
          (p.sale?.customer?.nombreCompleto ?? '—').slice(0, 28),
          p.sale?.id?.slice(-8).toUpperCase() ?? '—',
          p.paymentMethod?.nombre ?? '—',
          `S/ ${fmt(Number(p.monto))}`,
          `S/ ${fmt(Number(p.sale?.saldoPendiente ?? 0))}`,
          p.referencia ?? '—',
        ]),
        [85, 120, 60, 80, 70, 75, 80],
      );

      // Resumen al final
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#1E293B').font('Helvetica-Bold')
        .text(`Total cobrado en el período: S/ ${fmt(totalCobrado)}`, { align: 'right' });

      addPdfFooter(doc);
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cobranzas_${from.toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }
}
