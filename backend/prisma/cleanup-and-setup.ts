/**
 * Script de limpieza y configuración:
 * - Elimina Ozzo Coffee (e2b7c0c7) y el usuario Erick
 * - Actualiza Frank a rol administrador
 * - Crea cajero para Licores & Bebidas
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const OZZO_COFFEE_ID  = 'e2b7c0c7-0000-0000-0000-000000000001';
const LICORES_ID      = '06c8a2b4-0000-0000-0000-000000000001';

async function main() {
  // ── 1. Buscar IDs reales de los negocios ─────────────────────────────────
  const ozzo = await prisma.business.findFirst({
    where: { nombreComercial: { contains: 'Ozzo', mode: 'insensitive' } },
  });
  const licores = await prisma.business.findFirst({
    where: { nombreComercial: { contains: 'Licores', mode: 'insensitive' } },
  });
  const frank = await prisma.user.findUnique({ where: { email: 'frank@vendacore.app' } });
  const adminRole = await prisma.role.findUnique({ where: { name: 'administrador' } });
  const cajeroRole = await prisma.role.findUnique({ where: { name: 'cajero' } });

  console.log('Ozzo Coffee:', ozzo?.id, ozzo?.nombreComercial);
  console.log('Licores & Bebidas:', licores?.id, licores?.nombreComercial);
  console.log('Frank:', frank?.id, frank?.email, frank?.roleId);
  console.log('Rol administrador:', adminRole?.id);
  console.log('Rol cajero:', cajeroRole?.id);

  if (!licores || !frank || !adminRole || !cajeroRole) {
    throw new Error('Datos base no encontrados — revisa la BD');
  }

  // ── 2. Eliminar Ozzo Coffee y todos sus datos ─────────────────────────────
  if (ozzo) {
    console.log('\n🗑  Eliminando Ozzo Coffee...');

    // Documentos electrónicos
    await prisma.electronicDocument.deleteMany({ where: { businessId: ozzo.id } }).catch(() => {});

    // Pagos de ventas
    const ventasOzzo = await prisma.sale.findMany({ where: { businessId: ozzo.id }, select: { id: true } });
    const ventaIds = ventasOzzo.map(v => v.id);
    if (ventaIds.length) {
      await prisma.salePayment.deleteMany({ where: { saleId: { in: ventaIds } } });
      await prisma.saleItem.deleteMany({ where: { saleId: { in: ventaIds } } });
    }

    // Movimientos de caja
    const sesionesOzzo = await prisma.cashSession.findMany({ where: { businessId: ozzo.id }, select: { id: true } });
    const sesionIds = sesionesOzzo.map(s => s.id);
    if (sesionIds.length) {
      await prisma.cashMovement.deleteMany({ where: { cashSessionId: { in: sesionIds } } });
    }

    // Ventas
    await prisma.sale.deleteMany({ where: { businessId: ozzo.id } });

    // Sesiones de caja
    await prisma.cashSession.deleteMany({ where: { businessId: ozzo.id } });

    // Movimientos de inventario
    await prisma.inventoryMovement.deleteMany({ where: { businessId: ozzo.id } });

    // Productos
    await prisma.product.deleteMany({ where: { businessId: ozzo.id } });

    // Categorías
    await prisma.productCategory.deleteMany({ where: { businessId: ozzo.id } });

    // Compras
    const comprasOzzo = await prisma.purchase.findMany({ where: { businessId: ozzo.id }, select: { id: true } }).catch(() => []);
    if (comprasOzzo.length) {
      await prisma.purchaseItem.deleteMany({ where: { purchaseId: { in: comprasOzzo.map(c => c.id) } } }).catch(() => {});
      await prisma.purchase.deleteMany({ where: { businessId: ozzo.id } }).catch(() => {});
    }

    // Gastos
    await prisma.expense.deleteMany({ where: { businessId: ozzo.id } }).catch(() => {});
    await prisma.expenseCategory.deleteMany({ where: { businessId: ozzo.id } }).catch(() => {});

    // Clientes y proveedores
    await prisma.customer.deleteMany({ where: { businessId: ozzo.id } }).catch(() => {});
    await prisma.supplier.deleteMany({ where: { businessId: ozzo.id } }).catch(() => {});

    // Métodos de pago
    await prisma.paymentMethod.deleteMany({ where: { businessId: ozzo.id } }).catch(() => {});

    // Series de documentos
    await prisma.documentSeries.deleteMany({ where: { businessId: ozzo.id } }).catch(() => {});

    // Logs de auditoría
    await prisma.auditLog.deleteMany({ where: { businessId: ozzo.id } }).catch(() => {});

    // Usuarios de Ozzo Coffee (Erick)
    await prisma.user.deleteMany({ where: { businessId: ozzo.id } });

    // Negocio
    await prisma.business.delete({ where: { id: ozzo.id } });

    console.log('✅ Ozzo Coffee eliminado correctamente');
  } else {
    console.log('⚠  Ozzo Coffee no encontrado — ya fue eliminado o no existe');
  }

  // ── 3. Actualizar Frank a administrador ───────────────────────────────────
  await prisma.user.update({
    where: { id: frank.id },
    data: { roleId: adminRole.id },
  });
  console.log('\n✅ Frank actualizado a rol administrador');

  // ── 4. Crear cajero para Licores & Bebidas ────────────────────────────────
  const existingCajero = await prisma.user.findUnique({ where: { email: 'cajero@licoresbebidas.app' } });
  if (!existingCajero) {
    const hash = await bcrypt.hash('Cajero2025!', 12);
    const cajero = await prisma.user.create({
      data: {
        email:        'cajero@licoresbebidas.app',
        passwordHash: hash,
        nombre:       'Cajero',
        apellido:     'Licores',
        roleId:       cajeroRole.id,
        businessId:   licores.id,
        isActive:     true,
      },
    });
    console.log('✅ Cajero creado:', cajero.email, '| contraseña: Cajero2025!');
  } else {
    console.log('⚠  Cajero ya existe:', existingCajero.email);
  }

  // ── 5. Resumen final ──────────────────────────────────────────────────────
  console.log('\n── Resumen de usuarios activos ──');
  const usuarios = await prisma.user.findMany({
    include: { role: true, business: true },
    orderBy: { email: 'asc' },
  });
  for (const u of usuarios) {
    console.log(`  ${u.email} | ${u.role.name} | ${u.business?.nombreComercial ?? 'Sin negocio'} | activo: ${u.isActive}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());