import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { PartialType } from '@nestjs/mapped-types';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  // ── CATEGORÍAS ─────────────────────────────────────────────────────────

  async findCategories(businessId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { businessId },
      orderBy: { nombre: 'asc' },
    });
  }

  async createCategory(dto: CreateExpenseCategoryDto, businessId: string) {
    return this.prisma.expenseCategory.create({
      data: { ...dto, businessId },
    });
  }

  // ── GASTOS ─────────────────────────────────────────────────────────────

  async findAll(
    businessId: string,
    filters: { from?: string; to?: string; categoryId?: string; page?: number; limit?: number },
  ) {
    const { from, to, categoryId, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      businessId,
      ...(categoryId && { categoryId }),
      ...((from || to) && {
        fecha: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: { category: true, user: { select: { nombre: true, apellido: true } } },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateExpenseDto, userId: string, businessId: string) {
    return this.prisma.expense.create({
      data: {
        ...dto,
        fecha: new Date(dto.fecha),
        frecuencia: dto.frecuencia as any,
        businessId,
        userId,
      },
      include: { category: true },
    });
  }

  async update(id: string, dto: Partial<CreateExpenseDto>, businessId: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, businessId } });
    if (!expense) throw new NotFoundException('Gasto no encontrado');

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.fecha && { fecha: new Date(dto.fecha) }),
        frecuencia: dto.frecuencia as any,
      },
      include: { category: true },
    });
  }

  async remove(id: string, businessId: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, businessId } });
    if (!expense) throw new NotFoundException('Gasto no encontrado');
    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Gasto eliminado', id };
  }

  async getSummary(businessId: string, from: string, to: string) {
    const where: Prisma.ExpenseWhereInput = {
      businessId,
      fecha: { gte: new Date(from), lte: new Date(to) },
    };

    const [agg, byCategory] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _sum: { monto: true },
        _count: { id: true },
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where,
        _sum: { monto: true },
        orderBy: { _sum: { monto: 'desc' } },
      }),
    ]);

    const catIds = byCategory.map((c) => c.categoryId).filter(Boolean) as string[];
    const cats = await this.prisma.expenseCategory.findMany({ where: { id: { in: catIds } } });
    const catMap = new Map(cats.map((c) => [c.id, c.nombre]));

    return {
      totalGastos: Number(agg._sum.monto ?? 0),
      cantidadRegistros: agg._count.id,
      porCategoria: byCategory.map((c) => ({
        categoria: c.categoryId ? catMap.get(c.categoryId) ?? 'Sin categoría' : 'Sin categoría',
        total: Number(c._sum.monto ?? 0),
      })),
    };
  }
}
