import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { OrganizersService } from './organizers.service';
import { UpdateOrganizerDto, UpdateOrganizerStatusDto } from './dto/update-organizer.dto';
import { UpdateOrganizerBusinessDto } from './dto/update-organizer-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';

@Controller('organizers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizersController {
  constructor(private readonly service: OrganizersService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF, UserRole.ORGANIZER_OWNER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPERADMIN, UserRole.STAFF)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizerStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateStatus(id, dto, user);
  }
}

// Separate controller for /v1/organizer/business (no :id – uses JWT organizerId)
import { Controller as Ctrl } from '@nestjs/common';

@Ctrl('organizer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizerBusinessController {
  constructor(private readonly service: OrganizersService) {}

  @Patch('business')
  @Roles(UserRole.ORGANIZER_OWNER, UserRole.SUPERADMIN)
  updateBusiness(
    @Body() dto: UpdateOrganizerBusinessDto,
    @CurrentUser() user: JwtPayload,
    @Query('organizerId') organizerIdOverride?: string,
  ) {
    return this.service.updateBusiness(dto, user, organizerIdOverride);
  }

  @Get('business')
  @Roles(UserRole.ORGANIZER_OWNER, UserRole.SUPERADMIN)
  getBusiness(
    @CurrentUser() user: JwtPayload,
    @Query('organizerId') organizerIdOverride?: string,
  ) {
    const targetId = user.role === 'SUPERADMIN' && organizerIdOverride
      ? organizerIdOverride
      : user.organizerId;
    if (!targetId) throw new Error('No organizer associated');
    return this.service.findOne(targetId, user);
  }
}
