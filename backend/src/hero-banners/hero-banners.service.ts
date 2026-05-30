import {
  Injectable, NotFoundException, BadRequestException, Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../storage/storage.interface';
import { CreateHeroBannerDto, UpdateHeroBannerDto } from './dto/hero-banner.dto';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class HeroBannersService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  findAll() {
    return this.prisma.heroBanner.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async findOne(id: string) {
    const banner = await this.prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('HeroBanner not found');
    return banner;
  }

  async create(dto: CreateHeroBannerDto) {
    return this.prisma.heroBanner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        imageUrl: dto.imageUrl,
        ctaLabel: dto.ctaLabel ?? null,
        ctaUrl: dto.ctaUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
        activeUntil: dto.activeUntil ? new Date(dto.activeUntil) : null,
      },
    });
  }

  async update(id: string, dto: UpdateHeroBannerDto) {
    await this.findOne(id);
    return this.prisma.heroBanner.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.ctaLabel !== undefined && { ctaLabel: dto.ctaLabel }),
        ...(dto.ctaUrl !== undefined && { ctaUrl: dto.ctaUrl }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.activeFrom !== undefined && { activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null }),
        ...(dto.activeUntil !== undefined && { activeUntil: dto.activeUntil ? new Date(dto.activeUntil) : null }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.heroBanner.delete({ where: { id } });
  }

  async uploadImage(buffer: Buffer, filename: string, mimeType: string, size: number) {
    if (!ALLOWED_MIME.includes(mimeType)) throw new BadRequestException('Povolené: JPEG, PNG, WebP');
    if (size > MAX_BYTES) throw new BadRequestException('Súbor je príliš veľký (max 10 MB)');
    const stored = await this.storage.saveImage(buffer, filename, mimeType);
    return { imageUrl: stored.squareUrl };
  }

  async setPromoted(showId: string, isPromoted: boolean) {
    const show = await this.prisma.show.findUnique({ where: { id: showId }, select: { id: true } });
    if (!show) throw new NotFoundException('Show not found');
    return this.prisma.show.update({ where: { id: showId }, data: { isPromoted } });
  }

  listShowsForAdmin() {
    return this.prisma.show.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        isPromoted: true,
        category: true,
        images: { where: { isCover: true }, take: 1, select: { squareUrl: true } },
        termins: {
          orderBy: { startsAt: 'asc' },
          take: 1,
          select: { startsAt: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
