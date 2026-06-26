import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { CreateProformaDto, UpdateProformaDto, QueryProformaDto } from './dto/proforma.dto';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

@Injectable()
export class ProformasService {
  constructor(private prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async nextNumero(businessId: string): Promise<string> {
    const count = await this.prisma.proforma.count({ where: { businessId } });
    return `P-${String(count + 1).padStart(4, '0')}`;
  }

  private calcTotals(items: { cantidad: number; precioUnitario: number; igvMonto: number }[]) {
    const subtotal = items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
    const igv      = items.reduce((s, i) => s + i.igvMonto * i.cantidad, 0);
    const total    = subtotal + igv;
    return { subtotal: +subtotal.toFixed(2), igv: +igv.toFixed(2), total: +total.toFixed(2) };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(businessId: string, query: QueryProformaDto) {
    const from = query.from ? new Date(query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to   = query.to   ? new Date(query.to + 'T23:59:59') : new Date();

    return this.prisma.proforma.findMany({
      where: { businessId, fecha: { gte: from, lte: to } },
      include: { customer: { select: { nombreCompleto: true, numeroDocumento: true } } },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const p = await this.prisma.proforma.findFirst({
      where: { id, businessId },
      include: {
        customer: { select: { nombreCompleto: true, numeroDocumento: true, telefono: true, direccion: true } },
        user:     { select: { nombre: true, apellido: true } },
        items:    { include: { product: { select: { nombre: true, codigoInterno: true } } } },
      },
    });
    if (!p) throw new NotFoundException('Proforma no encontrada');
    return p;
  }

  async create(businessId: string, userId: string, dto: CreateProformaDto) {
    const numero = await this.nextNumero(businessId);
    const { subtotal, igv, total } = this.calcTotals(dto.items);

    return this.prisma.proforma.create({
      data: {
        businessId,
        userId,
        customerId:   dto.customerId ?? null,
        numero,
        fecha:        dto.fecha ? new Date(dto.fecha) : new Date(),
        observaciones: dto.observaciones,
        subtotal,
        igv,
        total,
        items: {
          create: dto.items.map((i) => ({
            productId:     i.productId ?? null,
            descripcion:   i.descripcion,
            cantidad:      i.cantidad,
            precioUnitario: i.precioUnitario,
            subtotal:      +(i.cantidad * i.precioUnitario).toFixed(4),
            igvMonto:      i.igvMonto,
            total:         +(i.cantidad * i.precioUnitario + i.igvMonto * i.cantidad).toFixed(4),
          })),
        },
      },
      include: { items: true },
    });
  }

  async update(businessId: string, id: string, dto: UpdateProformaDto) {
    await this.findOne(businessId, id);

    const updateData: any = {};
    if (dto.customerId !== undefined) updateData.customerId = dto.customerId;
    if (dto.fecha)                    updateData.fecha = new Date(dto.fecha);
    if (dto.observaciones !== undefined) updateData.observaciones = dto.observaciones;

    if (dto.items) {
      const { subtotal, igv, total } = this.calcTotals(dto.items);
      updateData.subtotal = subtotal;
      updateData.igv      = igv;
      updateData.total    = total;
      updateData.items    = {
        deleteMany: {},
        create: dto.items.map((i) => ({
          productId:      i.productId ?? null,
          descripcion:    i.descripcion,
          cantidad:       i.cantidad,
          precioUnitario: i.precioUnitario,
          subtotal:       +(i.cantidad * i.precioUnitario).toFixed(4),
          igvMonto:       i.igvMonto,
          total:          +(i.cantidad * i.precioUnitario + i.igvMonto * i.cantidad).toFixed(4),
        })),
      };
    }

    return this.prisma.proforma.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    return this.prisma.proforma.delete({ where: { id } });
  }

  // ── PDF ──────────────────────────────────────────────────────────────────

  async generatePdf(
    businessId: string,
    id: string,
    format: 'a4' | '80mm' | '58mm',
    res: Response,
  ) {
    const proforma = await this.findOne(businessId, id);
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { razonSocial: true, ruc: true, direccion: true, telefono: true },
    });

    const isTicket = format !== 'a4';
    const mmToPt   = (mm: number) => (mm / 25.4) * 72;

    const pageWidth  = isTicket ? mmToPt(format === '80mm' ? 80 : 58) : undefined;
    const docOptions: PDFKit.PDFDocumentOptions = isTicket
      ? { size: [pageWidth!, 1000], margin: 8 }
      : { size: 'A4', margin: 40 };

    const pdf = await new Promise<Buffer>((resolve, reject) => {
      const doc    = new PDFDocument(docOptions);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W    = doc.page.width - (isTicket ? 16 : 80);
      const x0   = isTicket ? 8 : 40;
      const fSm  = isTicket ? 7  : 9;
      const fMd  = isTicket ? 8  : 10;
      const fLg  = isTicket ? 9  : 12;
      const fXl  = isTicket ? 11 : 15;

      // ── Encabezado empresa ──
      doc.font('Helvetica-Bold').fontSize(fXl).text(business?.razonSocial ?? '', x0, 20, { width: W, align: 'center' });
      doc.font('Helvetica').fontSize(fSm)
        .text(`RUC: ${business?.ruc ?? ''}`, x0, undefined, { width: W, align: 'center' })
        .text(business?.direccion ?? '', { width: W, align: 'center' })
        .text(business?.telefono ?? '', { width: W, align: 'center' });

      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(fLg).text('PROFORMA', x0, undefined, { width: W, align: 'center' });
      doc.font('Helvetica').fontSize(fMd)
        .text(`N°: ${proforma.numero}`, x0, undefined, { width: W, align: 'center' })
        .text(`Fecha: ${fmtDate(proforma.fecha)}`, { width: W, align: 'center' });

      doc.moveDown(0.5);
      doc.moveTo(x0, doc.y).lineTo(x0 + W, doc.y).stroke();
      doc.moveDown(0.3);

      // ── Cliente ──
      if (proforma.customer) {
        doc.font('Helvetica-Bold').fontSize(fMd).text('CLIENTE:', x0);
        doc.font('Helvetica').fontSize(fSm)
          .text(proforma.customer.nombreCompleto, x0)
          .text(proforma.customer.numeroDocumento ?? '', x0);
        doc.moveDown(0.3);
        doc.moveTo(x0, doc.y).lineTo(x0 + W, doc.y).stroke();
        doc.moveDown(0.3);
      }

      // ── Cabecera tabla ──
      doc.font('Helvetica-Bold').fontSize(fSm);
      if (isTicket) {
        doc.text('Descripcion', x0, undefined, { width: W * 0.5 });
        doc.text('Cant', x0 + W * 0.5, doc.y - doc.currentLineHeight(), { width: W * 0.15, align: 'right' });
        doc.text('P.U.', x0 + W * 0.65, doc.y - doc.currentLineHeight(), { width: W * 0.15, align: 'right' });
        doc.text('Total', x0 + W * 0.8, doc.y - doc.currentLineHeight(), { width: W * 0.2, align: 'right' });
      } else {
        doc.text('Descripcion', x0, undefined, { width: W * 0.45 });
        doc.text('Und.', x0 + W * 0.45, doc.y - doc.currentLineHeight(), { width: W * 0.1, align: 'right' });
        doc.text('Precio', x0 + W * 0.55, doc.y - doc.currentLineHeight(), { width: W * 0.2, align: 'right' });
        doc.text('Total', x0 + W * 0.75, doc.y - doc.currentLineHeight(), { width: W * 0.25, align: 'right' });
      }
      doc.moveDown(0.2);
      doc.moveTo(x0, doc.y).lineTo(x0 + W, doc.y).stroke();
      doc.moveDown(0.3);

      // ── Items ──
      doc.font('Helvetica').fontSize(fSm);
      for (const item of proforma.items) {
        const desc   = item.descripcion || (item.product?.nombre ?? '—');
        const cant   = Number(item.cantidad);
        const precio = Number(item.precioUnitario);
        const total  = Number(item.total);

        if (isTicket) {
          doc.text(desc, x0, undefined, { width: W * 0.5 });
          const yLine = doc.y - doc.currentLineHeight();
          doc.text(String(cant), x0 + W * 0.5, yLine, { width: W * 0.15, align: 'right' });
          doc.text(`S/${fmt(precio)}`, x0 + W * 0.65, yLine, { width: W * 0.15, align: 'right' });
          doc.text(`S/${fmt(total)}`, x0 + W * 0.8, yLine, { width: W * 0.2, align: 'right' });
        } else {
          doc.text(desc, x0, undefined, { width: W * 0.45 });
          const yLine = doc.y - doc.currentLineHeight();
          doc.text(String(cant), x0 + W * 0.45, yLine, { width: W * 0.1, align: 'right' });
          doc.text(`S/${fmt(precio)}`, x0 + W * 0.55, yLine, { width: W * 0.2, align: 'right' });
          doc.text(`S/${fmt(total)}`, x0 + W * 0.75, yLine, { width: W * 0.25, align: 'right' });
        }
      }

      doc.moveDown(0.3);
      doc.moveTo(x0, doc.y).lineTo(x0 + W, doc.y).stroke();
      doc.moveDown(0.3);

      // ── Totales ──
      const totX = isTicket ? x0 : x0 + W * 0.6;
      const totW = isTicket ? W : W * 0.4;
      doc.font('Helvetica').fontSize(fSm)
        .text(`Subtotal: S/ ${fmt(Number(proforma.subtotal))}`, totX, undefined, { width: totW, align: 'right' })
        .text(`IGV (18%): S/ ${fmt(Number(proforma.igv))}`, totX, undefined, { width: totW, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(fMd)
        .text(`TOTAL: S/ ${fmt(Number(proforma.total))}`, totX, undefined, { width: totW, align: 'right' });

      if (proforma.observaciones) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(fSm).text('OBSERVACION:', x0);
        doc.font('Helvetica').fontSize(fSm).text(proforma.observaciones, x0, undefined, { width: W });
      }

      doc.moveDown(1);
      doc.font('Helvetica').fontSize(fSm)
        .text('Documento no tiene validez tributaria', x0, undefined, { width: W, align: 'center' });

      doc.end();
    });

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="proforma-${proforma.numero}-${format}.pdf"`,
      'Content-Length':      String(pdf.length),
    });
    res.end(pdf);
  }
}
