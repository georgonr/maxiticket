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
      organizer: true,
      tickets: {
        where: { status: TicketStatus.VALID },
        include: { ticketType: { select: { name: true, price: true, currency: true } } },
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

  // Platform singleton (legal footer + VAT defaults)
  const platform = await prisma.platformInfo.findFirst();
  const org = order.organizer;

  // Effective VAT rate for this organizer (0 if not a VAT payer)
  let effectiveVat = 0;
  if (org?.vatPayer) {
    if (org.vatRate != null) {
      effectiveVat = Number(org.vatRate);
    } else {
      const country = org.addressCountry ?? 'SK';
      if (country === 'CZ') effectiveVat = Number(platform?.defaultVatRateCz ?? 21);
      else if (country === 'SK') effectiveVat = Number(platform?.defaultVatRateSk ?? 20);
    }
  }

  await mail.sendTickets({
    to: order.buyerEmail,
    locale: order.locale,
    buyerName: order.buyerName ?? undefined,
    orderNumber: order.orderNumber,
    showName: show.name,
    startsAt: termin.startsAt,
    timezone: termin.timezone,
    venueName: venue.name,
    venueCity: venue.city ?? undefined,
    organizer: org
      ? {
          companyName: org.companyName,
          ico: org.ico,
          icDph: org.icDph,
          addressStreet: org.addressStreet,
          addressCity: org.addressCity,
          addressZip: org.addressZip,
          addressCountry: org.addressCountry,
          vatPayer: org.vatPayer,
          // pre-resolved effective rate so the PDF prints the correct %
          vatRate: org.vatPayer ? effectiveVat : null,
        }
      : undefined,
    platform: platform
      ? { legalName: platform.legalName, ico: platform.ico }
      : { legalName: 'TicketAll s.r.o.' },
    tickets: order.tickets.map((t) => ({
      id: t.id,
      typeName: t.ticketType?.name ?? 'Vstupenka',
      qrToken: t.qrToken,
      price: t.ticketType?.price != null ? Number(t.ticketType.price) : undefined,
      currency: t.ticketType?.currency ?? 'EUR',
    })),
  });

  logger.log(`sendTicketsForOrder: sent ${order.tickets.length} ticket(s) for order ${orderId} to ${order.buyerEmail}`);
}
