import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter, TransformInterceptor } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 统一异常响应格式：{ code, message, data: null }
  app.useGlobalFilters(new AllExceptionsFilter());

  // 统一成功响应格式：{ code: 0, data: T, message: "ok" }
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Swagger ──────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Order Service API')
    .setDescription('订单服务接口文档，含并发异常 / 隔离级别 / 锁机制演示接口')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  // 访问：http://localhost:3002/docs
  // JSON：http://localhost:3002/docs-json
  // ─────────────────────────────────────────────────────

  // 启用优雅关闭钩子，确保进程退出时释放端口等资源
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3002);
  console.log('Order Service is running on port 3002');
}
bootstrap();
