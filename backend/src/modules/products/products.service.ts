import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ── CATEGORÍAS ──────────────────────────────────────────────────────────

  async findAllCategories(businessId: string) {
    return this.prisma.productCategory.findMany({
      where: { businessId },
      include: { children: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto, businessId: string) {
    if (dto.parentId) {
      const parent = await this.prisma.productCategory.findFirst({
        where: { id: dto.parentId, businessId },
      });
      if (!parent) throw new BadRequestException('Categoría padre no encontrada');
    }
    return this.prisma.productCategory.create({
      data: { ...dto, businessId },
    });
  }

  async deleteCategory(id: string, businessId: string) {
    const cat = await this.prisma.productCategory.findFirst({ where: { id, businessId } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    const hasProducts = await this.prisma.product.count({ where: { categoryId: id } });
    if (hasProducts > 0) {
      throw new ConflictException('No puedes eliminar una categoría que tiene productos asignados');
    }
    return this.prisma.productCategory.delete({ where: { id } });
  }

  // ── PRODUCTOS ────────────────────────────────────────────────────────────

  async findAll(query: QueryProductDto, businessId: string) {
    const { search, categoryId, lowStock, isActive, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      businessId,
      ...(typeof isActive === 'boolean' && { isActive }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { codigoInterno: { contains: search, mode: 'insensitive' } },
          { codigoBarras: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          id: true, nombre: true, codigoInterno: true, codigoBarras: true,
          descripcion: true, unidadMedida: true, precioCompra: true, precioVenta: true,
          igvTipo: true, stockActual: true, stockMinimo: true, isActive: true,
          imagenUrl: true, categoryId: true,
          category: { select: { id: true, nombre: true } },
        },
        orderBy: { nombre: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    // filtro lowStock en JS (Prisma no soporta campo-vs-campo directamente)
    const filtered = lowStock
      ? items.filter((p) => Number(p.stockActual) <= Number(p.stockMinimo))
      : items;

    return {
      data: filtered,
      total: lowStock ? filtered.length : total,
      page,
      limit,
      totalPages: Math.ceil((lowStock ? filtered.length : total) / limit),
    };
  }

  async findOne(id: string, businessId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async create(dto: CreateProductDto, businessId: string) {
    if (dto.codigoInterno) {
      const dup = await this.prisma.product.findFirst({
        where: { codigoInterno: dto.codigoInterno, businessId },
      });
      if (dup) throw new ConflictException('Ya existe un producto con ese código interno');
    }
    if (dto.codigoBarras) {
      const dup = await this.prisma.product.findFirst({
        where: { codigoBarras: dto.codigoBarras, businessId },
      });
      if (dup) throw new ConflictException('Ya existe un producto con ese código de barras');
    }
    return this.prisma.product.create({
      data: {
        ...dto,
        businessId,
        stockActual: 0,
        stockMinimo: dto.stockMinimo ?? 0,
        igvTipo: (dto.igvTipo as any) ?? 'gravado',
        isActive: dto.isActive ?? true,
      },
      include: { category: true },
    });
  }

  async update(id: string, dto: UpdateProductDto, businessId: string) {
    await this.findOne(id, businessId);

    if (dto.codigoInterno) {
      const dup = await this.prisma.product.findFirst({
        where: { codigoInterno: dto.codigoInterno, businessId, NOT: { id } },
      });
      if (dup) throw new ConflictException('Código interno ya en uso por otro producto');
    }

    return this.prisma.product.update({
      where: { id },
      data: dto as any,
      include: { category: true },
    });
  }

  async deactivate(id: string, businessId: string) {
    await this.findOne(id, businessId);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, nombre: true, isActive: true },
    });
  }

  async getLowStockAlerts(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true, nombre: true, codigoInterno: true,
        stockActual: true, stockMinimo: true,
        category: { select: { nombre: true } },
      },
    });
    return products.filter((p) => Number(p.stockActual) <= Number(p.stockMinimo));
  }
}
