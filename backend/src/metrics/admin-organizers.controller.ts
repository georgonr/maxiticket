import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

/**
 * Krok: super-admin „Organizátori" – zoznam VŠETKÝCH + detail.
 * Guard: SUPERADMIN aj STAFF (ostatné role 403).
 */
@Controller('admin/organizers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN, UserRole.STAFF)
export class AdminOrganizersController {
  constructor(private readonly svc: MetricsService) {}

  @Get()
  list(@Query('sort') sort?: string) {
    // VŠETCI organizátori (cap 100 – reuse adminOrganizers logiky).
    return this.svc.adminOrganizers(100, sort);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.adminOrganizerDetail(id);
  }
}
