/**
 * Krok 31e1: ľahký per-locale slovník pre objednávkové e-maily (sk/en/cs).
 * Žiadna ťažká i18n infra (nestjs-i18n) – len typovaný TS objekt + Intl formátovanie.
 * CS je strojový preklad. Názvy podujatí/typov lístkov = DB obsah, neprekladajú sa.
 */

export type MailLocale = 'sk' | 'en' | 'cs';

/** Bezpečne zúži ľubovoľný string (napr. Order.locale) na podporovaný MailLocale. */
export function normalizeMailLocale(s?: string | null): MailLocale {
  return s === 'en' || s === 'cs' ? s : 'sk';
}

const INTL_LOCALE: Record<MailLocale, string> = { sk: 'sk-SK', en: 'en-GB', cs: 'cs-CZ' };

/** Locale-aware dátum (rovnaké pole ako pôvodný sk-SK formát, len podľa locale). */
export function mailFormatDate(date: Date, timezone: string, locale: MailLocale): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** Locale-aware mena. */
export function mailFormatPrice(amount: number, currency: string, locale: MailLocale): string {
  try {
    return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

interface MailStrings {
  tickets: { subjectPrefix: string; heading: string; orderLabel: string; qrAlt: string; footer: string };
  terminCancelled: {
    subjectPrefix: string; heading: string; orderLabel: string; cancelledNotice: string;
    refundLabel: string; footer: string;
    refundInfo: { stripe: string; pos: string; comp: string; default: string };
  };
  refundRequested: {
    subjectPrefix: string; heading: string; introPrefix: string; introSuffix: string;
    orderLabel: string; customerLabel: string; amountLabel: string; reasonLabel: string;
    cta: string; footer: string;
  };
  refundApproved: {
    subjectPrefix: string; heading: string; greeting: string;
    bodyPrefix: string; bodyConnector: string; approvedWord: string; body2: string;
  };
  refundRejected: {
    subjectPrefix: string; heading: string; greeting: string;
    bodyPrefix: string; bodySuffix: string; noteLabel: string; footer: string;
  };
  pdf: {
    ticketWord: string; orderPrefix: string; organizerLabel: string; addressLabel: string;
    priceLabel: string; vatIncludedPrefix: string; vatNonPayer: string; platformLinePrefix: string;
  };
}

export const mailMessages: Record<MailLocale, MailStrings> = {
  sk: {
    tickets: {
      subjectPrefix: 'Vaše vstupenky',
      heading: 'Vaše vstupenky',
      orderLabel: 'Objednávka',
      qrAlt: 'QR kód vstupenky',
      footer: 'Vstupenku predložte pri vstupe. Každý QR kód je jednorazový.',
    },
    terminCancelled: {
      subjectPrefix: 'Termín zrušený',
      heading: 'Termín bol zrušený',
      orderLabel: 'Objednávka',
      cancelledNotice: 'Tento termín bol zrušený a vaše lístky boli zneplatnené.',
      refundLabel: 'Vrátenie peňazí:',
      footer: 'V prípade otázok kontaktujte organizátora podujatia.',
      refundInfo: {
        stripe: 'Peniaze vám vrátime na pôvodnú platobnú kartu (spracujeme manuálne, môže trvať niekoľko dní).',
        pos: 'Vrátenie peňazí zabezpečí organizátor (platba prebehla na mieste).',
        comp: 'Lístok bol komplimentárny (zdarma) – vrátenie peňazí sa neuplatňuje.',
        default: 'O spôsobe vrátenia peňazí vás bude kontaktovať organizátor.',
      },
    },
    refundRequested: {
      subjectPrefix: 'Nová žiadosť o vrátenie',
      heading: 'Nová žiadosť o vrátenie peňazí',
      introPrefix: 'Zákazník požiadal o vrátenie peňazí pre objednávku',
      introSuffix: '.',
      orderLabel: 'Objednávka:',
      customerLabel: 'Zákazník:',
      amountLabel: 'Suma:',
      reasonLabel: 'Dôvod:',
      cta: 'Spravovať žiadosti o vrátenie',
      footer: 'TicketAll · žiadosť spracujete v administrácii.',
    },
    refundApproved: {
      subjectPrefix: 'Žiadosť o vrátenie schválená',
      heading: 'Žiadosť o vrátenie bola schválená',
      greeting: 'Dobrý deň',
      bodyPrefix: 'Vaša žiadosť o vrátenie peňazí pre objednávku',
      bodyConnector: 'bola',
      approvedWord: 'schválená',
      body2: 'Vrátenie peňazí bude spracované a suma vám bude vrátená pôvodným spôsobom platby. Vaše vstupenky z tejto objednávky boli zneplatnené.',
    },
    refundRejected: {
      subjectPrefix: 'Žiadosť o vrátenie zamietnutá',
      heading: 'Žiadosť o vrátenie bola zamietnutá',
      greeting: 'Dobrý deň',
      bodyPrefix: 'Vaša žiadosť o vrátenie peňazí pre objednávku',
      bodySuffix: 'bola, žiaľ, zamietnutá. Vaša objednávka a vstupenky zostávajú platné.',
      noteLabel: 'Poznámka:',
      footer: 'V prípade otázok kontaktujte organizátora podujatia.',
    },
    pdf: {
      ticketWord: 'VSTUPENKA',
      orderPrefix: 'Obj:',
      organizerLabel: 'Organizátor:',
      addressLabel: 'Adresa:',
      priceLabel: 'Cena:',
      vatIncludedPrefix: 'zahŕňa DPH',
      vatNonPayer: 'neplatca DPH',
      platformLinePrefix: 'Predaj v mene a na účet organizátora:',
    },
  },
  en: {
    tickets: {
      subjectPrefix: 'Your tickets',
      heading: 'Your tickets',
      orderLabel: 'Order',
      qrAlt: 'Ticket QR code',
      footer: 'Present your ticket at the entrance. Each QR code is single-use.',
    },
    terminCancelled: {
      subjectPrefix: 'Date cancelled',
      heading: 'The date has been cancelled',
      orderLabel: 'Order',
      cancelledNotice: 'This date has been cancelled and your tickets have been invalidated.',
      refundLabel: 'Refund:',
      footer: 'If you have any questions, please contact the event organizer.',
      refundInfo: {
        stripe: 'We will refund the money to your original payment card (processed manually, may take a few days).',
        pos: 'The refund will be handled by the organizer (payment was made on site).',
        comp: 'The ticket was complimentary (free of charge) – no refund applies.',
        default: 'The organizer will contact you about the refund method.',
      },
    },
    refundRequested: {
      subjectPrefix: 'New refund request',
      heading: 'New refund request',
      introPrefix: 'A customer has requested a refund for order',
      introSuffix: '.',
      orderLabel: 'Order:',
      customerLabel: 'Customer:',
      amountLabel: 'Amount:',
      reasonLabel: 'Reason:',
      cta: 'Manage refund requests',
      footer: 'TicketAll · process the request in the admin area.',
    },
    refundApproved: {
      subjectPrefix: 'Refund request approved',
      heading: 'Your refund request has been approved',
      greeting: 'Hello',
      bodyPrefix: 'Your refund request for order',
      bodyConnector: 'has been',
      approvedWord: 'approved',
      body2: 'The refund will be processed and the amount returned to your original payment method. The tickets from this order have been invalidated.',
    },
    refundRejected: {
      subjectPrefix: 'Refund request rejected',
      heading: 'Your refund request has been rejected',
      greeting: 'Hello',
      bodyPrefix: 'Your refund request for order',
      bodySuffix: 'has unfortunately been rejected. Your order and tickets remain valid.',
      noteLabel: 'Note:',
      footer: 'If you have any questions, please contact the event organizer.',
    },
    pdf: {
      ticketWord: 'TICKET',
      orderPrefix: 'Order:',
      organizerLabel: 'Organizer:',
      addressLabel: 'Address:',
      priceLabel: 'Price:',
      vatIncludedPrefix: 'incl. VAT',
      vatNonPayer: 'not a VAT payer',
      platformLinePrefix: 'Sold in the name and on behalf of the organizer:',
    },
  },
  cs: {
    tickets: {
      subjectPrefix: 'Vaše vstupenky',
      heading: 'Vaše vstupenky',
      orderLabel: 'Objednávka',
      qrAlt: 'QR kód vstupenky',
      footer: 'Vstupenku předložte při vstupu. Každý QR kód je jednorázový.',
    },
    terminCancelled: {
      subjectPrefix: 'Termín zrušen',
      heading: 'Termín byl zrušen',
      orderLabel: 'Objednávka',
      cancelledNotice: 'Tento termín byl zrušen a vaše vstupenky byly zneplatněny.',
      refundLabel: 'Vrácení peněz:',
      footer: 'V případě dotazů kontaktujte pořadatele akce.',
      refundInfo: {
        stripe: 'Peníze vám vrátíme na původní platební kartu (zpracujeme ručně, může trvat několik dní).',
        pos: 'Vrácení peněz zajistí pořadatel (platba proběhla na místě).',
        comp: 'Vstupenka byla komplimentární (zdarma) – vrácení peněz se neuplatňuje.',
        default: 'O způsobu vrácení peněz vás bude kontaktovat pořadatel.',
      },
    },
    refundRequested: {
      subjectPrefix: 'Nová žádost o vrácení',
      heading: 'Nová žádost o vrácení peněz',
      introPrefix: 'Zákazník požádal o vrácení peněz za objednávku',
      introSuffix: '.',
      orderLabel: 'Objednávka:',
      customerLabel: 'Zákazník:',
      amountLabel: 'Částka:',
      reasonLabel: 'Důvod:',
      cta: 'Spravovat žádosti o vrácení',
      footer: 'TicketAll · žádost zpracujete v administraci.',
    },
    refundApproved: {
      subjectPrefix: 'Žádost o vrácení schválena',
      heading: 'Vaše žádost o vrácení byla schválena',
      greeting: 'Dobrý den',
      bodyPrefix: 'Vaše žádost o vrácení peněz za objednávku',
      bodyConnector: 'byla',
      approvedWord: 'schválena',
      body2: 'Vrácení peněz bude zpracováno a částka vám bude vrácena původním způsobem platby. Vstupenky z této objednávky byly zneplatněny.',
    },
    refundRejected: {
      subjectPrefix: 'Žádost o vrácení zamítnuta',
      heading: 'Vaše žádost o vrácení byla zamítnuta',
      greeting: 'Dobrý den',
      bodyPrefix: 'Vaše žádost o vrácení peněz za objednávku',
      bodySuffix: 'byla bohužel zamítnuta. Vaše objednávka a vstupenky zůstávají platné.',
      noteLabel: 'Poznámka:',
      footer: 'V případě dotazů kontaktujte pořadatele akce.',
    },
    pdf: {
      ticketWord: 'VSTUPENKA',
      orderPrefix: 'Obj:',
      organizerLabel: 'Pořadatel:',
      addressLabel: 'Adresa:',
      priceLabel: 'Cena:',
      vatIncludedPrefix: 'včetně DPH',
      vatNonPayer: 'neplátce DPH',
      platformLinePrefix: 'Prodej jménem a na účet pořadatele:',
    },
  },
};
