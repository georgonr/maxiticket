import {
  Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return this.svc.createOrder(dto, user);
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.getOrder(id, user);
  }

  @Post('orders/:id/pay')
  @HttpCode(HttpStatus.OK)
  mockPay(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.mockPay(id, user);
  }

  @Get('my/tickets')
  myTickets(@CurrentUser() user: JwtPayload) {
    return this.svc.getMyTickets(user);
  }

  @Get('my/tickets/:id')
  myTicket(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.getMyTicket(id, user);
  }
}
