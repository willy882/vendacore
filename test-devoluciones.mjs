/**
 * Smoke test — Devoluciones con integración de caja
 * Prepara datos (método pago, categoría, producto, venta) y verifica el flujo completo.
 */

import https from 'https';

const BASE  = 'https://vendacore-backend.fly.dev/api/v1';
const EMAIL = 'test.smoke@vendacore.app';
const PASS  = 'TestSmoke2024!';

// ── HTTP helper ──────────────────────────────────────────────────────────────

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

const get  = (p, t)    => req('GET',   p, null, t);
const post = (p, b, t) => req('POST',  p, b,    t);

// ── Helpers de resultado ─────────────────────────────────────────────────────

function ok(label, cond, detail = '') {
  if (cond) {
    console.log(`  ✅ ${label}${detail ? ' → ' + detail : ''}`);
  } else {
    console.log(`  ❌ ${label}${detail ? ' → ' + detail : ''}`);
    process.exitCode = 1;
  }
}

function warn(msg) { console.log(`  ⚠  ${msg}`); }

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  SMOKE TEST — Devoluciones + Caja');
  console.log('══════════════════════════════════════════\n');

  // 1. Login
  console.log('1. Login...');
  const loginRes = await post('/auth/login', { email: EMAIL, password: PASS });
  ok('Login exitoso', loginRes.status === 200, `status ${loginRes.status}`);
  if (loginRes.status !== 200) { console.log('     Error:', loginRes.body?.message); return; }
  const token = loginRes.body.accessToken;
  console.log(`     Usuario: ${loginRes.body.user?.nombre} ${loginRes.body.user?.apellido}\n`);

  // 2. Obtener o crear método de pago
  console.log('2. Métodos de pago...');
  let pmRes = await get('/sales/payment-methods', token);
  let pm = pmRes.body?.[0];
  if (!pm) {
    warn('Sin métodos de pago. Creando "Efectivo"...');
    const createPm = await post('/payment-methods', { nombre: 'Efectivo', tipo: 'efectivo' }, token);
    ok('Método de pago creado', createPm.status === 201, `status ${createPm.status}`);
    if (createPm.status !== 201) { console.log('     Error:', createPm.body?.message); return; }
    pmRes = await get('/sales/payment-methods', token);
    pm = pmRes.body?.[0];
  } else {
    ok('Método de pago disponible', true, pm.nombre);
  }
  console.log();

  // 3. Obtener o crear categoría + producto
  console.log('3. Productos...');
  let prodRes = await get('/products?limit=1', token);
  let prod = prodRes.body?.data?.[0];
  if (!prod) {
    warn('Sin productos. Creando categoría y producto de prueba...');

    // Crear categoría
    const catRes = await post('/products/categories', { nombre: 'Prueba' }, token);
    const catId  = catRes.body?.id;
    ok('Categoría creada', !!catId, catId ? 'OK' : catRes.body?.message);
    if (!catId) return;

    // Crear producto
    const newProd = await post('/products', {
      nombre:        'Producto Smoke Test',
      codigoInterno: 'SMOKE-001',
      categoryId:    catId,
      precioVenta:   50,
      precioCompra:  30,
      stockInicial:  20,
      stockMinimo:   2,
    }, token);
    ok('Producto creado', newProd.status === 201, `status ${newProd.status} | ${newProd.body?.nombre}`);
    if (newProd.status !== 201) { console.log('     Error:', newProd.body?.message); return; }
    prod = newProd.body;
  } else {
    ok('Producto disponible', true, `${prod.nombre} | stock: ${prod.stockActual}`);
  }
  console.log();

  // 4. Verificar/abrir sesión de caja
  console.log('4. Sesión de caja...');
  let cajaRes = await get('/cash/active', token);
  let cajaBefore = 0;
  let cashSessionId = null;
  if (cajaRes.status === 200 && cajaRes.body?.id) {
    cashSessionId = cajaRes.body.id;
    cajaBefore = Number(cajaRes.body.saldoActual ?? 0);
    ok('Sesión de caja activa', true, `saldo: S/.${cajaBefore.toFixed(2)}`);
  } else {
    warn('No hay caja abierta. Abriendo...');
    const openRes = await post('/cash/open', { montoApertura: 200 }, token);
    ok('Caja abierta', openRes.status === 201 || openRes.status === 200, `status ${openRes.status}`);
    if (openRes.status !== 201 && openRes.status !== 200) { console.log('     Error:', openRes.body?.message); return; }
    cashSessionId = openRes.body?.id;
    cajaBefore = 200;
  }
  console.log();

  // 5. Crear venta de prueba (3 unidades)
  console.log('5. Creando venta de prueba (3 unidades a S/.50)...');
  const precioUnit = Number(prod.precioVenta ?? 50);
  const cantidadVenta = 3;
  const totalVenta = precioUnit * cantidadVenta * 1.18; // con IGV

  const stockAntesVenta = Number(prod.stockActual ?? 0);

  const saleRes = await post('/sales', {
    tipoVenta: 'contado',
    cashSessionId,
    items: [{ productId: prod.id, cantidad: cantidadVenta, precioUnitario: precioUnit }],
    payments: [{ paymentMethodId: pm.id, monto: totalVenta }],
  }, token);
  ok('Venta creada', saleRes.status === 201, `status ${saleRes.status}`);
  if (saleRes.status !== 201) { console.log('     Error:', saleRes.body?.message); return; }
  const saleId  = saleRes.body.id;
  const saleItemId = saleRes.body.items?.[0]?.id;
  console.log(`     Venta ID: ...${saleId?.slice(-8)} | Total S/.${Number(saleRes.body.total).toFixed(2)}\n`);

  // Actualizar saldo de caja después de la venta
  const cajaPostVenta = await get('/cash/active', token);
  cajaBefore = Number(cajaPostVenta.body?.saldoActual ?? cajaBefore + totalVenta);

  // 6. Verificar stock antes de devolución
  console.log('6. Verificando stock después de venta...');
  await new Promise((r) => setTimeout(r, 500));
  const prodPostVenta = await get(`/products/${prod.id}`, token);
  const stockPostVenta = Number(prodPostVenta.body?.stockActual ?? 0);
  ok('Stock decrementado por venta', stockPostVenta === stockAntesVenta - cantidadVenta,
    `${stockAntesVenta} → ${stockPostVenta}`);
  console.log();

  // 7. Procesar devolución de 1 unidad
  console.log('7. Procesando devolución de 1 unidad...');
  const cantDevolver = 1;
  const returnRes = await post(`/sales/${saleId}/return`, {
    items: [{ saleItemId, cantidad: cantDevolver }],
    motivo: 'Smoke test — defecto de fabricación',
  }, token);
  ok('Devolución procesada (200)', returnRes.status === 200 || returnRes.status === 201,
    `status ${returnRes.status}`);
  if (returnRes.status !== 200 && returnRes.status !== 201) {
    console.log('     Error:', returnRes.body?.message ?? JSON.stringify(returnRes.body));
    return;
  }
  const montoDevolucion = returnRes.body?.montoDevolucion ?? 0;
  ok('montoDevolucion correcto',
    Math.abs(montoDevolucion - precioUnit * cantDevolver) < 0.01,
    `S/.${montoDevolucion.toFixed(2)} (esperado S/.${(precioUnit * cantDevolver).toFixed(2)})`);
  ok('cajaActualizada = true', returnRes.body?.cajaActualizada === true,
    String(returnRes.body?.cajaActualizada));
  console.log();

  // 8. Verificar stock después de devolución
  console.log('8. Verificando restauración de stock...');
  await new Promise((r) => setTimeout(r, 800));
  const prodFinal = await get(`/products/${prod.id}`, token);
  const stockFinal = Number(prodFinal.body?.stockActual ?? 0);
  ok('Stock restaurado (+1)',
    stockFinal === stockPostVenta + cantDevolver,
    `${stockPostVenta} → ${stockFinal} (esperado ${stockPostVenta + cantDevolver})`);
  console.log();

  // 9. Verificar egreso en caja
  console.log('9. Verificando egreso en caja...');
  const cajaFinal = await get('/cash/active', token);
  const saldoFinal = Number(cajaFinal.body?.saldoActual ?? 0);
  ok('Saldo caja decrementado por devolución',
    Math.abs(saldoFinal - (cajaBefore - montoDevolucion)) < 0.01,
    `antes: S/.${cajaBefore.toFixed(2)} | devuelto: S/.${montoDevolucion.toFixed(2)} | después: S/.${saldoFinal.toFixed(2)}`);
  console.log();

  // 10. Prevención de doble devolución (intentar devolver más de lo disponible)
  console.log('10. Prevención de doble devolución excesiva...');
  const doubleRes = await post(`/sales/${saleId}/return`, {
    items: [{ saleItemId, cantidad: cantidadVenta }], // cantidad original completa (ya se devolvió 1)
    motivo: 'Intento malicioso de doble devolución',
  }, token);
  ok('Exceso rechazado (400)', doubleRes.status === 400,
    `status ${doubleRes.status} | ${String(doubleRes.body?.message ?? '').slice(0, 70)}`);
  console.log();

  // 11. Devolución de venta anulada debe fallar
  console.log('11. Devolución sobre venta inexistente debe fallar...');
  const badRes = await post(`/sales/00000000-0000-0000-0000-000000000000/return`, {
    items: [{ saleItemId: '00000000-0000-0000-0000-000000000001', cantidad: 1 }],
    motivo: 'Test',
  }, token);
  ok('Venta inexistente rechazada (400/404)', badRes.status === 400 || badRes.status === 404,
    `status ${badRes.status}`);
  console.log();

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════');
  if (process.exitCode === 1) {
    console.log('  ❌ RESULTADO: Hay fallos — revisar antes de dar acceso a clientes');
  } else {
    console.log('  ✅ RESULTADO: Todos los checks pasaron');
    console.log('     Módulo de devoluciones listo para uso en producción.');
  }
  console.log('══════════════════════════════════════════\n');
}

run().catch((e) => { console.error('Error inesperado:', e.message); process.exitCode = 1; });
