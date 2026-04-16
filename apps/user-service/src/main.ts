import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // 自动过滤掉 DTO 中未声明的字段
      forbidNonWhitelisted: true, // 有多余字段时直接报错
      transform: true,       // 自动将请求体转换为 DTO 类实例
    }),
  );
  await app.listen(process.env.PORT ?? 3001);
  console.log('User Service is running on port 3001');
}
bootstrap();
