import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AdminMetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Get('overview')
  overview() {
    return this.svc.adminOverview();
  }

  @Get('sales-trend')
  salesTrend(@Query('days') days?: string) {
    return this.svc.adminSalesTrend(Number(days));
  }

  @Get('top-shows')
  topShows(@Query('limit') limit?: string) {
    return this.svc.adminTopShows(Number(limit));
  }

  @Get('recent-orders')
  recentOrders(@Query('limit') limit?: string) {
    return this.svc.adminRecentOrders(Number(limit));
  }

  @Get('organizers')
  organizers(@Query('limit') limit?: string, @Query('sort') sort?: string) {
    return this.svc.adminOrganizers(Number(limit), sort);
  }
}
