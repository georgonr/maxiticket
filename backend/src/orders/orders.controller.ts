import {
  Controller, Get, Post, Param, Body, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../casl/casl-ability.factory';
import { FastifyRequest } from 'fastify';

// Guest-friendly endpointy (create/checkout/getOrder) používajú OptionalJwtAuthGuard:
// prihlásený user → scoped na účet; guest → Order.userId=null, autorizácia cez cuid orderId.
@Controller()
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Post('orders')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateOrderDto, @Req() req: FastifyRequest, @CurrentUser() user?: JwtPayload) {
    // ip/ua pre záznam súhlasu s VOP (krok 44).
    return this.svc.createOrder(dto, user, req.ip, req.headers['user-agent']);
  }

  @Get('orders/:id')
  @UseGuards(OptionalJwtAuthGuard)
  getOrder(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.svc.getOrder(id, user);
  }

  /** Initiate payment (Stripe or mock). Returns { url } to redirect to. */
  @Post('orders/:id/checkout')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  checkout(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user?: JwtPayload,
    @Body() dto?: CheckoutDto,
  ) {
    const origin = (req.headers.origin as string | undefined)
      ?? (req.headers.host ? `https://${req.headers.host}` : undefined);
    return this.svc.initiateCheckout(id, user, origin, dto?.couponCode);
  }

  /** Dev-only mock payment (PAYMENT_PROVIDER=mock). Kept for convenience. */
  @Post('orders/:id/pay')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  mockPay(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.mockPay(id, user);
  }

  @Get('my/tickets')
  @UseGuards(JwtAuthGuard)
  myTickets(@CurrentUser() user: JwtPayload) {
    return this.svc.getMyTickets(user);
  }

  @Get('my/tickets/:id')
  @UseGuards(JwtAuthGuard)
  myTicket(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.getMyTicket(id, user);
  }
}
