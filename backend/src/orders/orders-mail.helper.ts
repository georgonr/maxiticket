import { Logger } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/**
 * Loads a PAID order and sends tickets by email.
 * Used by fulfillOrder (Stripe/mock) and compOrder (SUPERADMIN).
 */
export async function sendTicketsForOrder(
  orderId: string,
  prisma: PrismaService,
  mail: MailService,
  logger: Logger,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      tickets: {
        where: { status: TicketStatus.VALID },
        include: { ticketType: { select: { name: true } } },
      },
      items: {
        include: {
          termin: {
            include: {
              show: { select: { name: true } },
              venue: { select: { name: true, city: true } },
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!order) {
    logger.error(`sendTicketsForOrder: order ${orderId} not found`);
    return;
  }

  const firstItem = order.items[0];
  const termin = firstItem?.termin;
  const show = termin?.show;
  const venue = termin?.venue;

  if (!show || !termin || !venue) {
    logger.error(`sendTicketsForOrder: missing show/termin/venue for order ${orderId}`);
    return;
  }

  await mail.sendTickets({
    to: order.buyerEmail,
    buyerName: order.buyerName ?? undefined,
    orderNumber: order.orderNumber,
    showName: show.name,
    startsAt: termin.startsAt,
    timezone: termin.timezone,
    venueName: venue.name,
    venueCity: venue.city ?? undefined,
    tickets: order.tickets.map((t) => ({
      id: t.id,
      typeName: t.ticketType?.name ?? 'Vstupenka',
      qrToken: t.qrToken,
    })),
  });

  logger.log(`sendTicketsForOrder: sent ${order.tickets.length} ticket(s) for order ${orderId} to ${order.buyerEmail}`);
}
