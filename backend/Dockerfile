# Modulo: backend
# Arquivo: Dockerfile
# Funcao no sistema: build e execucao containerizada da API Node.js na porta interna 3001.

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_SSL=require

EXPOSE 3001

CMD ["node", "server.js"]
