import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface PosClosureByTermin {
  showTitle: string | null;
  terminStartsAt: Date | null;
  cash: number;
  card: number;
  tickets: number;
}

export interface PosClosurePdfData {
  organizerName: string;
  closedByName: string;
  periodFrom: Date;
  periodTo: Date;
  cashTotal: number;
  cardTotal: number;
  total: number;
  orderCount: number;
  ticketCount: number;
  note: string | null;
  byTermin: PosClosureByTermin[];
  platformName: string;
}

// nest-cli kopíruje src/assets/** → dist/assets/**; __dirname = dist/orders
const fontPath = path.join(__dirname, '..', 'assets', 'fonts');

const BRAND = '#4F46E5';
const BLACK = '#111827';
const GRAY = '#6B7280';
const LGRAY = '#9CA3AF';
const LINE = '#E5E7EB';

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bratislava',
  }).format(d);
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(n);
}

/** PDF report uzávierky POS pokladne. */
export async function generatePosClosurePdf(data: PosClosurePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Geist', path.join(fontPath, 'Geist-Regular.ttf'));
    doc.registerFont('GeistBold', path.join(fontPath, 'Geist-Bold.ttf'));
    doc.registerFont('Bebas', path.join(fontPath, 'BebasNeue-Regular.ttf'));

    const left = 48;
    const right = 547; // 595 - 48
    const width = right - left;

    // Hlavička
    doc.fillColor(BRAND).font('Bebas').fontSize(30).text('UZÁVIERKA POKLADNE', left, 48);
    doc.fillColor(GRAY).font('Geist').fontSize(10).text(data.organizerName, left, 84);

    doc.fillColor(LGRAY).font('Geist').fontSize(9)
      .text(`Obdobie: ${fmtDateTime(data.periodFrom)} – ${fmtDateTime(data.periodTo)}`, left, 104)
      .text(`Uzavrel: ${data.closedByName}`, left, 118);

    doc.moveTo(left, 138).lineTo(right, 138).strokeColor(LINE).stroke();

    // Súčty
    let y = 158;
    const row = (label: string, value: string, bold = false) => {
      doc.fillColor(bold ? BLACK : GRAY).font(bold ? 'GeistBold' : 'Geist').fontSize(bold ? 13 : 11)
        .text(label, left, y);
      doc.fillColor(bold ? BRAND : BLACK).font('GeistBold').fontSize(bold ? 14 : 11)
        .text(value, left, y, { width, align: 'right' });
      y += bold ? 26 : 20;
    };
    row('Hotovosť', fmtEur(data.cashTotal));
    row('Karta', fmtEur(data.cardTotal));
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 12;
    row('SPOLU', fmtEur(data.total), true);
    y += 4;
    doc.fillColor(GRAY).font('Geist').fontSize(10)
      .text(`Počet predajov: ${data.orderCount}    Počet lístkov: ${data.ticketCount}`, left, y);
    y += 28;

    // Breakdown by termin
    if (data.byTermin.length > 0) {
      doc.fillColor(BLACK).font('GeistBold').fontSize(11).text('Podľa termínu', left, y);
      y += 20;
      doc.fillColor(LGRAY).font('Geist').fontSize(8)
        .text('Podujatie / termín', left, y)
        .text('Hotovosť', left, y, { width: width - 160, align: 'right' })
        .text('Karta', left, y, { width: width - 80, align: 'right' })
        .text('Ks', left, y, { width, align: 'right' });
      y += 14;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
      y += 8;
      for (const t of data.byTermin) {
        if (y > 760) { doc.addPage(); y = 48; }
        const title = t.showTitle ?? '—';
        const when = t.terminStartsAt ? fmtDateTime(t.terminStartsAt) : '';
        doc.fillColor(BLACK).font('Geist').fontSize(9).text(title, left, y, { width: width - 180 });
        doc.fillColor(BLACK).font('Geist').fontSize(9)
          .text(fmtEur(t.cash), left, y, { width: width - 160, align: 'right' })
          .text(fmtEur(t.card), left, y, { width: width - 80, align: 'right' })
          .text(String(t.tickets), left, y, { width, align: 'right' });
        if (when) {
          y += 12;
          doc.fillColor(LGRAY).font('Geist').fontSize(7).text(when, left, y);
        }
        y += 16;
      }
    }

    if (data.note) {
      y += 12;
      doc.fillColor(GRAY).font('Geist').fontSize(9).text(`Poznámka: ${data.note}`, left, y, { width });
    }

    // Footer
    doc.fillColor(LGRAY).font('Geist').fontSize(7)
      .text(`${data.platformName} · vygenerované ${fmtDateTime(data.periodTo)}`, left, 800, { width, align: 'center' });

    doc.end();
  });
}
