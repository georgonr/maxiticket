import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyMultipart from '@fastify/multipart';
import { Transform } from 'stream';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const fastify = app.getHttpAdapter().getInstance() as any;

  // Catch-all content-type parser: handles requests with no Content-Type header
  // (e.g. PATCH /images/.../cover which sends no body).
  // Without this, Fastify 4 throws FST_ERR_CTP_INVALID_MEDIA_TYPE for such requests.
  // Specific parsers (application/json, multipart/form-data) take precedence over '*'.
  fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (_req: any, body: Buffer, done: any) => {
    done(null, body.length > 0 ? body : undefined);
  });

  // Capture raw body for the Stripe webhook BEFORE parsing (needed for signature verification).
  // Uses a preParsing passthrough stream so the normal JSON parser still gets the full body.
  // Only active for the webhook route – all other routes are unaffected.
  fastify.addHook('preParsing', async (req: any, _rep: any, payload: any) => {
    if (!req.url?.includes('/payments/webhook/stripe')) return;

    const chunks: Buffer[] = [];
    const passThrough = new Transform({
      transform(chunk: Buffer, _: string, cb: () => void) {
        chunks.push(chunk);
        this.push(chunk);
        cb();
      },
      flush(cb: () => void) {
        req.rawBody = Buffer.concat(chunks).toString('utf8');
        cb();
      },
    });

    payload.pipe(passThrough);
    return passThrough;
  });

  await app.register(fastifyMultipart as any, {
    limits: { fileSize: 10 * 1024 * 1024, files: 20 },
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
