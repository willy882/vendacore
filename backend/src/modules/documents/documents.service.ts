import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, query: {
    tipo?: string; estado?: string; from?: string; to?: string; page?: number; limit?: number;
  }) {
    const { tipo, estado, from, to, page = 1, limit = 50 } = query;
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
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: { customer: true, items: { include: { product: true } } },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    if (sale.estado === 'anulada') throw new BadRequestException('La venta está anulada');

    // Obtener o crear serie
    const prefix = tipo === 'boleta' ? 'B001' : 'F001';
    let series = await this.prisma.documentSeries.findFirst({
      where: { businessId, serie: prefix, isActive: true },
    });
    if (!series) {
      series = await this.prisma.documentSeries.create({
        data: { businessId, tipoDocumento: tipo as any, serie: prefix, correlativoActual: 0, isActive: true },
      });
    }

    const correlativo = series.correlativoActual + 1;
    const numeroCompleto = `${prefix}-${String(correlativo).padStart(8, '0')}`;

    // Verificar que no exista ya
    const existing = await this.prisma.electronicDocument.findFirst({
      where: { businessId, tipo: tipo as any, serie: prefix, correlativo },
    });
    if (existing) throw new BadRequestException('Ya existe un comprobante con ese correlativo');

    const [doc] = await this.prisma.$transaction([
      this.prisma.electronicDocument.create({
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
      }),
      this.prisma.documentSeries.update({
        where: { id: series.id },
        data: { correlativoActual: correlativo },
      }),
    ]);

    return doc;
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