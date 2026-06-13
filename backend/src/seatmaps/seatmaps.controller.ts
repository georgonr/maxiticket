import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SeatmapsService } from './seatmaps.service';
import {
  CreateSeatMapDto,
  UpdateSeatMapDto,
  CreateSectionDto,
  UpdateSectionDto,
} from './dto/seatmap.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

// Čítanie povolené všetkým org rolám; mutácie len OWNER + super/staff (MEMBER read-only).
const READ_ROLES = [
  UserRole.SUPERADMIN,
  UserRole.STAFF,
  UserRole.ORGANIZER_OWNER,
  UserRole.ORGANIZER_MEMBER,
] as const;
const MANAGE_ROLES = [
  UserRole.SUPERADMIN,
  UserRole.STAFF,
  UserRole.ORGANIZER_OWNER,
] as const;

// ── /v1/venues/:venueId/seatmaps ──────────────────────────
@Controller('venues/:venueId/seatmaps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...READ_ROLES)
export class VenueSeatmapsController {
  constructor(private readonly svc: SeatmapsService) {}

  @Post()
  @Roles(...MANAGE_ROLES)
  create(
    @Param('venueId') venueId: string,
    @Body() dto: CreateSeatMapDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.svc.createMap(venueId, dto, u);
  }

  @Get()
  list(@Param('venueId') venueId: string, @CurrentUser() u: JwtPayload) {
    return this.svc.listMaps(venueId, u);
  }
}

// ── /v1/seatmaps/:id (+ sekcie) ───────────────────────────
@Controller('seatmaps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...READ_ROLES)
export class SeatmapsController {
  constructor(private readonly svc: SeatmapsService) {}

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.getMap(id, u);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSeatMapDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.svc.updateMap(id, dto, u);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.deleteMap(id, u);
  }

  @Post(':id/sections')
  @Roles(...MANAGE_ROLES)
  createSection(
    @Param('id') id: string,
    @Body() dto: CreateSectionDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.svc.createSection(id, dto, u);
  }
}

// ── /v1/sections/:id ──────────────────────────────────────
@Controller('sections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGE_ROLES)
export class SectionsController {
  constructor(private readonly svc: SeatmapsService) {}

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.svc.updateSection(id, dto, u);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.deleteSection(id, u);
  }
}
