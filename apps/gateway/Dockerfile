FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY apps/gateway ./apps/gateway
COPY libs ./libs

RUN npm install -g pnpm \
  && pnpm install --frozen-lockfile \
  && pnpm exec nest build gateway

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3010

CMD ["node", "dist/apps/gateway/main.js"]
