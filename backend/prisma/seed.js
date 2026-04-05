"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const bcrypt = __importStar(require("bcrypt"));
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter });
const MODULES = [
    'ventas', 'inventario', 'compras', 'gastos', 'caja',
    'clientes', 'proveedores', 'facturacion', 'usuarios', 'auditoria', 'reportes',
];
const ACTIONS = ['ver', 'crear', 'editar', 'anular', 'eliminar'];
const ROLES = [
    { name: 'administrador', modules: MODULES, actions: ACTIONS },
    { name: 'supervisor', modules: MODULES, actions: ['ver', 'crear', 'editar', 'anular'] },
    { name: 'cajero', modules: ['ventas', 'caja', 'clientes', 'facturacion'], actions: ['ver', 'crear', 'anular'] },
    { name: 'vendedor', modules: ['ventas', 'clientes', 'inventario'], actions: ['ver', 'crear'] },
    { name: 'almacenero', modules: ['inventario', 'compras', 'proveedores'], actions: ['ver', 'crear', 'editar'] },
    { name: 'contabilidad', modules: ['reportes', 'gastos', 'facturacion', 'caja'], actions: ['ver', 'crear', 'editar'] },
    { name: 'auditor', modules: MODULES, actions: ['ver'] },
];
async function main() {
    console.log('🌱 Iniciando seed de VendaCore...\n');
    console.log('📋 Creando permisos...');
    const permissions = [];
    for (const module of MODULES) {
        for (const action of ACTIONS) {
            const perm = await prisma.permission.upsert({
                where: { module_action: { module, action } },
                update: {},
                create: { module, action, description: `${action} en ${module}` },
            });
            permissions.push(perm);
        }
    }
    console.log(`   ${permissions.length} permisos creados/verificados`);
    console.log('👥 Creando roles...');
    for (const roleDef of ROLES) {
        const role = await prisma.role.upsert({
            where: { name: roleDef.name },
            update: {},
            create: { name: roleDef.name, description: `Rol ${roleDef.name}` },
        });
        const rolePerms = permissions.filter((p) => roleDef.modules.includes(p.module) && roleDef.actions.includes(p.action));
        for (const perm of rolePerms) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
                update: {},
                create: { roleId: role.id, permissionId: perm.id },
            });
        }
        console.log(`   ✅ ${roleDef.name} (${rolePerms.length} permisos)`);
    }
    console.log('\n🏪 Creando negocio demo...');
    const business = await prisma.business.upsert({
        where: { ruc: '10000000001' },
        update: {},
        create: {
            ruc: '10000000001',
            razonSocial: 'MI NEGOCIO E.I.R.L.',
            nombreComercial: 'Mi Negocio',
            direccion: 'Av. Principal 123, Lima',
            telefono: '999999999',
            email: 'negocio@vendacore.app',
        },
    });
    console.log(`   ✅ ${business.razonSocial} (RUC: ${business.ruc})`);
    console.log('\n👤 Creando usuario administrador...');
    const adminRole = await prisma.role.findUnique({ where: { name: 'administrador' } });
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@vendacore.app' },
        update: {},
        create: {
            email: 'admin@vendacore.app',
            passwordHash,
            nombre: 'Administrador',
            apellido: 'VendaCore',
            businessId: business.id,
            roleId: adminRole.id,
            isActive: true,
        },
    });
    console.log(`   ✅ ${admin.email} / Admin123!`);
    console.log('\n💳 Creando métodos de pago...');
    const methods = [
        { nombre: 'Efectivo', tipo: 'efectivo' },
        { nombre: 'Yape', tipo: 'yape' },
        { nombre: 'Plin', tipo: 'plin' },
        { nombre: 'Transferencia', tipo: 'transferencia' },
        { nombre: 'Tarjeta Débito', tipo: 'tarjeta_debito' },
        { nombre: 'Tarjeta Crédito', tipo: 'tarjeta_credito' },
        { nombre: 'Crédito al Cliente', tipo: 'credito_cliente' },
    ];
    for (const m of methods) {
        await prisma.paymentMethod.upsert({
            where: { id: `default-${m.tipo}` },
            update: {},
            create: {
                id: `default-${m.tipo}`,
                nombre: m.nombre,
                tipo: m.tipo,
                businessId: business.id,
                isActive: true,
            },
        });
    }
    console.log(`   ✅ ${methods.length} métodos de pago creados`);
    console.log('\n📄 Creando series de comprobantes...');
    const series = [
        { serie: 'B001', tipoDocumento: 'boleta' },
        { serie: 'F001', tipoDocumento: 'factura' },
        { serie: 'BC01', tipoDocumento: 'nota_credito' },
        { serie: 'BD01', tipoDocumento: 'nota_debito' },
    ];
    for (const s of series) {
        await prisma.documentSeries.upsert({
            where: { businessId_serie: { businessId: business.id, serie: s.serie } },
            update: {},
            create: {
                serie: s.serie,
                tipoDocumento: s.tipoDocumento,
                businessId: business.id,
                correlativoActual: 0,
                isActive: true,
            },
        });
    }
    console.log(`   ✅ Series creadas: B001, F001, BC01, BD01`);
    console.log('\n🎉 Seed completado exitosamente!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 Credenciales de acceso:');
    console.log('   Email:    admin@vendacore.app');
    console.log('   Password: Admin123!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
main()
    .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map