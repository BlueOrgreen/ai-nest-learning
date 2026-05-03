FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/gateway ./apps/gateway
COPY libs ./libs

RUN npm install -g pnpm && pnpm install && pnpm build --filter= gateway

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/apps/gateway/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3010

CMD ["node", "dist/apps/gateway/main.js"]