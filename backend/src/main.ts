import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyMultipart from '@fastify/multipart';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  await app.register(fastifyMultipart as any, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  app.enableCors({
    origin: [
      'https://maxiticket.africa',
      'https://www.maxiticket.africa',
      'https://admin.maxiticket.africa',
      'https://skener.maxiticket.africa',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('v1');

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on port ${port}`);
}

bootstrap();
