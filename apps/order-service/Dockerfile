FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY apps/order-service ./apps/order-service
COPY libs ./libs

RUN npm install -g pnpm \
  && pnpm install --frozen-lockfile \
  && pnpm exec nest build order-service

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3002

CMD ["node", "dist/apps/order-service/main.js"]
