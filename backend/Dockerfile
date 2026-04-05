# ── Stage 1: Builder ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependencias (incluye devDependencies para compilar)
COPY package*.json ./
RUN npm ci

# Copiar código fuente
COPY . .

# Generar cliente Prisma y compilar TypeScript
RUN npx prisma generate --config prisma.config.ts
RUN npm run build

# ── Stage 2: Production ─────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Copiar archivos de Prisma antes de instalar (necesario para postinstall)
COPY prisma ./prisma
COPY prisma.config.ts .

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Generar cliente Prisma en imagen de producción
RUN npx prisma generate --config prisma.config.ts

# Copiar el código compilado
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/main.js"]
