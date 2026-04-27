import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter, TransformInterceptor } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // 自动过滤掉 DTO 中未声明的字段
      forbidNonWhitelisted: true, // 有多余字段时直接报错
      transform: true,            // 自动将请求体转换为 DTO 类实例
    }),
  );

  // 统一异常响应格式：{ code, message, data: null }
  app.useGlobalFilters(new AllExceptionsFilter());

  // 统一成功响应格式：{ code: 0, data: T, message: "ok" }
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Swagger ──────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('User Service API')
    .setDescription('用户服务接口文档，包含用户 CRUD 及健康检查')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  // 访问：http://localhost:3001/docs
  // JSON：http://localhost:3001/docs-json
  // ─────────────────────────────────────────────────────

  await app.listen(process.env.PORT ?? 3001);
  console.log('User Service is running on port 3001');
}
bootstrap();
