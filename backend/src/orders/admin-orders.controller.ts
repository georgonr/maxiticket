import {
  Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { OrdersQueryService } from './orders-query.service';
import { CompOrderDto } from './dto/comp-order.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AdminOrdersController {
  constructor(
    private readonly svc: OrdersService,
    private readonly query: OrdersQueryService,
  ) {}

  @Get()
  list(
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
    return this.query.list({
      status, organizerId, showId, paymentProvider, search, dateFrom, dateTo, sort,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.query.detail(id);
  }

  @Post('comp')
  @HttpCode(HttpStatus.CREATED)
  comp(@Body() dto: CompOrderDto) {
    return this.svc.compOrder(dto);
  }

  @Post(':id/resend-tickets')
  @HttpCode(HttpStatus.OK)
  resend(@Param('id') id: string) {
    return this.svc.resendTickets(id);
  }
}
