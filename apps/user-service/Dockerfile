FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/user-service ./apps/user-service
COPY libs ./libs

RUN npm install -g pnpm && pnpm install && pnpm build --filter= user-service

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/apps/user-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/apps/user-service/main.js"]