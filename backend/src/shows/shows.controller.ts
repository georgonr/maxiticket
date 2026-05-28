import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
  HttpCode, HttpStatus, Req, BadRequestException,
} from '@nestjs/common';
import { ShowsService } from './shows.service';
import { CreateShowDto, UpdateShowDto } from './dto/show.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';
import { FastifyRequest } from 'fastify';

@Controller('shows')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShowsController {
  constructor(private readonly svc: ShowsService) {}

  @Get()
  findAll(@CurrentUser() u: JwtPayload) { return this.svc.findAll(u); }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() u: JwtPayload) { return this.svc.findOne(id, u); }

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  create(@Body() dto: CreateShowDto, @CurrentUser() u: JwtPayload) { return this.svc.create(dto, u); }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  update(@Param('id') id: string, @Body() dto: UpdateShowDto, @CurrentUser() u: JwtPayload) {
    return this.svc.update(id, dto, u);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER)
  remove(@Param('id') id: string, @CurrentUser() u: JwtPayload) { return this.svc.remove(id, u); }

  @Post(':id/image')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  async uploadImage(@Param('id') id: string, @Req() req: FastifyRequest, @CurrentUser() u: JwtPayload) {
    if (!req.isMultipart()) throw new BadRequestException('Expected multipart/form-data');
    const data = await req.file();
    if (!data) throw new BadRequestException('No file uploaded');
    const buffer = await data.toBuffer();
    return this.svc.uploadImage(id, buffer, data.filename, data.mimetype, buffer.length, u);
  }
}
