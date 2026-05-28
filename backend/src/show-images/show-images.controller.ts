import {
  Controller, Get, Post, Delete, Patch, Param, Req, UseGuards,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ShowImagesService } from './show-images.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';
import { FastifyRequest } from 'fastify';

@Controller('shows/:showId/images')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShowImagesController {
  constructor(private readonly svc: ShowImagesService) {}

  @Get()
  findAll(@Param('showId') showId: string, @CurrentUser() u: JwtPayload) {
    return this.svc.findAll(showId, u);
  }

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  async upload(@Param('showId') showId: string, @Req() req: FastifyRequest, @CurrentUser() u: JwtPayload) {
    if (!req.isMultipart()) throw new BadRequestException('Expected multipart/form-data');
    const results = [];
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        const img = await this.svc.upload(showId, buffer, part.filename, part.mimetype, buffer.length, u);
        results.push(img);
      }
    }
    if (results.length === 0) throw new BadRequestException('No files uploaded');
    return results;
  }

  @Patch(':imageId/cover')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  setCover(@Param('showId') showId: string, @Param('imageId') imageId: string, @CurrentUser() u: JwtPayload) {
    return this.svc.setCover(showId, imageId, u);
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  remove(@Param('showId') showId: string, @Param('imageId') imageId: string, @CurrentUser() u: JwtPayload) {
    return this.svc.remove(showId, imageId, u);
  }
}
