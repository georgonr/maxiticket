import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as QRCode from 'qrcode';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface TicketEmailData {
  to: string;
  buyerName?: string;
  orderNumber: string;
  showName: string;
  startsAt: Date;
  timezone: string;
  venueName: string;
  venueCity?: string;
  tickets: {
    id: string;
    typeName: string;
    qrToken: string;
  }[];
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor(private config: ConfigService) {
    const transport = this.config.get<string>('MAIL_TRANSPORT', 'mailpit');
    const secure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';

    if (transport === 'smtp') {
      // Production SMTP (e.g. SSL on port 465)
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
      // Dev fallback: Mailpit (no auth, no TLS)
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST', 'mailpit'),
        port: Number(this.config.get<string>('SMTP_PORT', '1025')),
        secure: false,
      });
    }

    this.logger.log(`Mail transport: ${transport} (${this.config.get('SMTP_HOST')}:${this.config.get('SMTP_PORT')})`);
  }

  async sendTickets(data: TicketEmailData): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'noreply@maxiticket.africa');

    // Generate QR PNGs and PDFs for each ticket
    const attachments: nodemailer.SendMailOptions['attachments'] = [];
    const ticketHtmlParts: string[] = [];

    for (const ticket of data.tickets) {
      const qrPng = await QRCode.toBuffer(ticket.qrToken, { width: 300, margin: 2 });
      const qrBase64 = qrPng.toString('base64');
      const cidKey = `qr_${ticket.id}`;

      attachments.push({ filename: `qr_${ticket.id}.png`, content: qrPng, cid: cidKey });

      const pdfBuf = await this.generateTicketPdf({ ...data, ticket, qrPng });
      attachments.push({
        filename: `vstupenka_${ticket.id.slice(-6).toUpperCase()}.pdf`,
        content: pdfBuf,
        contentType: 'application/pdf',
      });

      const dateStr = this.formatDate(data.startsAt, data.timezone);
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
    <div style="display:inline-block;background:#6366f1;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">MT</div>
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
      from: `Maxiticket <${from}>`,
      to: data.to,
      subject: `Vaše vstupenky – ${data.showName}`,
      html,
      attachments,
    });

    this.logger.log(`Sent ${data.tickets.length} ticket(s) to ${data.to}`);
  }

  private async generateTicketPdf(data: TicketEmailData & { ticket: TicketEmailData['tickets'][0]; qrPng: Buffer }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A6', margin: 20 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header band
      doc.rect(0, 0, doc.page.width, 40).fill('#6366f1');
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
        .text('VSTUPENKA / TICKET', 20, 12, { align: 'center' });

      // Show name
      doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold')
        .text(data.showName, 20, 50, { align: 'center', width: doc.page.width - 40 });

      // Date + venue
      doc.fontSize(9).font('Helvetica').fillColor('#374151')
        .text(this.formatDate(data.startsAt, data.timezone), 20, 70, { align: 'center', width: doc.page.width - 40 })
        .text(`${data.venueName}${data.venueCity ? `, ${data.venueCity}` : ''}`, 20, 82, { align: 'center', width: doc.page.width - 40 });

      // Ticket type
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#6366f1')
        .text(data.ticket.typeName, 20, 98, { align: 'center', width: doc.page.width - 40 });

      // QR code (centered)
      const qrSize = 140;
      const qrX = (doc.page.width - qrSize) / 2;
      doc.image(data.qrPng, qrX, 114, { width: qrSize, height: qrSize });

      // Ticket ID
      doc.fontSize(7).font('Helvetica').fillColor('#9ca3af')
        .text(data.ticket.id.slice(-12).toUpperCase(), 20, 260, { align: 'center', width: doc.page.width - 40 });

      // Order number
      doc.fontSize(7).text(`Obj: ${data.orderNumber}`, 20, 270, { align: 'center', width: doc.page.width - 40 });

      doc.end();
    });
  }

  async sendPasswordReset(data: { to: string; firstName?: string; resetLink: string }): Promise<void> {
    const from = this.config.get('MAIL_FROM', 'noreply@maxiticket.africa');
    const name = data.firstName ? `, ${data.firstName}` : '';
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;background:#e63946;color:#fff;border-radius:8px;padding:8px 16px;font-weight:700;font-size:18px;">MT</div>
  </div>
  <h2 style="font-size:20px;margin:0 0 12px;">Reset hesla</h2>
  <p style="color:#374151;">Dobrý deň${name},</p>
  <p style="color:#374151;">Dostali sme žiadosť o reset hesla pre váš účet. Kliknite na tlačidlo nižšie – link je platný <strong>1 hodinu</strong>.</p>
  <div style="text-align:center;margin:28px 0;">
    <a href="${data.resetLink}"
       style="background:#e63946;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
      Nastaviť nové heslo
    </a>
  </div>
  <p style="color:#6b7280;font-size:13px;">Ak ste o reset nepožiadali, tento e-mail ignorujte. Vaše heslo zostane nezmenené.</p>
  <p style="color:#9ca3af;font-size:11px;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">
    Maxiticket · <a href="${data.resetLink}" style="color:#9ca3af;">${data.resetLink}</a>
  </p>
</body></html>`;

    await this.transporter.sendMail({
      from: `Maxiticket <${from}>`,
      to: data.to,
      subject: 'Reset hesla – Maxiticket',
      html,
    });
    this.logger.log(`Password reset email sent to ${data.to}`);
  }

  private formatDate(date: Date, timezone: string): string {
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
}
