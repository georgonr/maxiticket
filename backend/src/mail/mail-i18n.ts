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

/** Locale-aware dátum bez času (Europe/Bratislava) – pre coupon platnosť/PDF. */
export function mailFormatDateShort(date: Date, locale: MailLocale): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Bratislava',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

interface MailStrings {
  tickets: {
    subjectPrefix: string; heading: string; orderLabel: string; qrAlt: string; footer: string;
    summaryTitle: string; subtotalLabel: string; discountLabel: string; feeLabel: string; totalLabel: string;
  };
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
  // Krok 31e2: účtové e-maily (locale = request-time, default sk)
  passwordReset: {
    subject: string; heading: string; greeting: string;
    bodyPrefix: string; validity: string; button: string; ignore: string;
  };
  teamInvite: {
    subjectPrefix: string; subjectSuffix: string; heading: string; greeting: string;
    bodyPrefix: string; bodySuffix: string; body2Prefix: string; validity: string;
    button: string; ignore: string;
  };
  contact: { subjectTag: string; heading: string; nameLabel: string; emailLabel: string; subjectLabel: string };
  couponBatch: {
    subjectPrefix: string; countSuffix: string; heading: string;
    generatedPrefix: string; generatedSuffix: string;
    batchIdLabel: string; typeLabel: string; scopeLabel: string; validityLabel: string;
    body: string; footer: string;
  };
  // Krok 31e4: coupon metadata HODNOTY (typ/rozsah/platnosť) – JEDEN zdroj pre e-mail aj PDF.
  couponMeta: {
    type: { PERCENTAGE: string; FIXED_AMOUNT: string; FREE_TICKET: string };
    scope: { GLOBAL: string; ORGANIZER: string; SHOW: string; TICKET_TYPE: string };
    valueFree: string;
    validity: { range: string; until: string; from: string; unlimited: string };
  };
  // Krok 31e4: coupon-batch PDF chrome (organizátorovi).
  couponPdf: {
    titlePrefix: string; titleSuffix: string;
    rowBatchId: string; rowGenerated: string; rowType: string; rowValue: string; rowScope: string; rowValidity: string;
    codesHeading: string; footerSuffix: string;
  };
  // Krok 13c: fakturačný e-mail organizátorovi (PDF príloha).
  invoice: {
    subjectPrefix: string; heading: string;
    intro: string; numberLabel: string; totalLabel: string; dueLabel: string;
    body: string; footer: string;
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
      summaryTitle: 'Súhrn platby', subtotalLabel: 'Medzisúčet', discountLabel: 'Zľava', feeLabel: 'Poplatok za spracovanie', totalLabel: 'Celkom',
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
    passwordReset: {
      subject: 'Reset hesla – TicketAll',
      heading: 'Reset hesla',
      greeting: 'Dobrý deň',
      bodyPrefix: 'Dostali sme žiadosť o reset hesla pre váš účet. Kliknite na tlačidlo nižšie – link je platný',
      validity: '1 hodinu',
      button: 'Nastaviť nové heslo',
      ignore: 'Ak ste o reset nepožiadali, tento e-mail ignorujte. Vaše heslo zostane nezmenené.',
    },
    teamInvite: {
      subjectPrefix: 'Pozvánka do tímu',
      subjectSuffix: '– TicketAll',
      heading: 'Pozvánka do tímu',
      greeting: 'Dobrý deň',
      bodyPrefix: 'Boli ste pozvaný do tímu',
      bodySuffix: 'na platforme TicketAll. Ako člen tímu môžete spravovať podujatia, predávať na pokladni a skenovať vstupenky.',
      body2Prefix: 'Kliknutím nastavíte svoje heslo – link je platný',
      validity: '7 dní',
      button: 'Nastaviť heslo a vstúpiť',
      ignore: 'Ak ste túto pozvánku neočakávali, tento e-mail môžete ignorovať.',
    },
    contact: {
      subjectTag: '[Kontakt]',
      heading: 'Správa z kontaktného formulára',
      nameLabel: 'Meno:',
      emailLabel: 'E-mail:',
      subjectLabel: 'Predmet:',
    },
    couponBatch: {
      subjectPrefix: 'Vaše zľavové kupóny',
      countSuffix: 'ks',
      heading: 'Vaše zľavové kupóny',
      generatedPrefix: 'Vygenerovaných',
      generatedSuffix: 'kódov',
      batchIdLabel: 'Batch ID:',
      typeLabel: 'Typ zľavy:',
      scopeLabel: 'Rozsah:',
      validityLabel: 'Platnosť:',
      body: 'Kompletný zoznam kódov nájdete v priloženom PDF. Kódy distribuujte podľa vlastného uváženia.',
      footer: 'Tento e-mail je určený organizátorovi, nie koncovým zákazníkom.',
    },
    couponMeta: {
      type: { PERCENTAGE: 'Percentuálna zľava', FIXED_AMOUNT: 'Pevná suma', FREE_TICKET: 'Lístok zdarma' },
      scope: { GLOBAL: 'Celá platforma', ORGANIZER: 'Organizátor', SHOW: 'Podujatie', TICKET_TYPE: 'Typ vstupenky' },
      valueFree: '100 % (zdarma)',
      validity: { range: 'od {from} do {until}', until: 'do {until}', from: 'od {from}', unlimited: 'bez časového obmedzenia' },
    },
    couponPdf: {
      titlePrefix: 'Zľavové kupóny', titleSuffix: 'kódov',
      rowBatchId: 'Batch ID', rowGenerated: 'Vygenerované', rowType: 'Typ zľavy', rowValue: 'Hodnota', rowScope: 'Rozsah', rowValidity: 'Platnosť',
      codesHeading: 'Kódy kupónov',
      footerSuffix: 'Kupóny nie sú prenosné na tretie strany bez súhlasu organizátora.',
    },
    invoice: {
      subjectPrefix: 'Faktúra od TicketAll',
      heading: 'Faktúra od TicketAll',
      intro: 'V prílohe vám zasielame faktúru za služby platformy TicketAll.',
      numberLabel: 'Číslo faktúry:',
      totalLabel: 'Suma k úhrade:',
      dueLabel: 'Splatnosť:',
      body: 'Faktúru nájdete ako PDF prílohu tohto e-mailu. Pri úhrade uveďte číslo faktúry ako variabilný symbol.',
      footer: 'Tento e-mail je určený organizátorovi. V prípade otázok nás kontaktujte.',
    },
  },
  en: {
    tickets: {
      subjectPrefix: 'Your tickets',
      heading: 'Your tickets',
      orderLabel: 'Order',
      qrAlt: 'Ticket QR code',
      footer: 'Present your ticket at the entrance. Each QR code is single-use.',
      summaryTitle: 'Payment summary', subtotalLabel: 'Subtotal', discountLabel: 'Discount', feeLabel: 'Processing fee', totalLabel: 'Total',
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
    passwordReset: {
      subject: 'Password reset – TicketAll',
      heading: 'Password reset',
      greeting: 'Hello',
      bodyPrefix: 'We received a request to reset the password for your account. Click the button below – the link is valid for',
      validity: '1 hour',
      button: 'Set a new password',
      ignore: 'If you did not request a reset, please ignore this e-mail. Your password will remain unchanged.',
    },
    teamInvite: {
      subjectPrefix: 'Invitation to the team',
      subjectSuffix: '– TicketAll',
      heading: 'Invitation to the team',
      greeting: 'Hello',
      bodyPrefix: 'You have been invited to the team',
      bodySuffix: 'on the TicketAll platform. As a team member you can manage events, sell at the point of sale and scan tickets.',
      body2Prefix: 'Click to set your password – the link is valid for',
      validity: '7 days',
      button: 'Set password and enter',
      ignore: 'If you were not expecting this invitation, you can ignore this e-mail.',
    },
    contact: {
      subjectTag: '[Contact]',
      heading: 'Message from the contact form',
      nameLabel: 'Name:',
      emailLabel: 'E-mail:',
      subjectLabel: 'Subject:',
    },
    couponBatch: {
      subjectPrefix: 'Your discount coupons',
      countSuffix: 'pcs',
      heading: 'Your discount coupons',
      generatedPrefix: 'Generated',
      generatedSuffix: 'codes',
      batchIdLabel: 'Batch ID:',
      typeLabel: 'Discount type:',
      scopeLabel: 'Scope:',
      validityLabel: 'Validity:',
      body: 'The complete list of codes is in the attached PDF. Distribute the codes at your own discretion.',
      footer: 'This e-mail is intended for the organizer, not for end customers.',
    },
    couponMeta: {
      type: { PERCENTAGE: 'Percentage discount', FIXED_AMOUNT: 'Fixed amount', FREE_TICKET: 'Free ticket' },
      scope: { GLOBAL: 'Entire platform', ORGANIZER: 'Organizer', SHOW: 'Event', TICKET_TYPE: 'Ticket type' },
      valueFree: '100% (free)',
      validity: { range: 'from {from} to {until}', until: 'until {until}', from: 'from {from}', unlimited: 'no time limit' },
    },
    couponPdf: {
      titlePrefix: 'Discount coupons', titleSuffix: 'codes',
      rowBatchId: 'Batch ID', rowGenerated: 'Generated', rowType: 'Discount type', rowValue: 'Value', rowScope: 'Scope', rowValidity: 'Validity',
      codesHeading: 'Coupon codes',
      footerSuffix: 'Coupons are not transferable to third parties without the organizer\'s consent.',
    },
    invoice: {
      subjectPrefix: 'Invoice from TicketAll',
      heading: 'Invoice from TicketAll',
      intro: 'Please find attached your invoice for TicketAll platform services.',
      numberLabel: 'Invoice number:',
      totalLabel: 'Amount due:',
      dueLabel: 'Due date:',
      body: 'The invoice is attached as a PDF. When paying, please use the invoice number as the payment reference.',
      footer: 'This e-mail is intended for the organizer. Contact us if you have any questions.',
    },
  },
  cs: {
    tickets: {
      subjectPrefix: 'Vaše vstupenky',
      heading: 'Vaše vstupenky',
      orderLabel: 'Objednávka',
      qrAlt: 'QR kód vstupenky',
      footer: 'Vstupenku předložte při vstupu. Každý QR kód je jednorázový.',
      summaryTitle: 'Souhrn platby', subtotalLabel: 'Mezisoučet', discountLabel: 'Sleva', feeLabel: 'Poplatek za zpracování', totalLabel: 'Celkem',
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
    passwordReset: {
      subject: 'Reset hesla – TicketAll',
      heading: 'Reset hesla',
      greeting: 'Dobrý den',
      bodyPrefix: 'Obdrželi jsme žádost o reset hesla pro váš účet. Klikněte na tlačítko níže – odkaz je platný',
      validity: '1 hodinu',
      button: 'Nastavit nové heslo',
      ignore: 'Pokud jste o reset nežádali, tento e-mail ignorujte. Vaše heslo zůstane nezměněno.',
    },
    teamInvite: {
      subjectPrefix: 'Pozvánka do týmu',
      subjectSuffix: '– TicketAll',
      heading: 'Pozvánka do týmu',
      greeting: 'Dobrý den',
      bodyPrefix: 'Byli jste pozváni do týmu',
      bodySuffix: 'na platformě TicketAll. Jako člen týmu můžete spravovat akce, prodávat na pokladně a skenovat vstupenky.',
      body2Prefix: 'Kliknutím nastavíte své heslo – odkaz je platný',
      validity: '7 dní',
      button: 'Nastavit heslo a vstoupit',
      ignore: 'Pokud jste tuto pozvánku neočekávali, můžete tento e-mail ignorovat.',
    },
    contact: {
      subjectTag: '[Kontakt]',
      heading: 'Zpráva z kontaktního formuláře',
      nameLabel: 'Jméno:',
      emailLabel: 'E-mail:',
      subjectLabel: 'Předmět:',
    },
    couponBatch: {
      subjectPrefix: 'Vaše slevové kupóny',
      countSuffix: 'ks',
      heading: 'Vaše slevové kupóny',
      generatedPrefix: 'Vygenerováno',
      generatedSuffix: 'kódů',
      batchIdLabel: 'Batch ID:',
      typeLabel: 'Typ slevy:',
      scopeLabel: 'Rozsah:',
      validityLabel: 'Platnost:',
      body: 'Kompletní seznam kódů najdete v přiloženém PDF. Kódy distribuujte podle vlastního uvážení.',
      footer: 'Tento e-mail je určen pořadateli, nikoli koncovým zákazníkům.',
    },
    couponMeta: {
      type: { PERCENTAGE: 'Procentuální sleva', FIXED_AMOUNT: 'Pevná částka', FREE_TICKET: 'Vstupenka zdarma' },
      scope: { GLOBAL: 'Celá platforma', ORGANIZER: 'Pořadatel', SHOW: 'Akce', TICKET_TYPE: 'Typ vstupenky' },
      valueFree: '100 % (zdarma)',
      validity: { range: 'od {from} do {until}', until: 'do {until}', from: 'od {from}', unlimited: 'bez časového omezení' },
    },
    couponPdf: {
      titlePrefix: 'Slevové kupóny', titleSuffix: 'kódů',
      rowBatchId: 'Batch ID', rowGenerated: 'Vygenerováno', rowType: 'Typ slevy', rowValue: 'Hodnota', rowScope: 'Rozsah', rowValidity: 'Platnost',
      codesHeading: 'Kódy kupónů',
      footerSuffix: 'Kupóny nejsou přenosné na třetí strany bez souhlasu pořadatele.',
    },
    invoice: {
      subjectPrefix: 'Faktura od TicketAll',
      heading: 'Faktura od TicketAll',
      intro: 'V příloze vám zasíláme fakturu za služby platformy TicketAll.',
      numberLabel: 'Číslo faktury:',
      totalLabel: 'Částka k úhradě:',
      dueLabel: 'Splatnost:',
      body: 'Fakturu najdete jako PDF přílohu tohoto e-mailu. Při úhradě uveďte číslo faktury jako variabilní symbol.',
      footer: 'Tento e-mail je určen pořadateli. V případě dotazů nás kontaktujte.',
    },
  },
};
