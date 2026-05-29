import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
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
    await mkdir(join(this.uploadsDir, 'squares'), { recursive: true });

    const id = randomUUID();
    const filename = `${id}.webp`;
    const thumbFilename = `${id}_thumb.webp`;
    const squareFilename = `${id}_square.webp`;

    const mainPath = join(this.uploadsDir, filename);
    const thumbPath = join(this.uploadsDir, 'thumbs', thumbFilename);
    const squarePath = join(this.uploadsDir, 'squares', squareFilename);

    // Single-pass: process and write directly to file (avoids double-encoding)
    await Promise.all([
      // Main: max 1200px wide, enlarge small images to at least 800px, WebP Q85
      sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutReduction: false })
        .webp({ quality: 85 })
        .toFile(mainPath),
      // Thumb: 600×400 cover crop, WebP Q80
      sharp(buffer)
        .resize(600, 400, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(thumbPath),
      // Square: 1000×1000 cover crop, WebP Q85 (listing / cover cards)
      sharp(buffer)
        .resize(1000, 1000, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(squarePath),
    ]);

    const { size } = await import('fs/promises').then((m) => m.stat(mainPath));
    return {
      filename,
      url: `${this.baseUrl}/${filename}`,
      thumbnailUrl: `${this.baseUrl}/thumbs/${thumbFilename}`,
      squareUrl: `${this.baseUrl}/squares/${squareFilename}`,
      size,
      mimeType: 'image/webp',
    };
  }

  async deleteFile(filename: string): Promise<void> {
    const base = filename.replace('.webp', '');
    await Promise.allSettled([
      unlink(join(this.uploadsDir, filename)),
      unlink(join(this.uploadsDir, 'thumbs', `${base}_thumb.webp`)),
      unlink(join(this.uploadsDir, 'squares', `${base}_square.webp`)),
    ]);
  }
}
