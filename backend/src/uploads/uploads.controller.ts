import {
  Controller, Get, Param, Res, NotFoundException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

@Controller('uploads')
export class UploadsController {
  private readonly uploadsDir: string;

  constructor(config: ConfigService) {
    this.uploadsDir = config.get('UPLOADS_DIR', '/app/uploads');
  }

  @Get('images/squares/:filename')
  serveSquare(@Param('filename') filename: string, @Res() reply: FastifyReply) {
    return this.serveFile(join(this.uploadsDir, 'squares', filename), reply);
  }

  @Get('images/thumbs/:filename')
  serveThumb(@Param('filename') filename: string, @Res() reply: FastifyReply) {
    return this.serveFile(join(this.uploadsDir, 'thumbs', filename), reply);
  }

  @Get('images/:filename')
  serveImage(@Param('filename') filename: string, @Res() reply: FastifyReply) {
    return this.serveFile(join(this.uploadsDir, filename), reply);
  }

  private serveFile(filePath: string, reply: FastifyReply) {
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    const stream = createReadStream(filePath);
    reply.header('Content-Type', 'image/webp');
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(stream);
  }
}
