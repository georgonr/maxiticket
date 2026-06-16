import * as path from 'path';
import { MailLocale, mailMessages } from '../mail/mail-i18n';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface CouponPdfData {
  count: number;
  batchId: string;
  generatedAt: Date;
  locale?: MailLocale;  // Krok 31e4: jazyk PDF chrome (default sk)
  typeLabel: string;
  valueLabel: string;
  scopeLabel: string;
  validityLabel: string;
  codes: string[];
  platformName: string;
}

// nest-cli kopíruje src/assets/** → dist/assets/**; __dirname = dist/coupons
const fontPath = path.join(__dirname, '..', 'assets', 'fonts');

const TEAL = '#10B981';
const BLACK = '#111827';
const GRAY = '#6B7280';
const LGRAY = '#9CA3AF';

const PDF_INTL: Record<MailLocale, string> = { sk: 'sk-SK', en: 'en-GB', cs: 'cs-CZ' };

function fmtDate(d: Date, locale: MailLocale): string {
  try {
    return new Intl.DateTimeFormat(PDF_INTL[locale], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Bratislava',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** Vygeneruje PDF so zoznamom kupónov pre bulk batch (príloha emailu organizátorovi). */
export async function generateCouponBatchPdf(data: CouponPdfData): Promise<Buffer> {
  const locale: MailLocale = data.locale ?? 'sk';
  const m = mailMessages[locale].couponPdf;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Geist', path.join(fontPath, 'Geist-Regular.ttf'));
    doc.registerFont('GeistBold', path.join(fontPath, 'Geist-Bold.ttf'));
    doc.registerFont('Bebas', path.join(fontPath, 'BebasNeue-Regular.ttf'));

    const pageW = doc.page.width;
    const left = doc.page.margins.left;
    const contentW = pageW - left - doc.page.margins.right;

    // ── Hlavička ───────────────────────────────────────────────────────────
    doc.fillColor(TEAL).font('GeistBold').fontSize(13).text('TicketAll', left, 40);
    doc
      .fillColor(BLACK)
      .font('Bebas')
      .fontSize(30)
      .text(`${m.titlePrefix} – ${data.count} ${m.titleSuffix}`, left, 64);

    doc.moveTo(left, 104).lineTo(left + contentW, 104).strokeColor('#E5E7EB').lineWidth(1).stroke();

    // ── Parametre ──────────────────────────────────────────────────────────
    let y = 120;
    const rows: [string, string][] = [
      [m.rowBatchId, data.batchId],
      [m.rowGenerated, fmtDate(data.generatedAt, locale)],
      [m.rowType, data.typeLabel],
      [m.rowValue, data.valueLabel],
      [m.rowScope, data.scopeLabel],
      [m.rowValidity, data.validityLabel],
    ];
    for (const [label, value] of rows) {
      doc.fillColor(GRAY).font('Geist').fontSize(9).text(label, left, y, { width: 110 });
      doc.fillColor(BLACK).font('Geist').fontSize(9).text(value, left + 120, y, { width: contentW - 120 });
      y += 16;
    }

    y += 8;
    doc.fillColor(BLACK).font('GeistBold').fontSize(11).text(m.codesHeading, left, y);
    y += 20;

    // ── Tabuľka kódov (2 stĺpce) ───────────────────────────────────────────
    const colW = contentW / 2;
    const rowH = 22;
    const bottom = doc.page.height - doc.page.margins.bottom - 30;

    data.codes.forEach((code, i) => {
      const col = i % 2;
      const x = left + col * colW;
      if (col === 0 && y > bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc
        .fillColor('#F9FAFB')
        .rect(x, y - 4, colW - 8, rowH - 4)
        .fill();
      doc
        .fillColor(BLACK)
        .font('GeistBold')
        .fontSize(11)
        .text(`${String(i + 1).padStart(2, '0')}.  ${code}`, x + 8, y, {
          width: colW - 24,
          lineBreak: false,
        });
      if (col === 1) y += rowH;
    });
    if (data.codes.length % 2 === 1) y += rowH;

    // ── Pätička ────────────────────────────────────────────────────────────
    const footerY = doc.page.height - doc.page.margins.bottom - 14;
    doc
      .fillColor(LGRAY)
      .font('Geist')
      .fontSize(8)
      .text(
        `${data.platformName} · ticketall.eu · ${m.footerSuffix}`,
        left,
        footerY,
        { width: contentW, align: 'center' },
      );

    doc.end();
  });
}
