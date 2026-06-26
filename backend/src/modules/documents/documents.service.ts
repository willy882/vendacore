import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PlanEnforcementService } from '../plan-enforcement/plan-enforcement.service';
import { SunatService } from './sunat.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private planEnforcement: PlanEnforcementService,
    private sunat: SunatService,
  ) {}

  async findAll(businessId: string, query: {
    tipo?: string; estado?: string; from?: string; to?: string; page?: any; limit?: any;
  }) {
    const { tipo, estado, from, to } = query;
    const page  = Math.max(1, parseInt(String(query.page  ?? 1),  10) || 1);
    const limit = Math.min(100, parseInt(String(query.limit ?? 50), 10) || 50);
    const skip = (page - 1) * limit;

    const where: Prisma.ElectronicDocumentWhereInput = {
      businessId,
      ...(tipo   && { tipo:   tipo   as any }),
      ...(estado && { estado: estado as any }),
      ...((from || to) && {
        fechaEmision: {
          ...(from && { gte: new Date(from) }),
          ...(to   && { lte: new Date(to) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.electronicDocument.findMany({
        where,
        include: {
          sale: { select: { id: true, total: true } },
          customer: { select: { nombreCompleto: true, numeroDocumento: true, tipoDocumento: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.electronicDocument.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, businessId: string) {
    const doc = await this.prisma.electronicDocument.findFirst({
      where: { id, businessId },
      include: {
        sale: {
          include: {
            items: { include: { product: { select: { nombre: true, codigoInterno: true, igvTipo: true } } } },
            payments: { include: { paymentMethod: { select: { nombre: true } } } },
          },
        },
        customer: true,
      },
    });
    if (!doc) throw new NotFoundException('Comprobante no encontrado');
    return doc;
  }

  async createFromSale(saleId: string, tipo: 'boleta' | 'factura', businessId: string) {
    await this.planEnforcement.checkDocumentos(businessId);
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    if (sale.estado === 'anulada') throw new BadRequestException('La venta está anulada');

    const prefix = tipo === 'boleta' ? 'B001' : 'F001';

    // Transacción interactiva: el increment es atómico en BD, elimina race condition
    const doc = await this.prisma.$transaction(async (tx) => {
      // Upsert de la serie dentro de la transacción
      let series = await tx.documentSeries.findFirst({
        where: { businessId, serie: prefix, isActive: true },
      });
      if (!series) {
        series = await tx.documentSeries.create({
          data: { businessId, tipoDocumento: tipo as any, serie: prefix, correlativoActual: 0, isActive: true },
        });
      }

      // Incremento atómico: la BD garantiza que dos transacciones concurrentes obtienen valores distintos
      const updatedSeries = await tx.documentSeries.update({
        where: { id: series.id },
        data: { correlativoActual: { increment: 1 } },
      });

      const correlativo    = updatedSeries.correlativoActual;
      const numeroCompleto = `${prefix}-${String(correlativo).padStart(8, '0')}`;

      return tx.electronicDocument.create({
        data: {
          businessId,
          saleId,
          customerId: sale.customerId,
          tipo: tipo as any,
          serie: prefix,
          correlativo,
          numeroCompleto,
          fechaEmision: new Date(),
          subtotal: sale.subtotal,
          igv: sale.igv,
          total: sale.total,
          estado: 'pendiente',
        },
        include: {
          customer: { select: { nombreCompleto: true, numeroDocumento: true } },
          sale: { select: { id: true, total: true } },
        },
      });
    });

    // Auto-envío a SUNAT/Nubefact si el negocio tiene credenciales configuradas
    try {
      const biz = await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { nubefactToken: true },
      });

      if (biz?.nubefactToken) {
        this.logger.log(`Auto-enviando ${doc.numeroCompleto} a APIs Peru...`);
        const result = await this.sunat.sendDocument(doc.id, businessId);
        // Devolver el doc actualizado con los datos de SUNAT
        const updated = await this.prisma.electronicDocument.findUnique({
          where: { id: doc.id },
          include: {
            customer: { select: { nombreCompleto: true, numeroDocumento: true } },
            sale: { select: { id: true, total: true } },
          },
        });
        return { ...updated, _sunat: result };
      }
    } catch (err: any) {
      // El comprobante ya fue creado y el correlativo reservado — solo loguear el error
      this.logger.warn(`Auto-envío APIs Peru falló para ${doc.numeroCompleto}: ${err?.message}`);
    }

    return doc;
  }

  async createNotaCredito(
    originalDocId: string,
    tipNota: string,
    motivo: string,
    businessId: string,
  ) {
    const original = await this.prisma.electronicDocument.findFirst({
      where: { id: originalDocId, businessId },
    });
    if (!original) throw new NotFoundException('Documento original no encontrado');
    if (original.tipo === 'nota_credito' || original.tipo === 'nota_debito')
      throw new BadRequestException('No se puede emitir NC de una nota');
    if (original.estado !== 'aceptado')
      throw new BadRequestException('Solo se puede emitir NC de documentos aceptados por SUNAT');

    const prefix = original.tipo === 'factura' ? 'FC01' : 'BC01';

    const nc = await this.prisma.$transaction(async (tx) => {
      let series = await tx.documentSeries.findFirst({
        where: { businessId, serie: prefix, isActive: true },
      });
      if (!series) {
        series = await tx.documentSeries.create({
          data: {
            businessId,
            tipoDocumento: 'nota_credito' as any,
            serie: prefix,
            correlativoActual: 0,
            isActive: true,
          },
        });
      }
      const updatedSeries = await tx.documentSeries.update({
        where: { id: series.id },
        data: { correlativoActual: { increment: 1 } },
      });
      const correlativo    = updatedSeries.correlativoActual;
      const numeroCompleto = `${prefix}-${String(correlativo).padStart(8, '0')}`;

      return tx.electronicDocument.create({
        data: {
          businessId,
          saleId:     original.saleId,
          customerId: original.customerId,
          tipo:       'nota_credito',
          serie:      prefix,
          correlativo,
          numeroCompleto,
          fechaEmision: new Date(),
          subtotal: original.subtotal,
          igv:      original.igv,
          total:    original.total,
          estado:   'pendiente',
          // Metadatos para el envío a SUNAT (original + tipNota + motivo)
          respuestaSunat: `PENDING|original:${original.numeroCompleto}|tipNota:${tipNota}|motivo:${motivo}`,
        },
        include: {
          customer: { select: { nombreCompleto: true, numeroDocumento: true } },
          sale:     { select: { id: true, total: true } },
        },
      });
    });

    // Auto-envío a SUNAT si el negocio tiene credenciales
    try {
      const biz = await this.prisma.business.findUnique({
        where:  { id: businessId },
        select: { nubefactToken: true },
      });
      if (biz?.nubefactToken) {
        this.logger.log(`Auto-enviando NC ${nc.numeroCompleto} a APIs Peru...`);
        await this.sunat.sendDocument(nc.id, businessId);
        return this.prisma.electronicDocument.findUnique({
          where: { id: nc.id },
          include: {
            customer: { select: { nombreCompleto: true, numeroDocumento: true } },
            sale:     { select: { id: true, total: true } },
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Auto-envío NC falló para ${nc.numeroCompleto}: ${err?.message}`);
    }

    return nc;
  }

  async updateStatus(id: string, estado: string, businessId: string) {
    const doc = await this.prisma.electronicDocument.findFirst({ where: { id, businessId } });
    if (!doc) throw new NotFoundException('Comprobante no encontrado');
    return this.prisma.electronicDocument.update({
      where: { id },
      data: { estado: estado as any, ...(estado === 'anulado' && { fechaRespuesta: new Date() }) },
    });
  }

  async getStats(businessId: string) {
    const [total, pendientes, aceptados, observados] = await Promise.all([
      this.prisma.electronicDocument.count({ where: { businessId } }),
      this.prisma.electronicDocument.count({ where: { businessId, estado: 'pendiente' } }),
      this.prisma.electronicDocument.count({ where: { businessId, estado: 'aceptado' } }),
      this.prisma.electronicDocument.count({ where: { businessId, estado: { in: ['observado', 'rechazado'] } } }),
    ]);
    return { total, pendientes, aceptados, observados };
  }
}