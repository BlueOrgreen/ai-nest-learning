import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Gateway');

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
