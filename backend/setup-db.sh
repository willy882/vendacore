#!/bin/bash
# ─────────────────────────────────────────────────────────────
# VendaCore — Setup de base de datos Neon
# Ejecutar una sola vez después de configurar DATABASE_URL
# ─────────────────────────────────────────────────────────────

echo ""
echo "🚀 VendaCore — Configurando base de datos..."
echo ""

# Verificar que DATABASE_URL no es el placeholder
if grep -q "PEGAR_AQUI" .env; then
  echo "❌ ERROR: Primero pega tu CONNECTION STRING de Neon en el archivo .env"
  echo "   Línea: DATABASE_URL=\"postgresql://...\""
  exit 1
fi

echo "📋 Paso 1/3 — Generando cliente Prisma..."
npx prisma generate --config prisma.config.ts

echo ""
echo "🗄️  Paso 2/3 — Creando tablas en la base de datos..."
npx prisma db push --config prisma.config.ts

echo ""
echo "🌱 Paso 3/3 — Cargando datos iniciales (seed)..."
npx ts-node --project tsconfig.json -e "
require('dotenv').config();
require('ts-node').register({ transpileOnly: true });
require('./prisma/seed.ts');
"

echo ""
echo "✅ ¡Base de datos configurada!"
echo ""
echo "   Usuario admin creado:"
echo "   📧 Email:    admin@vendacore.app"
echo "   🔑 Password: Admin123!"
echo ""
echo "   Para iniciar el backend:"
echo "   npm run start:dev"
echo ""
