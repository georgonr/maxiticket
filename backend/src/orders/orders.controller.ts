import {
  Controller, Get, Post, Param, Body, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { FastifyRequest } from 'fastify';

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

  /** Initiate payment (Stripe or mock). Returns { url } to redirect to. */
  @Post('orders/:id/checkout')
  @HttpCode(HttpStatus.OK)
  checkout(@Param('id') id: string, @CurrentUser() user: JwtPayload, @Req() req: FastifyRequest) {
    const origin = (req.headers.origin as string | undefined)
      ?? (req.headers.host ? `https://${req.headers.host}` : undefined);
    return this.svc.initiateCheckout(id, user, origin);
  }

  /** Dev-only mock payment (PAYMENT_PROVIDER=mock). Kept for convenience. */
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
