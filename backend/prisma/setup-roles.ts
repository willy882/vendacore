/**
 * Setup: super_admin + negocios + usuarios
 * Ejecutar: npx ts-node prisma/setup-roles.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const MODULES = [
  'ventas', 'inventario', 'compras', 'gastos', 'caja',
  'clientes', 'proveedores', 'facturacion', 'usuarios', 'auditoria', 'reportes',
];
const ACTIONS = ['ver', 'crear', 'editar', 'anular', 'eliminar'];

async function main() {
  console.log('🚀 Configurando roles y negocios...\n');

  // 1. Crear rol super_admin con todos los permisos
  console.log('👑 Creando rol super_admin...');
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'super_admin' },
    update: { description: 'Administrador del sistema, acceso total a todos los negocios' },
    create: { name: 'super_admin', description: 'Administrador del sistema, acceso total a todos los negocios' },
  });

  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: perm.id },
    });
  }
  console.log(`   ✅ super_admin creado (${allPerms.length} permisos)`);

  // 2. Crear negocio Ozzo Coffee
  console.log('\n☕ Creando negocio Ozzo Coffee...');
  const ozzoBusiness = await prisma.business.upsert({
    where: { ruc: '20000000001' },
    update: {},
    create: {
      ruc: '20000000001',
      razonSocial: 'OZZO COFFEE S.A.C.',
      nombreComercial: 'Ozzo Coffee',
      direccion: 'Av. Principal 456',
      telefono: '999000001',
      email: 'ozzo@vendacore.app',
    },
  });
  console.log(`   ✅ ${ozzoBusiness.nombreComercial} (ID: ${ozzoBusiness.id})`);

  // 3. Crear negocio Licores & Bebidas
  console.log('\n🍺 Creando negocio Licores & Bebidas...');
  const licoresBusiness = await prisma.business.upsert({
    where: { ruc: '20000000002' },
    update: {},
    create: {
      ruc: '20000000002',
      razonSocial: 'LICORES Y BEBIDAS E.I.R.L.',
      nombreComercial: 'Licores & Bebidas',
      direccion: 'Jr. Comercio 789',
      telefono: '999000002',
      email: 'licores@vendacore.app',
    },
  });
  console.log(`   ✅ ${licoresBusiness.nombreComercial} (ID: ${licoresBusiness.id})`);

  // 4. Métodos de pago para los nuevos negocios
  const metodoPagos = [
    { id: 'efectivo', nombre: 'Efectivo', tipo: 'efectivo' },
    { id: 'yape', nombre: 'Yape', tipo: 'yape' },
    { id: 'plin', nombre: 'Plin', tipo: 'plin' },
    { id: 'transferencia', nombre: 'Transferencia', tipo: 'transferencia' },
    { id: 'tarjeta_debito', nombre: 'Tarjeta Débito', tipo: 'tarjeta_debito' },
    { id: 'tarjeta_credito', nombre: 'Tarjeta Crédito', tipo: 'tarjeta_credito' },
  ];

  for (const biz of [ozzoBusiness, licoresBusiness]) {
    for (const m of metodoPagos) {
      await prisma.paymentMethod.upsert({
        where: { id: `${biz.id}-${m.id}` },
        update: {},
        create: { id: `${biz.id}-${m.id}`, nombre: m.nombre, tipo: m.tipo as any, businessId: biz.id, isActive: true },
      });
    }

    const series = [
      { serie: 'B001', tipoDocumento: 'boleta' },
      { serie: 'F001', tipoDocumento: 'factura' },
    ];
    for (const s of series) {
      await prisma.documentSeries.upsert({
        where: { businessId_serie: { businessId: biz.id, serie: s.serie } },
        update: {},
        create: { serie: s.serie, tipoDocumento: s.tipoDocumento as any, businessId: biz.id, correlativoActual: 0, isActive: true },
      });
    }
  }
  console.log('\n   ✅ Métodos de pago y series creados para ambos negocios');

  // 5. Asignar admin@vendacore.app como super_admin (queda en el negocio demo)
  console.log('\n👤 Actualizando admin@vendacore.app → super_admin...');
  const adminUser = await prisma.user.update({
    where: { email: 'admin@vendacore.app' },
    data: {
      roleId: superAdminRole.id,
      nombre: 'Super',
      apellido: 'Admin',
    },
  });
  console.log(`   ✅ ${adminUser.email} → super_admin`);

  // 6. Mover Erick a Ozzo Coffee como administrador
  console.log('\n👤 Actualizando Erick@vendacore.app → administrador de Ozzo Coffee...');
  const adminRole = await prisma.role.findUnique({ where: { name: 'administrador' } });
  const erickUser = await prisma.user.update({
    where: { email: 'Erick@vendacore.app' },
    data: {
      businessId: ozzoBusiness.id,
      roleId: adminRole!.id,
    },
  });
  console.log(`   ✅ ${erickUser.email} → administrador en Ozzo Coffee`);

  // 7. Crear frank@vendacore.app como vendedor en Licores & Bebidas
  console.log('\n👤 Creando frank@vendacore.app → vendedor en Licores & Bebidas...');
  const vendedorRole = await prisma.role.findUnique({ where: { name: 'vendedor' } });
  const frankHash = await bcrypt.hash('Frank123!', 12);
  const frankUser = await prisma.user.upsert({
    where: { email: 'frank@vendacore.app' },
    update: { businessId: licoresBusiness.id, roleId: vendedorRole!.id },
    create: {
      email: 'frank@vendacore.app',
      passwordHash: frankHash,
      nombre: 'Frank',
      apellido: 'Vendedor',
      businessId: licoresBusiness.id,
      roleId: vendedorRole!.id,
      isActive: true,
    },
  });
  console.log(`   ✅ ${frankUser.email} → vendedor en Licores & Bebidas`);

  console.log('\n🎉 Configuración completada!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 Credenciales:');
  console.log('   admin@vendacore.app   / Admin123!   → super_admin');
  console.log('   Erick@vendacore.app   / (su password actual) → administrador Ozzo Coffee');
  console.log('   frank@vendacore.app   / Frank123!   → vendedor Licores & Bebidas');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());