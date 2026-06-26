import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);
  constructor(private prisma: PrismaService) {}

  // ── Búsqueda por documento (local primero, luego RENIEC/SUNAT) ───────────────

  async lookupDocument(tipo: string, numero: string, businessId: string) {
    const tipoUpper = tipo.toUpperCase();

    if (tipoUpper === 'DNI' && numero.length !== 8)
      throw new BadRequestException('El DNI debe tener 8 dígitos');
    if (tipoUpper === 'RUC' && numero.length !== 11)
      throw new BadRequestException('El RUC debe tener 11 dígitos');

    // 1. Buscar en BD local primero
    const local = await this.prisma.customer.findFirst({
      where: { businessId, numeroDocumento: numero, isActive: true },
    });
    if (local) {
      return {
        source:          'local',
        nombreCompleto:  local.nombreCompleto,
        razonSocial:     local.razonSocial  ?? undefined,
        tipoDocumento:   local.tipoDocumento ?? tipoUpper,
        numeroDocumento: local.numeroDocumento ?? numero,
        telefono:        local.telefono   ?? undefined,
        email:           local.email      ?? undefined,
        direccion:       local.direccion  ?? undefined,
        distrito:        local.distrito   ?? undefined,
      };
    }

    // 2. Consultar API externa — apisperu.com (producción)
    const token = process.env.APIS_PE_TOKEN ?? '';
    if (!token) throw new NotFoundException('Token de consulta no configurado. Contacta al administrador.');

    try {
      let url: string;
      if (tipoUpper === 'DNI')
        url = `https://dniruc.apisperu.com/api/v1/dni/${numero}?token=${token}`;
      else if (tipoUpper === 'RUC')
        url = `https://dniruc.apisperu.com/api/v1/ruc/${numero}?token=${token}`;
      else
        throw new BadRequestException('Tipo de documento no soportado para búsqueda automática');

      this.logger.debug(`Consultando ${tipoUpper} ${numero}`);

      const res  = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const text = await res.text();
      this.logger.debug(`Respuesta ${tipoUpper}: HTTP ${res.status}`);

      let data: any;
      try { data = JSON.parse(text); } catch { throw new NotFoundException('Respuesta inválida de la API'); }

      if (!res.ok || data.success === false || data.message) {
        throw new NotFoundException(data.message ?? 'Documento no encontrado en RENIEC/SUNAT');
      }

      if (tipoUpper === 'DNI') {
        const nombre = [data.apellidoPaterno, data.apellidoMaterno, data.nombres]
          .filter(Boolean).join(' ');
        if (!nombre) throw new NotFoundException('Documento no encontrado en RENIEC/SUNAT');
        return {
          source:          'reniec',
          nombreCompleto:  nombre,
          tipoDocumento:   'DNI',
          numeroDocumento: numero,
          departamento:    data.departamento ?? undefined,
          provincia:       data.provincia    ?? undefined,
          distrito:        data.distrito     ?? undefined,
          ubigeo:          data.ubigeo       ?? undefined,
          direccion:       data.direccion    ?? undefined,
        };
      }

      return {
        source:          'sunat',
        nombreCompleto:  data.razonSocial ?? '',
        razonSocial:     data.razonSocial ?? undefined,
        tipoDocumento:   'RUC',
        numeroDocumento: numero,
        direccion:       data.direccion    ?? undefined,
        distrito:        data.distrito     ?? undefined,
        departamento:    data.departamento ?? undefined,
        provincia:       data.provincia    ?? undefined,
        ubigeo:          data.ubigeo       ?? undefined,
      };
    } catch (e: any) {
      if (e instanceof NotFoundException || e instanceof BadRequestException) throw e;
      this.logger.error(`Error lookup ${tipo} ${numero}: ${e?.message ?? e}`);
      throw new NotFoundException('No se pudo consultar el documento: ' + (e?.message ?? 'error de red'));
    }
  }

  async getStats(businessId: string) {
    const [activos, inactivos] = await Promise.all([
      this.prisma.customer.count({ where: { businessId, isActive: true } }),
      this.prisma.customer.count({ where: { businessId, isActive: false } }),
    ]);
    return { total: activos + inactivos, activos, inactivos };
  }

  async findAll(businessId: string, search?: string, page = 1, limit = 10) {
    const where: Prisma.CustomerWhereInput = {
      businessId,
      isActive: true,
      ...(search && {
        OR: [
          { nombreCompleto: { contains: search, mode: 'insensitive' } },
          { numeroDocumento: { contains: search, mode: 'insensitive' } },
          { razonSocial:     { contains: search, mode: 'insensitive' } },
          { telefono:        { contains: search, mode: 'insensitive' } },
          { distrito:        { contains: search, mode: 'insensitive' } } as any,
          { email:           { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { nombreCompleto: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, businessId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId },
      include: {
        sales: {
          orderBy: { fecha: 'desc' },
          take: 20,
          select: {
            id: true, fecha: true, total: true,
            estado: true, tipoVenta: true,
          },
        },
      },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async create(dto: CreateCustomerDto, businessId: string) {
    if (dto.numeroDocumento) {
      const dup = await this.prisma.customer.findFirst({
        where: { numeroDocumento: dto.numeroDocumento, businessId },
      });
      if (dup) throw new ConflictException('Ya existe un cliente con ese número de documento');
    }
    return this.prisma.customer.create({
      data: { ...dto, businessId, tipoDocumento: dto.tipoDocumento as any },
    });
  }

  /** Busca cliente por número de documento; si no existe, lo crea. Nunca duplica. */
  async upsert(dto: CreateCustomerDto, businessId: string) {
    if (dto.numeroDocumento) {
      const existing = await this.prisma.customer.findFirst({
        where: { numeroDocumento: dto.numeroDocumento, businessId },
      });
      if (existing) return existing;
    }
    return this.prisma.customer.create({
      data: { ...dto, businessId, tipoDocumento: dto.tipoDocumento as any },
    });
  }

  async update(id: string, dto: UpdateCustomerDto, businessId: string) {
    await this.findOne(id, businessId);
    if (dto.numeroDocumento) {
      const dup = await this.prisma.customer.findFirst({
        where: { numeroDocumento: dto.numeroDocumento, businessId, NOT: { id } },
      });
      if (dup) throw new ConflictException('Número de documento ya en uso');
    }
    return this.prisma.customer.update({
      where: { id },
      data: { ...dto, tipoDocumento: dto.tipoDocumento as any },
    });
  }

  async deactivate(id: string, businessId: string) {
    await this.findOne(id, businessId);
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, nombreCompleto: true, isActive: true },
    });
  }

  async getRanking(businessId: string, limit = 10) {
    const sales = await this.prisma.sale.groupBy({
      by: ['customerId'],
      where: { businessId, estado: 'activa', customerId: { not: null } },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const customerIds = sales.map((s) => s.customerId!).filter(Boolean);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, nombreCompleto: true, numeroDocumento: true, telefono: true },
    });
    const map = new Map(customers.map((c) => [c.id, c]));

    return sales.map((s) => ({
      ...map.get(s.customerId!),
      totalCompras: Number(s._sum.total ?? 0),
      cantidadTransacciones: s._count.id,
    }));
  }

  async getDeudores(businessId: string) {
    return this.prisma.customer.findMany({
      where: { businessId, isActive: true, creditoUsado: { gt: 0 } },
      select: {
        id: true, nombreCompleto: true, numeroDocumento: true,
        telefono: true, creditoLimite: true, creditoUsado: true,
      },
      orderBy: { creditoUsado: 'desc' },
    });
  }
}
