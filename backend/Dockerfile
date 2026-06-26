FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig.json nest-cli.json ./
COPY src ./src

# URL de placeholder para prisma generate en build (Render inyecta la real al correr)
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN npx prisma generate
RUN npx @nestjs/cli build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/main"]
