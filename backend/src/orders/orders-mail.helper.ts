import { Logger } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService, TicketEmailData } from '../mail/mail.service';

/**
 * Načíta PAID objednávku a poskladá TicketEmailData (rovnaké dáta ako pre e-mail lístka).
 * Zdieľané medzi e-mailom (sendTicketsForOrder) a verejným PDF endpointom (guest ticket).
 * Vráti null ak objednávka/show/termín/venue chýba.
 */
export async function buildTicketEmailData(
  orderId: string,
  prisma: PrismaService,
): Promise<TicketEmailData | null> {
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

  if (!order) return null;

  const firstItem = order.items[0];
  const termin = firstItem?.termin;
  const show = termin?.show;
  const venue = termin?.venue;

  if (!show || !termin || !venue) return null;

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

  return {
    to: order.buyerEmail,
    locale: order.locale,
    buyerName: order.buyerName ?? undefined,
    orderNumber: order.orderNumber,
    // Krok 2/2: súhrn platby (celkom = cena lístkov po zľave + zákaznícky poplatok).
    summary: {
      subtotal: Number(order.totalAmount) + Number(order.discountAmount),
      discountAmount: Number(order.discountAmount),
      customerFeeAmount: Number(order.feeAmount),
      total: Number(order.totalAmount) + Number(order.feeAmount),
      currency: order.currency,
    },
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
  };
}

/**
 * Načíta PAID objednávku a pošle lístky e-mailom.
 * Používané z fulfillOrder (Stripe/mock) a compOrder (SUPERADMIN).
 */
export async function sendTicketsForOrder(
  orderId: string,
  prisma: PrismaService,
  mail: MailService,
  logger: Logger,
): Promise<void> {
  const data = await buildTicketEmailData(orderId, prisma);
  if (!data) {
    logger.error(`sendTicketsForOrder: order ${orderId} not found or missing show/termin/venue`);
    return;
  }
  await mail.sendTickets(data);
  logger.log(`sendTicketsForOrder: sent ${data.tickets.length} ticket(s) for order ${orderId} to ${data.to}`);
}
