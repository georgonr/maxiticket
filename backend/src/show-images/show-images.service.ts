import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ShowImagesService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  private async assertAccess(showId: string, user: JwtPayload) {
    const show = await this.prisma.show.findUnique({ where: { id: showId }, select: { organizerId: true } });
    if (!show) throw new NotFoundException('Show not found');
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) return;
    if (user.organizerId !== show.organizerId) throw new ForbiddenException();
  }

  findAll(showId: string, user: JwtPayload) {
    return this.assertAccess(showId, user).then(() =>
      this.prisma.showImage.findMany({
        where: { showId },
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  }

  async upload(showId: string, buffer: Buffer, filename: string, mimeType: string, size: number, user: JwtPayload) {
    await this.assertAccess(showId, user);
    if (!ALLOWED_MIME.includes(mimeType)) throw new BadRequestException('Povolené: JPEG, PNG, WebP');
    if (size > MAX_BYTES) throw new BadRequestException('Súbor je príliš veľký (max 10 MB)');

    const stored = await this.storage.saveImage(buffer, filename, mimeType);

    const count = await this.prisma.showImage.count({ where: { showId } });
    const nextOrder = count;

    return this.prisma.showImage.create({
      data: {
        showId,
        url: stored.url,
        thumbUrl: stored.thumbnailUrl,
        squareUrl: stored.squareUrl,
        isCover: count === 0, // first image auto-becomes cover
        sortOrder: nextOrder,
      },
    });
  }

  async setCover(showId: string, imageId: string, user: JwtPayload) {
    await this.assertAccess(showId, user);
    const img = await this.prisma.showImage.findFirst({ where: { id: imageId, showId } });
    if (!img) throw new NotFoundException();

    return this.prisma.$transaction(async (tx) => {
      await tx.showImage.updateMany({ where: { showId }, data: { isCover: false } });
      return tx.showImage.update({ where: { id: imageId }, data: { isCover: true } });
    });
  }

  async remove(showId: string, imageId: string, user: JwtPayload) {
    await this.assertAccess(showId, user);
    const img = await this.prisma.showImage.findFirst({ where: { id: imageId, showId } });
    if (!img) throw new NotFoundException();

    const filename = img.url.split('/').pop();
    if (filename) await this.storage.deleteFile(filename).catch(() => null);

    await this.prisma.showImage.delete({ where: { id: imageId } });

    if (img.isCover) {
      const next = await this.prisma.showImage.findFirst({
        where: { showId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) await this.prisma.showImage.update({ where: { id: next.id }, data: { isCover: true } });
    }
  }
}
