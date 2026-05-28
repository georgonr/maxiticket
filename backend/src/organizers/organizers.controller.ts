import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { OrganizersService } from './organizers.service';
import { UpdateOrganizerDto, UpdateOrganizerStatusDto } from './dto/update-organizer.dto';
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
