import {
  Controller, Post, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CompOrderDto } from './dto/comp-order.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class AdminOrdersController {
  constructor(private readonly svc: OrdersService) {}

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
