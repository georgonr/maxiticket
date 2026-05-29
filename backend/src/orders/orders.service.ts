import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { MailService } from '../mail/mail.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, TerminStatus, TicketStatus } from '@prisma/client';
import { createHmac, randomUUID } from 'crypto';
import { PAYMENT_PROVIDER, PaymentProvider } from '../payment/payment.interface';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mail: MailService,
    @Inject(PAYMENT_PROVIDER) private paymentProvider: PaymentProvider,
  ) {}

  async createOrder(dto: CreateOrderDto, user: JwtPayload) {
    const termin = await this.prisma.termin.findUnique({
      where: { id: dto.terminId },
      include: { show: true, venue: true, ticketTypes: true },
    });
    if (!termin) throw new NotFoundException('Termin not found');
    if (termin.status !== TerminStatus.ON_SALE && termin.status !== TerminStatus.COMING_SOON) {
      throw new BadRequestException('This event is not available for purchase');
    }

    let totalAmount = 0;
    const validatedItems: { ticketType: any; quantity: number }[] = [];

    for (const item of dto.items) {
      const tt = termin.ticketTypes.find((t) => t.id === item.ticketTypeId);
      if (!tt) throw new NotFoundException(`TicketType ${item.ticketTypeId} not found`);
      if (!tt.isActive) throw new BadRequestException(`Ticket type ${tt.name} is not active`);
      if (item.quantity > tt.maxPerOrder) {
        throw new BadRequestException(`Max ${tt.maxPerOrder} tickets of type "${tt.name}" per order`);
      }

      const now = new Date();
      if (tt.saleStartsAt && now < tt.saleStartsAt) {
        throw new BadRequestException(`Sale for "${tt.name}" has not started yet`);
      }
      if (tt.saleEndsAt && now > tt.saleEndsAt) {
        throw new BadRequestException(`Sale for "${tt.name}" has ended`);
      }

      // Availability check – PENDING orders also reserve capacity
      if (tt.totalQuantity != null) {
        const sold = await this.prisma.orderItem.aggregate({
          where: {
            ticketTypeId: tt.id,
            order: { status: { in: [OrderStatus.PENDING, OrderStatus.PAID] } },
          },
          _sum: { quantity: true },
        });
        const remaining = tt.totalQuantity - (sold._sum.quantity ?? 0);
        if (remaining < item.quantity) {
          throw new BadRequestException(`Only ${remaining} ticket(s) of type "${tt.name}" remaining`);
        }
      }

      totalAmount += Number(tt.price) * item.quantity;
      validatedItems.push({ ticketType: tt, quantity: item.quantity });
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.order.count();
    const orderNumber = `MT-${year}-${String(count + 1).padStart(5, '0')}`;

    const buyerEmail = dto.buyerEmail ?? user.email;
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
    const buyerName =
      dto.buyerName ?? (dbUser ? `${dbUser.firstName ?? ''} ${dbUser.lastName ?? ''}`.trim() : undefined);

    const expiryMinutes = this.config.get<number>('ORDER_EXPIRY_MINUTES', 30);
    const expiresAt = new Date(Date.now() + Number(expiryMinutes) * 60 * 1000);

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        organizerId: termin.show.organizerId,
        userId: user.sub,
        buyerEmail,
        buyerName,
        buyerPhone: dto.buyerPhone,
        currency: validatedItems[0]?.ticketType.currency ?? 'EUR',
        totalAmount,
        status: OrderStatus.PENDING,
        expiresAt,
        items: {
          create: validatedItems.map(({ ticketType, quantity }) => ({
            ticketTypeId: ticketType.id,
            terminId: termin.id,
            quantity,
            unitPrice: ticketType.price,
            currency: ticketType.currency,
            priceSnapshot: {
              name: ticketType.name,
              price: Number(ticketType.price),
              currency: ticketType.currency,
              showName: termin.show.name,
              terminId: termin.id,
              startsAt: termin.startsAt,
            },
          })),
        },
      },
      include: { items: true },
    });

    return order;
  }

  async getOrder(id: string, user: JwtPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { ticketType: true } },
        tickets: { select: { id: true, status: true, ticketTypeId: true, qrToken: true } },
      },
    });
    if (!order) throw new NotFoundException();
    if (order.userId !== user.sub) throw new ForbiddenException();
    return order;
  }

  async initiateCheckout(orderId: string, user: JwtPayload): Promise<{ url: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { ticketType: true } } },
    });
    if (!order) throw new NotFoundException();
    if (order.userId !== user.sub) throw new ForbiddenException();
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(`Order is not pending (status: ${order.status})`);
    }

    const appBaseUrl = this.config.get('APP_BASE_URL', 'https://maxiticket.africa');
    const successUrl = `${appBaseUrl}/checkout/success/${orderId}`;
    const cancelUrl = `${appBaseUrl}/checkout/cancel`;

    const result = await this.paymentProvider.createCheckoutSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      currency: order.currency,
      items: order.items.map((item) => ({
        name: (item.priceSnapshot as any)?.name ?? item.ticketType?.name ?? 'Vstupenka',
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
      })),
      successUrl,
      cancelUrl,
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentRef: result.externalId,
        paymentProvider: result.synchronous ? 'mock' : 'stripe',
      },
    });

    if (result.synchronous) {
      await this.fulfillOrder(orderId, 'mock', result.externalId);
    }

    return { url: result.checkoutUrl };
  }

  /**
   * Marks an order PAID, generates tickets and sends the confirmation e-mail.
   * Idempotent via optimistic-lock: if status is no longer PENDING, throws BadRequest.
   */
  async fulfillOrder(orderId: string, provider: string, paymentRef?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            ticketType: true,
            termin: { include: { show: true, venue: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const hmacSecret =
      this.config.get<string>('QR_HMAC_SECRET') ?? this.config.get<string>('JWT_SECRET')!;

    // Atomic status transition: only succeeds if order is still PENDING
    const tickets = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PENDING },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          paymentProvider: provider,
          ...(paymentRef ? { paymentRef } : {}),
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(`Order ${orderId} is no longer pending`);
      }

      const created: any[] = [];
      for (const item of order.items) {
        for (let i = 0; i < item.quantity; i++) {
          const ticketId = randomUUID();
          const nonce = randomUUID();
          const qrToken = this.signQrToken(ticketId, item.terminId!, nonce, hmacSecret);
          const ticket = await tx.ticket.create({
            data: {
              id: ticketId,
              orderId,
              orderItemId: item.id,
              ticketTypeId: item.ticketTypeId!,
              terminId: item.terminId!,
              nonce,
              qrToken,
              status: TicketStatus.VALID,
            },
          });
          created.push({ ...ticket, ticketType: item.ticketType, termin: item.termin });
        }
      }
      return created;
    });

    const firstItem = order.items[0];
    const termin = firstItem?.termin;
    const show = termin?.show;
    const venue = termin?.venue;

    if (show && termin && venue) {
      this.mail
        .sendTickets({
          to: order.buyerEmail,
          buyerName: order.buyerName ?? undefined,
          orderNumber: order.orderNumber,
          showName: show.name,
          startsAt: termin.startsAt,
          timezone: termin.timezone,
          venueName: venue.name,
          venueCity: venue.city ?? undefined,
          tickets: tickets.map((t) => ({
            id: t.id,
            typeName: t.ticketType?.name ?? 'Vstupenka',
            qrToken: t.qrToken,
          })),
        })
        .catch((e) => this.logger.error(`Email failed for order ${orderId}: ${e.message}`));
    }
  }

  /**
   * Stores a Stripe event ID. Returns true if the event was already recorded (duplicate).
   */
  async recordStripeEvent(eventId: string): Promise<boolean> {
    try {
      await this.prisma.stripeEvent.create({ data: { id: eventId } });
      return false;
    } catch (e: any) {
      if (e.code === 'P2002') return true; // unique constraint – already processed
      throw e;
    }
  }

  /** Dev-only mock payment: kept as convenience fallback (PAYMENT_PROVIDER=mock only). */
  async mockPay(id: string, user: JwtPayload) {
    if (this.config.get('PAYMENT_PROVIDER', 'mock') !== 'mock') {
      throw new ForbiddenException('Mock payments are disabled');
    }
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException();
    if (order.userId !== user.sub) throw new ForbiddenException();
    await this.fulfillOrder(id, 'mock');
    return this.getOrder(id, user);
  }

  async getMyTickets(user: JwtPayload) {
    return this.prisma.ticket.findMany({
      where: { order: { userId: user.sub }, status: TicketStatus.VALID },
      include: {
        ticketType: { select: { name: true, price: true, currency: true } },
        termin: {
          select: {
            startsAt: true, timezone: true,
            show: { select: { name: true, slug: true } },
            venue: { select: { name: true, city: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyTicket(ticketId: string, user: JwtPayload) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        ticketType: { select: { name: true, price: true, currency: true } },
        order: { select: { orderNumber: true, userId: true } },
        termin: {
          select: {
            startsAt: true, timezone: true, doorsOpenAt: true,
            show: { select: { name: true, slug: true } },
            venue: { select: { name: true, city: true, street: true } },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException();
    if (ticket.order.userId !== user.sub) throw new ForbiddenException();
    return ticket;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingOrders() {
    const result = await this.prisma.order.updateMany({
      where: { status: OrderStatus.PENDING, expiresAt: { lt: new Date() } },
      data: { status: OrderStatus.CANCELLED },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} pending order(s)`);
    }
  }

  private signQrToken(ticketId: string, terminId: string, nonce: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(`${ticketId}:${terminId}:${nonce}`)
      .digest('base64url');
  }
}
