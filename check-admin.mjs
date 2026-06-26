import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4xZsCrkN5SXB@ep-lucky-dew-acippqy4-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const users = await client.query(`
  SELECT u.email, u."isActive", u."failedLoginAttempts", u."lockedUntil",
         b."razonSocial", b.status as "businessStatus", r.name as role
  FROM users u
  LEFT JOIN businesses b ON u."businessId" = b.id
  LEFT JOIN roles r ON u."roleId" = r.id
  ORDER BY u.email
`);

console.log('\n=== TODOS LOS USUARIOS ===\n');
for (const r of users.rows) {
  const locked = r.lockedUntil && new Date(r.lockedUntil) > new Date();
  console.log(`${r.email} [${r.role}]`);
  console.log(`  isActive: ${r.isActive} | failedAttempts: ${r.failedLoginAttempts}${locked ? ' | BLOQUEADO hasta ' + r.lockedUntil : ''}`);
  console.log(`  Negocio: ${r.razonSocial ?? 'N/A'} (${r.businessStatus ?? 'N/A'})\n`);
}

const biz = await client.query(`SELECT "razonSocial", ruc, status FROM businesses ORDER BY "razonSocial"`);
console.log('=== NEGOCIOS ===\n');
biz.rows.forEach(b => console.log(`  ${b.razonSocial} | RUC: ${b.ruc} | status: ${b.status}`));

await client.end();
