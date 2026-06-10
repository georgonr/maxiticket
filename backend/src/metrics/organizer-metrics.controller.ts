import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

@Controller('organizer/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER, UserRole.SUPERADMIN)
export class OrganizerMetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Get('overview')
  overview(@CurrentUser() user: JwtPayload, @Query('organizerId') organizerId?: string) {
    return this.svc.organizerOverview(user, organizerId);
  }

  @Get('sales-trend')
  salesTrend(
    @CurrentUser() user: JwtPayload,
    @Query('days') days?: string,
    @Query('organizerId') organizerId?: string,
  ) {
    return this.svc.organizerSalesTrend(user, Number(days), organizerId);
  }

  @Get('top-shows')
  topShows(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('organizerId') organizerId?: string,
  ) {
    return this.svc.organizerTopShows(user, Number(limit), organizerId);
  }

  @Get('recent-orders')
  recentOrders(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('organizerId') organizerId?: string,
  ) {
    return this.svc.organizerRecentOrders(user, Number(limit), organizerId);
  }
}
