import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async findOne(businessId: string) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundException('Negocio no encontrado');
    return biz;
  }

  async update(businessId: string, dto: UpdateBusinessDto) {
    await this.findOne(businessId);
    return this.prisma.business.update({
      where: { id: businessId },
      data: dto,
    });
  }

  // ── Métodos de pago ───────────────────────────────────────────────────────

  async getPaymentMethodsAll(businessId: string) {
    // Inicializar si no existen
    const count = await this.prisma.paymentMethod.count({ where: { businessId } });
    if (count === 0) {
      const defaults = [
        { nombre: 'Efectivo',        tipo: 'efectivo'        },
        { nombre: 'Yape',            tipo: 'yape'            },
        { nombre: 'Plin',            tipo: 'plin'            },
        { nombre: 'Transferencia',   tipo: 'transferencia'   },
        { nombre: 'Tarjeta Débito',  tipo: 'tarjeta_debito'  },
        { nombre: 'Tarjeta Crédito', tipo: 'tarjeta_credito' },
      ] as const;
      await this.prisma.paymentMethod.createMany({
        data: defaults.map((d) => ({
          id: `${businessId}-${d.tipo}`,
          nombre: d.nombre,
          tipo: d.tipo,
          businessId,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }
    return this.prisma.paymentMethod.findMany({
      where: { businessId },
      orderBy: { nombre: 'asc' },
    });
  }

  async updatePaymentMethod(id: string, businessId: string, data: { nombre?: string; isActive?: boolean }) {
    const pm = await this.prisma.paymentMethod.findFirst({ where: { id, businessId } });
    if (!pm) throw new NotFoundException('Método de pago no encontrado');
    return this.prisma.paymentMethod.update({ where: { id }, data });
  }

  async createPaymentMethod(businessId: string, nombre: string, tipo: string) {
    return this.prisma.paymentMethod.create({
      data: { nombre, tipo: tipo as any, businessId, isActive: true },
    });
  }
}