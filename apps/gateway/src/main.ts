import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Gateway');

  // CORS：允许前端跨域访问网关接口
  // 开发阶段放行 localhost 常用端口；生产环境应替换为真实域名
  app.enableCors({
    origin: [
      'http://localhost:3000', // React / Next.js
      'http://localhost:5173', // Vite
      'http://localhost:4200', // Angular
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'], // 允许前端读取响应头中的 x-request-id
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3010;
  await app.listen(port);
  logger.log(`Gateway is running on http://localhost:${port}`);
  logger.log('Proxying:  /api/users  → http://localhost:3001');
  logger.log('Proxying:  /api/orders → http://localhost:3002');
}
bootstrap();
