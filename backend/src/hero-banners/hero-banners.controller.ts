import {
  Controller, Get, Post, Patch, Delete, Param, Body, Req,
  UseGuards, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { HeroBannersService } from './hero-banners.service';
import { CreateHeroBannerDto, UpdateHeroBannerDto, PromoteShowDto } from './dto/hero-banner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { FastifyRequest } from 'fastify';

// ── Hero Banner CRUD ──────────────────────────────────────────────────────────

@Controller('admin/hero-banners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class HeroBannersController {
  constructor(private readonly svc: HeroBannersService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: CreateHeroBannerDto) { return this.svc.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHeroBannerDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) { return this.svc.remove(id); }

  @Post('upload-image')
  async uploadImage(@Req() req: FastifyRequest) {
    if (!req.isMultipart()) throw new BadRequestException('Expected multipart/form-data');
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        return this.svc.uploadImage(buffer, part.filename, part.mimetype, buffer.length);
      }
    }
    throw new BadRequestException('No file uploaded');
  }
}

// ── Admin Shows (promote toggle) ──────────────────────────────────────────────

@Controller('admin/shows')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AdminShowsController {
  constructor(private readonly svc: HeroBannersService) {}

  @Get()
  listShows() { return this.svc.listShowsForAdmin(); }

  @Patch(':id/promote')
  promote(@Param('id') id: string, @Body() dto: PromoteShowDto) {
    return this.svc.setPromoted(id, dto.isPromoted, dto.sliderImageId);
  }
}
