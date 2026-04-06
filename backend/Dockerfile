FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate --config prisma.config.ts
RUN npx @nestjs/cli build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --config prisma.config.ts --accept-data-loss && node dist/main"]
