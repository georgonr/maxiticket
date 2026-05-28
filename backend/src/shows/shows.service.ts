import {
  Injectable, NotFoundException, ForbiddenException, ConflictException, Inject, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';
import { CreateShowDto, UpdateShowDto } from './dto/show.dto';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class ShowsService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  private orgId(user: JwtPayload): string {
    if (!user.organizerId) throw new ForbiddenException();
    return user.organizerId;
  }

  private assertAccess(organizerId: string, user: JwtPayload) {
    if (user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF) return;
    if (user.organizerId !== organizerId) throw new ForbiddenException();
  }

  findAll(user: JwtPayload) {
    const where =
      user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF
        ? {}
        : { organizerId: this.orgId(user) };
    return this.prisma.show.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { termins: true } } },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const show = await this.prisma.show.findUnique({
      where: { id },
      include: {
        termins: {
          orderBy: { startsAt: 'asc' },
          include: { venue: true, ticketTypes: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!show) throw new NotFoundException();
    this.assertAccess(show.organizerId, user);
    return show;
  }

  async create(dto: CreateShowDto, user: JwtPayload) {
    const organizerId = this.orgId(user);
    const existing = await this.prisma.show.findUnique({
      where: { organizerId_slug: { organizerId, slug: dto.slug } },
    });
    if (existing) throw new ConflictException('Slug already in use');
    return this.prisma.show.create({ data: { ...dto as any, organizerId } });
  }

  async update(id: string, dto: UpdateShowDto, user: JwtPayload) {
    const show = await this.findOne(id, user);
    if (dto.slug && dto.slug !== show.slug) {
      const conflict = await this.prisma.show.findUnique({
        where: { organizerId_slug: { organizerId: show.organizerId, slug: dto.slug } },
      });
      if (conflict) throw new ConflictException('Slug already in use');
    }
    return this.prisma.show.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.show.delete({ where: { id } });
  }

  async uploadImage(id: string, buffer: Buffer, originalName: string, mimeType: string, size: number, user: JwtPayload) {
    if (!ALLOWED_MIME.includes(mimeType)) throw new BadRequestException('Invalid file type. Allowed: JPEG, PNG, WebP');
    if (size > MAX_BYTES) throw new BadRequestException('File too large (max 10 MB)');

    const show = await this.findOne(id, user);

    // Delete old image if present
    if (show.posterUrl) {
      const old = show.posterUrl.split('/').pop();
      if (old) await this.storage.deleteFile(old).catch(() => null);
    }

    const stored = await this.storage.saveImage(buffer, originalName, mimeType);
    await this.prisma.show.update({
      where: { id },
      data: { posterUrl: stored.url },
    });
    return { url: stored.url, thumbnailUrl: stored.thumbnailUrl };
  }
}
