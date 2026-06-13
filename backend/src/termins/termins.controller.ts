import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TerminsService } from './termins.service';
import { CreateTerminDto, UpdateTerminDto, UpdateTerminSectionDto } from './dto/termin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';

@Controller('shows/:showId/termins')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TerminsController {
  constructor(private readonly svc: TerminsService) {}

  @Get()
  findAll(@Param('showId') showId: string, @CurrentUser() u: JwtPayload) {
    return this.svc.findAll(showId, u);
  }

  @Get(':id')
  findOne(@Param('showId') showId: string, @Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.findOne(showId, id, u);
  }

  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  create(@Param('showId') showId: string, @Body() dto: CreateTerminDto, @CurrentUser() u: JwtPayload) {
    return this.svc.create(showId, dto, u);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  update(@Param('showId') showId: string, @Param('id') id: string, @Body() dto: UpdateTerminDto, @CurrentUser() u: JwtPayload) {
    return this.svc.update(showId, id, dto, u);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER)
  remove(@Param('showId') showId: string, @Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.remove(showId, id, u);
  }

  // ── Úloha 22/3a: sekcie termínu (SEATMAP režim) ──────────────────────────────
  @Get(':id/sections')
  listSections(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.listSections(id, u);
  }

  @Patch(':id/sections/:terminSectionId')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER)
  setSectionPrice(
    @Param('id') id: string,
    @Param('terminSectionId') terminSectionId: string,
    @Body() dto: UpdateTerminSectionDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.svc.setSectionPrice(id, terminSectionId, dto, u);
  }
}
