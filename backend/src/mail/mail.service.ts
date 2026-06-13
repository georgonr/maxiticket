import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as QRCode from 'qrcode';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface OrganizerPdfInfo {
  companyName?: string | null;
  ico?: string | null;
  icDph?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressZip?: string | null;
  addressCountry?: string | null;
  vatPayer: boolean;
  vatRate?: number | null;
}

export interface PlatformPdfInfo {
  legalName: string;
  ico?: string | null;
}

export interface TicketEmailData {
  to: string;
  buyerName?: string;
  orderNumber: string;
  showName: string;
  startsAt: Date;
  timezone: string;
  venueName: string;
  venueCity?: string;
  organizer?: OrganizerPdfInfo;
  platform?: PlatformPdfInfo;
  tickets: {
    id: string;
    typeName: string;
    qrToken: string;
    price?: number;
    currency?: string;
  }[];
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  // nest-cli copies src/assets/** → dist/assets/**; __dirname here is dist/mail
  private readonly fontPath = path.join(__dirname, '..', 'assets', 'fonts');

  constructor(private config: ConfigService) {
    const transport = this.config.get<string>('MAIL_TRANSPORT', 'mailpit');
    const secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';

    if (transport === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: Number(this.config.get<string>('SMTP_PORT', '465')),
        secure,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
        tls: { rejectUnauthorized: true },
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST', 'mailpit'),
        port: Number(this.config.get<string>('SMTP_PORT', '1025')),
        secure: false,
      });
    }

    this.logger.log(`Mail transport: ${transport} (${this.config.get('SMTP_HOST')}:${this.config.get('SMTP_PORT')})`);
  }

  async sendTickets(data: TicketEmailData): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');

    const attachments: nodemailer.SendMailOptions['attachments'] = [];
    const ticketHtmlParts: string[] = [];

    for (const ticket of data.tickets) {
      const qrPng = await QRCode.toBuffer(ticket.qrToken, { width: 300, margin: 2 });
      const cidKey = `qr_${ticket.id}`;

      attachments.push({ filename: `qr_${ticket.id}.png`, content: qrPng, cid: cidKey });

      const pdfBuf = await this.generateTicketPdf({ ...data, ticket, qrPng });
      attachments.push({
        filename: `vstupenka_${ticket.id.slice(-6).toUpperCase()}.pdf`,
        content: pdfBuf,
        contentType: 'application/pdf',
      });

      ticketHtmlParts.push(`
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:16px 0;text-align:center;">
          <p style="font-size:14px;color:#6b7280;margin:0 0 4px;">${ticket.typeName}</p>
          <img src="cid:${cidKey}" style="width:200px;height:200px;" alt="QR kód vstupenky"/>
          <p style="font-size:11px;color:#9ca3af;margin:8px 0 0;font-family:monospace;">${ticket.id.slice(-12).toUpperCase()}</p>
        </div>
      `);
    }

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
    <h1 style="font-size:22px;margin:12px 0 4px;">Vaše vstupenky</h1>
    <p style="color:#6b7280;margin:0;">Objednávka <strong>${data.orderNumber}</strong></p>
  </div>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
    <h2 style="font-size:18px;margin:0 0 8px;">${data.showName}</h2>
    <p style="color:#374151;margin:4px 0;">📅 ${this.formatDate(data.startsAt, data.timezone)}</p>
    <p style="color:#374151;margin:4px 0;">📍 ${data.venueName}${data.venueCity ? `, ${data.venueCity}` : ''}</p>
  </div>
  ${ticketHtmlParts.join('')}
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">
    Vstupenku predložte pri vstupe. Každý QR kód je jednorazový.
  </p>
</body></html>`;

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `Vaše vstupenky – ${data.showName}`,
      html,
      attachments,
    });

    this.logger.log(`Sent ${data.tickets.length} ticket(s) to ${data.to}`);
  }

  private async generateTicketPdf(
    data: TicketEmailData & {
      ticket: TicketEmailData['tickets'][0];
      qrPng: Buffer;
    },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // A6 landscape: 420 × 298 pt (≈148×105mm)
      const W = 420;
      const H = 298;
      const doc = new PDFDocument({ size: [W, H], margin: 0, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register fonts (embedded TTF → full Unicode incl. ľ š č ť ž ý á ä ô ú)
      const geistReg = path.join(this.fontPath, 'Geist-Regular.ttf');
      const geistBold = path.join(this.fontPath, 'Geist-Bold.ttf');
      const bebasReg = path.join(this.fontPath, 'BebasNeue-Regular.ttf');
      doc.registerFont('Geist', geistReg);
      doc.registerFont('GeistBold', geistBold);
      doc.registerFont('Bebas', bebasReg);

      const TEAL = '#10B981';
      const BLACK = '#111827';
      const GRAY = '#6B7280';
      const LGRAY = '#9CA3AF';
      const WHITE = '#FFFFFF';

      // ── Left stub (teal band) ────────────────────────────────────────────
      const STUB_W = 110;
      doc.rect(0, 0, STUB_W, H).fill(TEAL);

      // "VSTUPENKA" rotated 90° in stub
      doc.save();
      doc.translate(STUB_W / 2, H / 2);
      doc.rotate(-90);
      doc.fillColor(WHITE).font('Bebas').fontSize(26)
        .text('VSTUPENKA', -70, -13, { width: 140, align: 'center' });
      doc.restore();

      // TicketAll logo text in stub bottom
      doc.fillColor(WHITE).font('GeistBold').fontSize(8)
        .text('ticketall.eu', 0, H - 22, { width: STUB_W, align: 'center' });

      // ── Perforated divider ───────────────────────────────────────────────
      const perfX = STUB_W + 1;
      doc.save();
      doc.dash(4, { space: 4 });
      doc.moveTo(perfX, 10).lineTo(perfX, H - 10)
        .strokeColor('#D1D5DB').lineWidth(1).stroke();
      doc.undash();
      doc.restore();

      // ── Right body ───────────────────────────────────────────────────────
      const BODY_X = STUB_W + 12;
      const BODY_W = W - BODY_X - 12;
      const QR_W = 130;
      const QR_X = W - QR_W - 16;
      const TEXT_W = QR_X - BODY_X - 8;

      // Show name
      doc.fillColor(BLACK).font('Bebas').fontSize(22)
        .text(data.showName, BODY_X, 16, { width: TEXT_W, lineGap: -2 });

      // Date + venue
      const dateStr = this.formatDate(data.startsAt, data.timezone);
      doc.fillColor(TEAL).font('GeistBold').fontSize(9)
        .text(dateStr, BODY_X, 68, { width: TEXT_W });

      const venue = `${data.venueName}${data.venueCity ? `, ${data.venueCity}` : ''}`;
      doc.fillColor(GRAY).font('Geist').fontSize(9)
        .text(venue, BODY_X, 82, { width: TEXT_W });

      // Ticket type + price
      const priceStr = data.ticket.price != null
        ? this.formatPrice(data.ticket.price, data.ticket.currency ?? 'EUR')
        : '';
      doc.fillColor(BLACK).font('GeistBold').fontSize(11)
        .text(data.ticket.typeName + (priceStr ? `  ${priceStr}` : ''), BODY_X, 100, { width: TEXT_W });

      // Divider line
      doc.moveTo(BODY_X, 118).lineTo(W - 16, 118)
        .strokeColor('#E5E7EB').lineWidth(0.5).stroke();

      // QR code (right side)
      doc.rect(QR_X - 4, 14, QR_W + 8, QR_W + 8).fill('#FFFFFF');
      doc.image(data.qrPng, QR_X, 16, { width: QR_W, height: QR_W });

      // Ticket unique code under QR
      doc.fillColor(LGRAY).font('Geist').fontSize(7)
        .text(data.ticket.id.slice(-12).toUpperCase(), QR_X - 4, 16 + QR_W + 2, { width: QR_W + 8, align: 'center' });

      // Order number
      doc.fillColor(LGRAY).font('Geist').fontSize(7)
        .text(`Obj: ${data.orderNumber}`, QR_X - 4, 16 + QR_W + 14, { width: QR_W + 8, align: 'center' });

      // ── Legal footer ─────────────────────────────────────────────────────
      const FOOTER_Y = H - 62;
      doc.moveTo(STUB_W + 2, FOOTER_Y).lineTo(W - 4, FOOTER_Y)
        .strokeColor('#E5E7EB').lineWidth(0.5).stroke();

      const org = data.organizer;
      const plat = data.platform;
      const effectiveVat = this.computeVatRate(org);

      // Line 1: organizer identity
      if (org?.companyName) {
        let orgLine = `Organizátor: ${org.companyName}`;
        if (org.ico) orgLine += ` | IČO: ${org.ico}`;
        if (org.icDph) orgLine += ` | IČ DPH: ${org.icDph}`;
        doc.fillColor(LGRAY).font('Geist').fontSize(7)
          .text(orgLine, BODY_X, FOOTER_Y + 4, { width: BODY_W });
      }

      // Line 2: organizer address
      if (org?.addressStreet && org?.addressCity) {
        const addrLine = `Adresa: ${org.addressStreet}, ${org.addressZip ?? ''} ${org.addressCity}, ${org.addressCountry ?? 'SK'}`;
        doc.fillColor(LGRAY).font('Geist').fontSize(7)
          .text(addrLine, BODY_X, FOOTER_Y + 14, { width: BODY_W });
      }

      // Line 3: price + VAT
      if (data.ticket.price != null) {
        const vatNote = effectiveVat > 0
          ? `zahŕňa DPH ${effectiveVat} %`
          : 'neplatca DPH';
        const priceLine = `Cena: ${this.formatPrice(data.ticket.price, data.ticket.currency ?? 'EUR')} (${vatNote})`;
        doc.fillColor(LGRAY).font('Geist').fontSize(7)
          .text(priceLine, BODY_X, FOOTER_Y + 24, { width: BODY_W });
      }

      // Line 4: platform
      if (plat?.legalName) {
        let platLine = `Predaj v mene a na účet organizátora: ${plat.legalName}`;
        if (plat.ico) platLine += ` | IČO: ${plat.ico}`;
        doc.fillColor(LGRAY).font('Geist').fontSize(7)
          .text(platLine, BODY_X, FOOTER_Y + 34, { width: BODY_W });
      }

      doc.end();
    });
  }

  async sendPasswordReset(data: { to: string; firstName?: string; resetLink: string }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const name = data.firstName ? `, ${data.firstName}` : '';
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">Reset hesla</h2>
  <p style="color:#374151;">Dobrý deň${name},</p>
  <p style="color:#374151;">Dostali sme žiadosť o reset hesla pre váš účet. Kliknite na tlačidlo nižšie – link je platný <strong>1 hodinu</strong>.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${data.resetLink}"
       style="background:#10B981;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
      Nastaviť nové heslo
    </a>
  </div>
  <p style="color:#6b7280;font-size:13px;">Ak ste o reset nepožiadali, tento e-mail ignorujte. Vaše heslo zostane nezmenené.</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">
    TicketAll · <a href="${data.resetLink}" style="color:#9ca3af;">${data.resetLink}</a>
  </p>
</body></html>`;

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: 'Reset hesla – TicketAll',
      html,
    });
    this.logger.log(`Password reset email sent to ${data.to}`);
  }

  async sendTeamInvite(data: { to: string; organizerName: string; inviteLink: string; firstName?: string }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const name = data.firstName ? `, ${data.firstName}` : '';
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">Pozvánka do tímu</h2>
  <p style="color:#374151;">Dobrý deň${name},</p>
  <p style="color:#374151;">Boli ste pozvaný do tímu <strong>${data.organizerName}</strong> na platforme TicketAll. Ako člen tímu môžete spravovať podujatia, predávať na pokladni a skenovať vstupenky.</p>
  <p style="color:#374151;">Kliknutím nastavíte svoje heslo – link je platný <strong>7 dní</strong>.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${data.inviteLink}"
       style="background:#10B981;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
      Nastaviť heslo a vstúpiť
    </a>
  </div>
  <p style="color:#6b7280;font-size:13px;">Ak ste túto pozvánku neočakávali, tento e-mail môžete ignorovať.</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">
    TicketAll · <a href="${data.inviteLink}" style="color:#9ca3af;">${data.inviteLink}</a>
  </p>
</body></html>`;

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `Pozvánka do tímu ${data.organizerName} – TicketAll`,
      html,
    });
    this.logger.log(`Team invite email sent to ${data.to}`);
  }

  async sendContactEmail(data: { meno: string; email: string; predmet: string; sprava: string }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const to = this.config.get('CONTACT_EMAIL', 'info@ticketall.eu');
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="font-size:18px;margin:0 0 16px;">Správa z kontaktného formulára</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Meno:</td><td style="padding:6px 0;color:#111827;">${data.meno}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">E-mail:</td><td style="padding:6px 0;color:#111827;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Predmet:</td><td style="padding:6px 0;color:#111827;">${data.predmet}</td></tr>
  </table>
  <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;font-size:14px;color:#374151;white-space:pre-wrap;">${data.sprava}</div>
</body></html>`;
    await this.transporter.sendMail({
      from,
      to,
      replyTo: data.email,
      subject: `[Kontakt] ${data.predmet} – ${data.meno}`,
      html,
    });
    this.logger.log(`Contact email from ${data.email} sent to ${to}`);
  }

  /** Bulk zľavové kupóny – PDF zoznam kódov organizátorovi (NIE zákazníkom). */
  async sendCouponBatch(data: {
    to: string;
    count: number;
    batchId: string;
    typeLabel: string;
    valueLabel: string;
    scopeLabel: string;
    validityLabel: string;
    pdf: Buffer;
  }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
    <h1 style="font-size:22px;margin:12px 0 4px;">Vaše zľavové kupóny</h1>
    <p style="color:#6b7280;margin:0;">Vygenerovaných <strong>${data.count}</strong> kódov</p>
  </div>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;font-size:14px;color:#374151;">
    <p style="margin:4px 0;"><strong>Batch ID:</strong> ${data.batchId}</p>
    <p style="margin:4px 0;"><strong>Typ zľavy:</strong> ${data.typeLabel} (${data.valueLabel})</p>
    <p style="margin:4px 0;"><strong>Rozsah:</strong> ${data.scopeLabel}</p>
    <p style="margin:4px 0;"><strong>Platnosť:</strong> ${data.validityLabel}</p>
  </div>
  <p style="color:#374151;font-size:14px;">Kompletný zoznam kódov nájdete v priloženom PDF. Kódy distribuujte podľa vlastného uváženia.</p>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Tento e-mail je určený organizátorovi, nie koncovým zákazníkom.</p>
</body></html>`;

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `Vaše zľavové kupóny (${data.count} ks)`,
      html,
      attachments: [
        {
          filename: `kupony_${data.batchId}.pdf`,
          content: data.pdf,
          contentType: 'application/pdf',
        },
      ],
    });
    this.logger.log(`Sent coupon batch ${data.batchId} (${data.count} codes) to ${data.to}`);
  }

  private computeVatRate(org?: OrganizerPdfInfo | null): number {
    if (!org || !org.vatPayer) return 0;
    if (org.vatRate != null) return org.vatRate;
    return 20; // SK default – platform default not available here (used pre-computed value)
  }

  formatDate(date: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('sk-SK', {
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

  private formatPrice(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('sk-SK', { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }

  // ─────────────────────── REFUND (Úloha 20) ───────────────────────

  /** Organizátorovi: nová zákaznícka žiadosť o vrátenie peňazí. */
  async sendRefundRequested(data: {
    to: string;
    orderNumber: string;
    buyerEmail: string;
    amount: number;
    currency?: string;
    reason: string;
    reviewLink?: string;
  }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const amount = this.formatPrice(data.amount, data.currency ?? 'EUR');
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">Nová žiadosť o vrátenie peňazí</h2>
  <p style="color:#374151;">Zákazník požiadal o vrátenie peňazí pre objednávku <strong>${data.orderNumber}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">
    <tr><td style="padding:6px 0;color:#6b7280;width:130px;">Objednávka:</td><td style="padding:6px 0;color:#111827;">${data.orderNumber}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Zákazník:</td><td style="padding:6px 0;color:#111827;">${data.buyerEmail}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Suma:</td><td style="padding:6px 0;color:#111827;">${amount}</td></tr>
  </table>
  <div style="margin:8px 0 16px;padding:14px;background:#f9fafb;border-radius:8px;font-size:14px;color:#374151;"><strong>Dôvod:</strong><br/>${data.reason}</div>
  ${data.reviewLink ? `<div style="text-align:center;margin:24px 0;"><a href="${data.reviewLink}" style="background:#10B981;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Spravovať žiadosti o vrátenie</a></div>` : ''}
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">TicketAll · žiadosť spracujete v administrácii.</p>
</body></html>`;
    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `Nová žiadosť o vrátenie – ${data.orderNumber}`,
      html,
    });
    this.logger.log(`Refund request email sent to organizer ${data.to} (order ${data.orderNumber})`);
  }

  /** Zákazníkovi: žiadosť o vrátenie bola schválená. */
  async sendRefundApproved(data: {
    to: string;
    orderNumber: string;
    firstName?: string | null;
    amount: number;
    currency?: string;
    manualStripe?: boolean;
  }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const name = data.firstName ? `, ${data.firstName}` : '';
    const amount = this.formatPrice(data.amount, data.currency ?? 'EUR');
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">Žiadosť o vrátenie bola schválená</h2>
  <p style="color:#374151;">Dobrý deň${name},</p>
  <p style="color:#374151;">Vaša žiadosť o vrátenie peňazí pre objednávku <strong>${data.orderNumber}</strong> (${amount}) bola <strong style="color:#10B981;">schválená</strong>.</p>
  <p style="color:#374151;">Vrátenie peňazí bude spracované a suma vám bude vrátená pôvodným spôsobom platby. Vaše vstupenky z tejto objednávky boli zneplatnené.</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">TicketAll</p>
</body></html>`;
    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `Žiadosť o vrátenie schválená – ${data.orderNumber}`,
      html,
    });
    this.logger.log(`Refund approved email sent to ${data.to} (order ${data.orderNumber})`);
  }

  /** Zákazníkovi: žiadosť o vrátenie bola zamietnutá (s dôvodom). */
  async sendRefundRejected(data: {
    to: string;
    orderNumber: string;
    firstName?: string | null;
    reviewNote?: string | null;
  }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const name = data.firstName ? `, ${data.firstName}` : '';
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">Žiadosť o vrátenie bola zamietnutá</h2>
  <p style="color:#374151;">Dobrý deň${name},</p>
  <p style="color:#374151;">Vaša žiadosť o vrátenie peňazí pre objednávku <strong>${data.orderNumber}</strong> bola, žiaľ, zamietnutá. Vaša objednávka a vstupenky zostávajú platné.</p>
  ${data.reviewNote ? `<div style="margin:8px 0 16px;padding:14px;background:#f9fafb;border-radius:8px;font-size:14px;color:#374151;"><strong>Poznámka:</strong><br/>${data.reviewNote}</div>` : ''}
  <p style="color:#374151;">V prípade otázok kontaktujte organizátora podujatia.</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">TicketAll</p>
</body></html>`;
    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `Žiadosť o vrátenie zamietnutá – ${data.orderNumber}`,
      html,
    });
    this.logger.log(`Refund rejected email sent to ${data.to} (order ${data.orderNumber})`);
  }
}
