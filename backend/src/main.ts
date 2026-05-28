import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.enableCors({
    origin: [
      'https://maxiticket.africa',
      'https://www.maxiticket.africa',
      'https://admin.maxiticket.africa',
      'https://skener.maxiticket.africa',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('v1');

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
