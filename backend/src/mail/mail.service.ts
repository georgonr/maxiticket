import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as QRCode from 'qrcode';
import * as path from 'path';
import {
  MailLocale, normalizeMailLocale, mailMessages, mailFormatDate, mailFormatPrice,
} from './mail-i18n';
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
  locale?: string;  // sk/en/cs – jazyk objednávky (default sk)
  buyerName?: string;
  orderNumber: string;
  showName: string;
  startsAt: Date;
  timezone: string;
  venueName: string;
  venueCity?: string;
  organizer?: OrganizerPdfInfo;
  platform?: PlatformPdfInfo;
  // Krok 2/2: súhrn platby pre e-mail (medzisúčet/zľava/poplatok/celkom). Celkom = totalAmount + poplatok.
  summary?: {
    subtotal: number;
    discountAmount: number;
    customerFeeAmount: number;
    total: number;
    currency: string;
  };
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
    const locale = normalizeMailLocale(data.locale);
    const m = mailMessages[locale].tickets;

    const attachments: nodemailer.SendMailOptions['attachments'] = [];
    const ticketHtmlParts: string[] = [];

    for (const ticket of data.tickets) {
      const qrPng = await QRCode.toBuffer(ticket.qrToken, { width: 300, margin: 2 });
      const cidKey = `qr_${ticket.id}`;

      attachments.push({ filename: `qr_${ticket.id}.png`, content: qrPng, cid: cidKey });

      const pdfBuf = await this.generateTicketPdf({ ...data, ticket, qrPng }, locale);
      attachments.push({
        filename: `vstupenka_${ticket.id.slice(-6).toUpperCase()}.pdf`,
        content: pdfBuf,
        contentType: 'application/pdf',
      });

      ticketHtmlParts.push(`
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:16px 0;text-align:center;">
          <p style="font-size:14px;color:#6b7280;margin:0 0 4px;">${ticket.typeName}</p>
          <img src="cid:${cidKey}" style="width:200px;height:200px;" alt="${m.qrAlt}"/>
          <p style="font-size:11px;color:#9ca3af;margin:8px 0 0;font-family:monospace;">${ticket.id.slice(-12).toUpperCase()}</p>
        </div>
      `);
    }

    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
    <h1 style="font-size:22px;margin:12px 0 4px;">${m.heading}</h1>
    <p style="color:#6b7280;margin:0;">${m.orderLabel} <strong>${data.orderNumber}</strong></p>
  </div>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
    <h2 style="font-size:18px;margin:0 0 8px;">${data.showName}</h2>
    <p style="color:#374151;margin:4px 0;">📅 ${mailFormatDate(data.startsAt, data.timezone, locale)}</p>
    <p style="color:#374151;margin:4px 0;">📍 ${data.venueName}${data.venueCity ? `, ${data.venueCity}` : ''}</p>
  </div>
  ${ticketHtmlParts.join('')}
  ${data.summary ? `
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:8px 0 20px;">
    <p style="font-size:13px;font-weight:600;color:#374151;margin:0 0 8px;">${m.summaryTitle}</p>
    ${data.summary.discountAmount > 0 || data.summary.customerFeeAmount > 0 ? `
    <div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin:2px 0;"><span>${m.subtotalLabel}</span><span>${mailFormatPrice(data.summary.subtotal, data.summary.currency, locale)}</span></div>
    ${data.summary.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#059669;margin:2px 0;"><span>${m.discountLabel}</span><span>−${mailFormatPrice(data.summary.discountAmount, data.summary.currency, locale)}</span></div>` : ''}
    ${data.summary.customerFeeAmount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin:2px 0;"><span>${m.feeLabel}</span><span>${mailFormatPrice(data.summary.customerFeeAmount, data.summary.currency, locale)}</span></div>` : ''}
    ` : ''}
    <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;margin-top:6px;padding-top:6px;"><span>${m.totalLabel}</span><span>${mailFormatPrice(data.summary.total, data.summary.currency, locale)}</span></div>
  </div>` : ''}
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">
    ${m.footer}
  </p>
</body></html>`;

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `${m.subjectPrefix} – ${data.showName}`,
      html,
      attachments,
    });

    this.logger.log(`Sent ${data.tickets.length} ticket(s) to ${data.to}`);
  }

  /** Krok 27: notifikácia o zrušení termínu (lístky zneplatnené + info o refunde). */
  async sendTerminCancelled(data: {
    to: string;
    locale?: string;
    showName: string;
    startsAt: Date;
    timezone: string;
    orderNumber: string;
    refundInfo: string;
  }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const locale = normalizeMailLocale(data.locale);
    const m = mailMessages[locale].terminCancelled;
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
    <h1 style="font-size:22px;margin:12px 0 4px;">${m.heading}</h1>
    <p style="color:#6b7280;margin:0;">${m.orderLabel} <strong>${data.orderNumber}</strong></p>
  </div>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px;">
    <h2 style="font-size:18px;margin:0 0 8px;">${data.showName}</h2>
    <p style="color:#374151;margin:4px 0;">📅 ${mailFormatDate(data.startsAt, data.timezone, locale)}</p>
    <p style="color:#b91c1c;margin:12px 0 0;font-weight:600;">${m.cancelledNotice}</p>
  </div>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="color:#374151;margin:0;"><strong>${m.refundLabel}</strong> ${data.refundInfo}</p>
  </div>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">
    ${m.footer}
  </p>
</body></html>`;

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `${m.subjectPrefix} – ${data.showName}`,
      html,
    });
    this.logger.log(`Sent termin-cancelled notice to ${data.to} (order ${data.orderNumber})`);
  }

  private async generateTicketPdf(
    data: TicketEmailData & {
      ticket: TicketEmailData['tickets'][0];
      qrPng: Buffer;
    },
    locale: MailLocale = 'sk',
  ): Promise<Buffer> {
    const m = mailMessages[locale].pdf;
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
        .text(m.ticketWord, -70, -13, { width: 140, align: 'center' });
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
      const dateStr = mailFormatDate(data.startsAt, data.timezone, locale);
      doc.fillColor(TEAL).font('GeistBold').fontSize(9)
        .text(dateStr, BODY_X, 68, { width: TEXT_W });

      const venue = `${data.venueName}${data.venueCity ? `, ${data.venueCity}` : ''}`;
      doc.fillColor(GRAY).font('Geist').fontSize(9)
        .text(venue, BODY_X, 82, { width: TEXT_W });

      // Ticket type + price
      const priceStr = data.ticket.price != null
        ? mailFormatPrice(data.ticket.price, data.ticket.currency ?? 'EUR', locale)
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
        .text(`${m.orderPrefix} ${data.orderNumber}`, QR_X - 4, 16 + QR_W + 14, { width: QR_W + 8, align: 'center' });

      // ── Legal footer ─────────────────────────────────────────────────────
      const FOOTER_Y = H - 62;
      doc.moveTo(STUB_W + 2, FOOTER_Y).lineTo(W - 4, FOOTER_Y)
        .strokeColor('#E5E7EB').lineWidth(0.5).stroke();

      const org = data.organizer;
      const plat = data.platform;
      const effectiveVat = this.computeVatRate(org);

      // Line 1: organizer identity
      if (org?.companyName) {
        let orgLine = `${m.organizerLabel} ${org.companyName}`;
        if (org.ico) orgLine += ` | IČO: ${org.ico}`;
        if (org.icDph) orgLine += ` | IČ DPH: ${org.icDph}`;
        doc.fillColor(LGRAY).font('Geist').fontSize(7)
          .text(orgLine, BODY_X, FOOTER_Y + 4, { width: BODY_W });
      }

      // Line 2: organizer address
      if (org?.addressStreet && org?.addressCity) {
        const addrLine = `${m.addressLabel} ${org.addressStreet}, ${org.addressZip ?? ''} ${org.addressCity}, ${org.addressCountry ?? 'SK'}`;
        doc.fillColor(LGRAY).font('Geist').fontSize(7)
          .text(addrLine, BODY_X, FOOTER_Y + 14, { width: BODY_W });
      }

      // Line 3: price + VAT
      if (data.ticket.price != null) {
        const vatNote = effectiveVat > 0
          ? `${m.vatIncludedPrefix} ${effectiveVat} %`
          : m.vatNonPayer;
        const priceLine = `${m.priceLabel} ${mailFormatPrice(data.ticket.price, data.ticket.currency ?? 'EUR', locale)} (${vatNote})`;
        doc.fillColor(LGRAY).font('Geist').fontSize(7)
          .text(priceLine, BODY_X, FOOTER_Y + 24, { width: BODY_W });
      }

      // Line 4: platform
      if (plat?.legalName) {
        let platLine = `${m.platformLinePrefix} ${plat.legalName}`;
        if (plat.ico) platLine += ` | IČO: ${plat.ico}`;
        doc.fillColor(LGRAY).font('Geist').fontSize(7)
          .text(platLine, BODY_X, FOOTER_Y + 34, { width: BODY_W });
      }

      doc.end();
    });
  }

  async sendPasswordReset(data: { to: string; locale?: string; firstName?: string; resetLink: string }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const m = mailMessages[normalizeMailLocale(data.locale)].passwordReset;
    const name = data.firstName ? `, ${data.firstName}` : '';
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">${m.heading}</h2>
  <p style="color:#374151;">${m.greeting}${name},</p>
  <p style="color:#374151;">${m.bodyPrefix} <strong>${m.validity}</strong>.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${data.resetLink}"
       style="background:#10B981;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
      ${m.button}
    </a>
  </div>
  <p style="color:#6b7280;font-size:13px;">${m.ignore}</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">
    TicketAll · <a href="${data.resetLink}" style="color:#9ca3af;">${data.resetLink}</a>
  </p>
</body></html>`;

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: m.subject,
      html,
    });
    this.logger.log(`Password reset email sent to ${data.to}`);
  }

  async sendTeamInvite(data: { to: string; locale?: string; organizerName: string; inviteLink: string; firstName?: string }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const m = mailMessages[normalizeMailLocale(data.locale)].teamInvite;
    const name = data.firstName ? `, ${data.firstName}` : '';
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">${m.heading}</h2>
  <p style="color:#374151;">${m.greeting}${name},</p>
  <p style="color:#374151;">${m.bodyPrefix} <strong>${data.organizerName}</strong> ${m.bodySuffix}</p>
  <p style="color:#374151;">${m.body2Prefix} <strong>${m.validity}</strong>.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${data.inviteLink}"
       style="background:#10B981;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
      ${m.button}
    </a>
  </div>
  <p style="color:#6b7280;font-size:13px;">${m.ignore}</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">
    TicketAll · <a href="${data.inviteLink}" style="color:#9ca3af;">${data.inviteLink}</a>
  </p>
</body></html>`;

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `${m.subjectPrefix} ${data.organizerName} ${m.subjectSuffix}`,
      html,
    });
    this.logger.log(`Team invite email sent to ${data.to}`);
  }

  async sendContactEmail(data: { meno: string; email: string; predmet: string; sprava: string; locale?: string }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const to = this.config.get('CONTACT_EMAIL', 'info@ticketall.eu');
    const m = mailMessages[normalizeMailLocale(data.locale)].contact;
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="font-size:18px;margin:0 0 16px;">${m.heading}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#6b7280;width:120px;">${m.nameLabel}</td><td style="padding:6px 0;color:#111827;">${data.meno}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">${m.emailLabel}</td><td style="padding:6px 0;color:#111827;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">${m.subjectLabel}</td><td style="padding:6px 0;color:#111827;">${data.predmet}</td></tr>
  </table>
  <div style="margin-top:16px;padding:16px;background:#f9fafb;border-radius:8px;font-size:14px;color:#374151;white-space:pre-wrap;">${data.sprava}</div>
</body></html>`;
    await this.transporter.sendMail({
      from,
      to,
      replyTo: data.email,
      subject: `${m.subjectTag} ${data.predmet} – ${data.meno}`,
      html,
    });
    this.logger.log(`Contact email from ${data.email} sent to ${to}`);
  }

  /** Bulk zľavové kupóny – PDF zoznam kódov organizátorovi (NIE zákazníkom). */
  async sendCouponBatch(data: {
    to: string;
    locale?: string;
    count: number;
    batchId: string;
    typeLabel: string;
    valueLabel: string;
    scopeLabel: string;
    validityLabel: string;
    pdf: Buffer;
  }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const m = mailMessages[normalizeMailLocale(data.locale)].couponBatch;
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
    <h1 style="font-size:22px;margin:12px 0 4px;">${m.heading}</h1>
    <p style="color:#6b7280;margin:0;">${m.generatedPrefix} <strong>${data.count}</strong> ${m.generatedSuffix}</p>
  </div>
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;font-size:14px;color:#374151;">
    <p style="margin:4px 0;"><strong>${m.batchIdLabel}</strong> ${data.batchId}</p>
    <p style="margin:4px 0;"><strong>${m.typeLabel}</strong> ${data.typeLabel} (${data.valueLabel})</p>
    <p style="margin:4px 0;"><strong>${m.scopeLabel}</strong> ${data.scopeLabel}</p>
    <p style="margin:4px 0;"><strong>${m.validityLabel}</strong> ${data.validityLabel}</p>
  </div>
  <p style="color:#374151;font-size:14px;">${m.body}</p>
  <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">${m.footer}</p>
</body></html>`;

    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `${m.subjectPrefix} (${data.count} ${m.countSuffix})`,
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

  // ─────────────────────── REFUND (Úloha 20) ───────────────────────

  /** Organizátorovi: nová zákaznícka žiadosť o vrátenie peňazí. */
  async sendRefundRequested(data: {
    to: string;
    locale?: string;
    orderNumber: string;
    buyerEmail: string;
    amount: number;
    currency?: string;
    reason: string;
    reviewLink?: string;
  }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const locale = normalizeMailLocale(data.locale);
    const m = mailMessages[locale].refundRequested;
    const amount = mailFormatPrice(data.amount, data.currency ?? 'EUR', locale);
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">${m.heading}</h2>
  <p style="color:#374151;">${m.introPrefix} <strong>${data.orderNumber}</strong>${m.introSuffix}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">
    <tr><td style="padding:6px 0;color:#6b7280;width:130px;">${m.orderLabel}</td><td style="padding:6px 0;color:#111827;">${data.orderNumber}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">${m.customerLabel}</td><td style="padding:6px 0;color:#111827;">${data.buyerEmail}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">${m.amountLabel}</td><td style="padding:6px 0;color:#111827;">${amount}</td></tr>
  </table>
  <div style="margin:8px 0 16px;padding:14px;background:#f9fafb;border-radius:8px;font-size:14px;color:#374151;"><strong>${m.reasonLabel}</strong><br/>${data.reason}</div>
  ${data.reviewLink ? `<div style="text-align:center;margin:24px 0;"><a href="${data.reviewLink}" style="background:#10B981;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">${m.cta}</a></div>` : ''}
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">${m.footer}</p>
</body></html>`;
    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `${m.subjectPrefix} – ${data.orderNumber}`,
      html,
    });
    this.logger.log(`Refund request email sent to organizer ${data.to} (order ${data.orderNumber})`);
  }

  /** Zákazníkovi: žiadosť o vrátenie bola schválená. */
  async sendRefundApproved(data: {
    to: string;
    locale?: string;
    orderNumber: string;
    firstName?: string | null;
    amount: number;
    currency?: string;
    manualStripe?: boolean;
  }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const locale = normalizeMailLocale(data.locale);
    const m = mailMessages[locale].refundApproved;
    const name = data.firstName ? `, ${data.firstName}` : '';
    const amount = mailFormatPrice(data.amount, data.currency ?? 'EUR', locale);
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">${m.heading}</h2>
  <p style="color:#374151;">${m.greeting}${name},</p>
  <p style="color:#374151;">${m.bodyPrefix} <strong>${data.orderNumber}</strong> (${amount}) ${m.bodyConnector} <strong style="color:#10B981;">${m.approvedWord}</strong>.</p>
  <p style="color:#374151;">${m.body2}</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">TicketAll</p>
</body></html>`;
    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `${m.subjectPrefix} – ${data.orderNumber}`,
      html,
    });
    this.logger.log(`Refund approved email sent to ${data.to} (order ${data.orderNumber})`);
  }

  /** Zákazníkovi: žiadosť o vrátenie bola zamietnutá (s dôvodom). */
  async sendRefundRejected(data: {
    to: string;
    locale?: string;
    orderNumber: string;
    firstName?: string | null;
    reviewNote?: string | null;
  }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'TicketAll <noreply@ticketall.eu>');
    const locale = normalizeMailLocale(data.locale);
    const m = mailMessages[locale].refundRejected;
    const name = data.firstName ? `, ${data.firstName}` : '';
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#10B981;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">TicketAll</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">${m.heading}</h2>
  <p style="color:#374151;">${m.greeting}${name},</p>
  <p style="color:#374151;">${m.bodyPrefix} <strong>${data.orderNumber}</strong> ${m.bodySuffix}</p>
  ${data.reviewNote ? `<div style="margin:8px 0 16px;padding:14px;background:#f9fafb;border-radius:8px;font-size:14px;color:#374151;"><strong>${m.noteLabel}</strong><br/>${data.reviewNote}</div>` : ''}
  <p style="color:#374151;">${m.footer}</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">TicketAll</p>
</body></html>`;
    await this.transporter.sendMail({
      from,
      to: data.to,
      subject: `${m.subjectPrefix} – ${data.orderNumber}`,
      html,
    });
    this.logger.log(`Refund rejected email sent to ${data.to} (order ${data.orderNumber})`);
  }
}
