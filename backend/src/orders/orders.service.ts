import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../casl/casl-ability.factory';
import { MailService } from '../mail/mail.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, TerminStatus, TicketStatus } from '@prisma/client';
import { createHmac, randomUUID } from 'crypto';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mail: MailService,
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

    // Validate each item
    let totalAmount = 0;
    const validatedItems: { ticketType: any; quantity: number }[] = [];

    for (const item of dto.items) {
      const tt = termin.ticketTypes.find((t) => t.id === item.ticketTypeId);
      if (!tt) throw new NotFoundException(`TicketType ${item.ticketTypeId} not found`);
      if (!tt.isActive) throw new BadRequestException(`Ticket type ${tt.name} is not active`);
      if (item.quantity > tt.maxPerOrder) {
        throw new BadRequestException(`Max ${tt.maxPerOrder} tickets of type "${tt.name}" per order`);
      }

      // Check sale window
      const now = new Date();
      if (tt.saleStartsAt && now < tt.saleStartsAt) {
        throw new BadRequestException(`Sale for "${tt.name}" has not started yet`);
      }
      if (tt.saleEndsAt && now > tt.saleEndsAt) {
        throw new BadRequestException(`Sale for "${tt.name}" has ended`);
      }

      // Check availability
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

    // Generate order number
    const year = new Date().getFullYear();
    const count = await this.prisma.order.count();
    const orderNumber = `MT-${year}-${String(count + 1).padStart(5, '0')}`;

    const buyerEmail = dto.buyerEmail ?? user.email;
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
    const buyerName = dto.buyerName ?? (dbUser ? `${dbUser.firstName ?? ''} ${dbUser.lastName ?? ''}`.trim() : undefined);

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

  async mockPay(id: string, user: JwtPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { ticketType: true, termin: { include: { show: true, venue: true } } } },
      },
    });
    if (!order) throw new NotFoundException();
    if (order.userId !== user.sub) throw new ForbiddenException();
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not in PENDING state');
    }

    const hmacSecret = this.config.get<string>('QR_HMAC_SECRET') ?? this.config.get<string>('JWT_SECRET')!;

    // Generate tickets in a transaction
    const tickets = await this.prisma.$transaction(async (tx) => {
      // Mark order PAID
      await tx.order.update({
        where: { id },
        data: { status: OrderStatus.PAID, paidAt: new Date(), paymentProvider: 'mock' },
      });

      const created: any[] = [];
      for (const item of order.items) {
        for (let i = 0; i < item.quantity; i++) {
          const ticketId = randomUUID();
          const nonce = randomUUID();
          const qrToken = this.signQrToken(ticketId, item.terminId!, nonce, hmacSecret);
          const ticket = await tx.ticket.create({
            data: {
              id: ticketId,
              orderId: id,
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

    // Send email
    const firstItem = order.items[0];
    const termin = firstItem?.termin;
    const show = termin?.show;
    const venue = termin?.venue;

    if (show && termin && venue) {
      await this.mail.sendTickets({
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
      }).catch((e) => console.error('Email failed:', e));
    }

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

  private signQrToken(ticketId: string, terminId: string, nonce: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(`${ticketId}:${terminId}:${nonce}`)
      .digest('base64url');
  }
}
