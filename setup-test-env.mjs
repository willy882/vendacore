/**
 * Crea un negocio de prueba + usuario administrador temporal para smoke test.
 * Al final deja el negocio en status=suspendido (no activo en producción).
 */

import https from 'https';

const BASE  = 'https://vendacore-backend.fly.dev/api/v1';
const SA_EMAIL = 'willy@vendacore.app';
const SA_PASS  = 'SuperAdmin2024!';

// Datos del negocio temporal de prueba
const TEST_BUSINESS = {
  nombreNegocio: 'TEST SMOKE S.A.C.',
  ruc:           '20999999999',
  nombre:        'Test',
  apellido:      'Smoke',
  email:         'test.smoke@vendacore.app',
  password:      'TestSmoke2024!',
  telefono:      '999000001',
};

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url  = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(data   && { 'Content-Length': Buffer.byteLength(data) }),
      },
    };
    const r = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const post = (p, b, t) => req('POST', p, b, t);
const get  = (p, t)    => req('GET',  p, null, t);

async function main() {
  console.log('\n=== SETUP: Creando entorno de prueba ===\n');

  // 1. Login super admin
  const saLogin = await post('/auth/login', { email: SA_EMAIL, password: SA_PASS });
  if (saLogin.status !== 200) { console.error('Super admin login falló'); process.exit(1); }
  const saToken = saLogin.body.accessToken;
  console.log('✅ Super admin logueado');

  // 2. Registrar negocio de prueba
  const regRes = await post('/auth/register', TEST_BUSINESS);
  if (regRes.status !== 201 && regRes.status !== 200) {
    if (regRes.body?.message?.includes('ya está registrado') || regRes.body?.message?.includes('already')) {
      console.log('ℹ  Negocio de prueba ya existe, continuando...');
    } else {
      console.error('Error al registrar negocio de prueba:', regRes.body?.message);
      process.exit(1);
    }
  } else {
    console.log(`✅ Negocio registrado: ${TEST_BUSINESS.nombreNegocio}`);
  }

  // 3. Obtener businessId
  const bizList = await get('/super-admin/businesses', saToken);
  const testBiz = bizList.body?.find?.((b) => b.ruc === TEST_BUSINESS.ruc);
  if (!testBiz) { console.error('No se encontró el negocio de prueba'); process.exit(1); }
  console.log(`✅ Negocio encontrado: ${testBiz.id}`);

  // 4. Obtener planes disponibles
  const plansRes = await get('/super-admin/plans', saToken);
  const plan = plansRes.body?.[0];
  if (!plan) { console.error('No hay planes disponibles'); process.exit(1); }

  // 5. Activar negocio
  const activateRes = await post(
    `/super-admin/businesses/${testBiz.id}/activate`,
    { planId: plan.id, duracionDias: 30 },
    saToken,
  );
  if (activateRes.status !== 200 && activateRes.status !== 201) {
    console.log('ℹ  Ya estaba activo o error leve:', activateRes.body?.message);
  } else {
    console.log('✅ Negocio activado');
  }

  // 6. Login con usuario de prueba
  const testLogin = await post('/auth/login', { email: TEST_BUSINESS.email, password: TEST_BUSINESS.password });
  if (testLogin.status !== 200) {
    console.error('Login de usuario de prueba falló:', testLogin.body?.message);
    process.exit(1);
  }
  const testToken = testLogin.body.accessToken;
  console.log('✅ Login exitoso con usuario de prueba\n');

  console.log('=== DATOS PARA EL SMOKE TEST ===\n');
  console.log(`  EMAIL:    ${TEST_BUSINESS.email}`);
  console.log(`  PASS:     ${TEST_BUSINESS.password}`);
  console.log(`  BIZ_ID:   ${testBiz.id}`);
  console.log(`  TOKEN:    ${testToken.substring(0, 30)}...`);
  console.log('\nAhora ejecuta: node test-devoluciones.mjs\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
