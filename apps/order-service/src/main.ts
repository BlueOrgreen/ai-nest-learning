import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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

  await app.listen(process.env.PORT ?? 3002);
  console.log('Order Service is running on port 3002');
}
bootstrap();
