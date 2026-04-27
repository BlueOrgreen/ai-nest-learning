import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';

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

  // 全局异常过滤器（最先注册，兜底所有未捕获异常）
  app.useGlobalFilters(new AllExceptionsFilter());

  // 全局拦截器（注册顺序 = 执行顺序）
  // ① LoggingInterceptor  — 记录 handler 名称、耗时、状态码
  // ② TransformInterceptor — 包装成功响应（@SkipTransform() 可跳过）
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(new Reflector()),
  );

  const port = process.env.PORT ?? 3010;

  // ── Swagger ──────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gateway API')
    .setDescription(
      '网关入口文档。\n\n' +
      '- 用户接口（`/api/users/*`）代理至 User Service，详细文档见 [http://localhost:3001/docs](http://localhost:3001/docs)\n' +
      '- 订单接口（`/api/orders/*`）代理至 Order Service，详细文档见 [http://localhost:3002/docs](http://localhost:3002/docs)\n' +
      '- 认证：POST /auth/login 获取 JWT，后续请求在 Authorization 头携带 `Bearer <token>`',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);
  // 访问：http://localhost:3010/docs
  // ─────────────────────────────────────────────────────

  await app.listen(port);
  logger.log(`Gateway is running on http://localhost:${port}`);
  logger.log('Proxying:  /api/users  → http://localhost:3001');
  logger.log('Proxying:  /api/orders → http://localhost:3002');
}
bootstrap();
