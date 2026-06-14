import {
  Controller, Get, Post, Patch, Put, Delete, Param, Query, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { VenuesService } from './venues.service';
import { CreateVenueDto, UpdateVenueDto, SetVenueAccessDto } from './dto/venue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

@Controller('venues')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPERADMIN,
  UserRole.STAFF,
  UserRole.ORGANIZER_OWNER,
  UserRole.ORGANIZER_MEMBER,
)
export class VenuesController {
  constructor(private readonly svc: VenuesService) {}

  @Get()
  findAll(
    @CurrentUser() u: JwtPayload,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('organizerId') organizerId?: string,
  ) {
    return this.svc.findAll(u, { search, isActive, organizerId });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.findOne(id, u);
  }

  // ── Úloha 24: zdieľanie miesta (SUPERADMIN/STAFF) ────────────────────────────
  @Get(':id/access')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF)
  getAccess(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.getAccess(id, u);
  }

  @Put(':id/access')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF)
  setAccess(@Param('id') id: string, @Body() dto: SetVenueAccessDto, @CurrentUser() u: JwtPayload) {
    return this.svc.setAccess(id, dto.organizerIds, u);
  }

  @Post()
  create(
    @Body() dto: CreateVenueDto,
    @CurrentUser() u: JwtPayload,
    @Query('global') global?: string,
    @Query('organizerId') organizerId?: string,
  ) {
    return this.svc.create(dto, u, { global: global === 'true', organizerId });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVenueDto, @CurrentUser() u: JwtPayload) {
    return this.svc.update(id, dto, u);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    return this.svc.remove(id, u);
  }
}
