import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import * as sharp from 'sharp';
import { StorageService, StoredFile } from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly uploadsDir: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.uploadsDir = config.get('UPLOADS_DIR', '/app/uploads');
    this.baseUrl = config.get('UPLOADS_BASE_URL', 'https://api.maxiticket.africa/v1/uploads/images');
  }

  async saveImage(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
    await mkdir(this.uploadsDir, { recursive: true });
    await mkdir(join(this.uploadsDir, 'thumbs'), { recursive: true });

    const id = randomUUID();
    const filename = `${id}.webp`;
    const thumbFilename = `${id}_thumb.webp`;

    const mainPath = join(this.uploadsDir, filename);
    const thumbPath = join(this.uploadsDir, 'thumbs', thumbFilename);

    // Main: max 1200px wide, convert to WebP
    const mainBuffer = await sharp(buffer)
      .resize(1200, undefined, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Thumb: 600x400 cover crop
    const thumbBuffer = await sharp(buffer)
      .resize(600, 400, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    await Promise.all([
      sharp(mainBuffer).toFile(mainPath),
      sharp(thumbBuffer).toFile(thumbPath),
    ]);

    return {
      filename,
      url: `${this.baseUrl}/${filename}`,
      thumbnailUrl: `${this.baseUrl}/thumbs/${thumbFilename}`,
      size: mainBuffer.length,
      mimeType: 'image/webp',
    };
  }

  async deleteFile(filename: string): Promise<void> {
    const thumbFilename = filename.replace('.webp', '_thumb.webp');
    await Promise.allSettled([
      unlink(join(this.uploadsDir, filename)),
      unlink(join(this.uploadsDir, 'thumbs', thumbFilename)),
    ]);
  }
}
