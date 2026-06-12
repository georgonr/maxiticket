import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { UserRole } from '@prisma/client';
import { OrdersQueryService } from './orders-query.service';

@Controller('organizer/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER_OWNER, UserRole.ORGANIZER_MEMBER, UserRole.SUPERADMIN, UserRole.STAFF)
export class OrganizerOrdersController {
  constructor(private readonly query: OrdersQueryService) {}

  private isSuperOrStaff(user: JwtPayload): boolean {
    return user.role === UserRole.SUPERADMIN || user.role === UserRole.STAFF;
  }

  /** Organizer → vždy scoped na vlastný org; super/staff → voliteľný ?organizerId. */
  private scope(user: JwtPayload): string | undefined {
    return this.isSuperOrStaff(user) ? undefined : user.organizerId;
  }

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('organizerId') organizerId?: string,
    @Query('showId') showId?: string,
    @Query('paymentProvider') paymentProvider?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sort?: string,
  ) {
    return this.query.list(
      {
        status, organizerId, showId, paymentProvider, search, dateFrom, dateTo, sort,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
      this.scope(user),
    );
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.query.detail(id, this.scope(user));
  }
}
