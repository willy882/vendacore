FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json nest-cli.json ./
COPY src ./src

# URL de placeholder para prisma generate en build (Render inyecta la real al correr)
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN npx prisma generate
RUN npx @nestjs/cli build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma --accept-data-loss && node dist/main"]
