import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

export interface ReceiptItem {
  showTitle: string | null;
  terminStartsAt: Date | null;
  ticketTypeName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptPdfData {
  orderNumber: string;
  createdAt: Date;
  paymentLabel: string;
  buyerName: string | null;
  buyerEmail: string;
  currency: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  couponCode: string | null;
  customerFeeAmount?: number;
  total: number;
  platform: {
    legalName: string;
    ico: string | null;
    icDph: string | null;
    addressStreet: string | null;
    addressCity: string | null;
    addressZip: string | null;
  };
}

const fontPath = path.join(__dirname, '..', 'assets', 'fonts');

const BRAND = '#4F46E5';
const BLACK = '#111827';
const GRAY = '#6B7280';
const LGRAY = '#9CA3AF';
const LINE = '#E5E7EB';

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Bratislava',
  }).format(d);
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency }).format(n);
}

/** PDF "Potvrdenie o objednávke" – doklad pre zákazníka (NIE daňový doklad). */
export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
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
    const right = 547;
    const width = right - left;

    // Hlavička
    doc.fillColor(BRAND).font('Bebas').fontSize(30).text('POTVRDENIE O OBJEDNÁVKE', left, 48);
    doc.fillColor(BLACK).font('GeistBold').fontSize(12).text(data.orderNumber, left, 84);
    doc.fillColor(LGRAY).font('Geist').fontSize(9).text(fmtDateTime(data.createdAt), left, 100);

    // Prevádzkovateľ (vpravo)
    const p = data.platform;
    const orgLines = [
      p.legalName,
      [p.addressStreet, p.addressZip && p.addressCity ? `${p.addressZip} ${p.addressCity}` : p.addressCity]
        .filter(Boolean).join(', '),
      p.ico ? `IČO: ${p.ico}` : null,
      p.icDph ? `IČ DPH: ${p.icDph}` : null,
    ].filter(Boolean) as string[];
    doc.fillColor(GRAY).font('Geist').fontSize(8);
    orgLines.forEach((ln, i) => doc.text(ln, left, 50 + i * 11, { width, align: 'right' }));

    doc.moveTo(left, 122).lineTo(right, 122).strokeColor(LINE).stroke();

    // Kupujúci
    let y = 138;
    doc.fillColor(GRAY).font('GeistBold').fontSize(9).text('Kupujúci', left, y);
    y += 14;
    doc.fillColor(BLACK).font('Geist').fontSize(10).text(data.buyerName ?? data.buyerEmail, left, y);
    if (data.buyerName) { y += 13; doc.fillColor(GRAY).fontSize(9).text(data.buyerEmail, left, y); }
    y += 24;

    // Položky – hlavička
    doc.fillColor(LGRAY).font('Geist').fontSize(8)
      .text('Položka', left, y)
      .text('Ks', left, y, { width: width - 150, align: 'right' })
      .text('Cena', left, y, { width: width - 75, align: 'right' })
      .text('Spolu', left, y, { width, align: 'right' });
    y += 14;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 8;

    for (const it of data.items) {
      if (y > 740) { doc.addPage(); y = 48; }
      doc.fillColor(BLACK).font('Geist').fontSize(10).text(it.showTitle ?? '—', left, y, { width: width - 170 });
      doc.fillColor(BLACK).font('Geist').fontSize(10)
        .text(String(it.quantity), left, y, { width: width - 150, align: 'right' })
        .text(fmt(it.unitPrice, data.currency), left, y, { width: width - 75, align: 'right' })
        .text(fmt(it.lineTotal, data.currency), left, y, { width, align: 'right' });
      y += 13;
      const sub = [it.ticketTypeName, it.terminStartsAt ? fmtDateTime(it.terminStartsAt) : null].filter(Boolean).join(' · ');
      if (sub) { doc.fillColor(LGRAY).font('Geist').fontSize(7.5).text(sub, left, y, { width: width - 170 }); y += 13; }
      y += 4;
    }

    // Súčty
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 10;
    const sumRow = (label: string, value: string, bold = false) => {
      doc.fillColor(bold ? BLACK : GRAY).font(bold ? 'GeistBold' : 'Geist').fontSize(bold ? 13 : 10).text(label, left, y, { width: width - 120 });
      doc.fillColor(bold ? BRAND : BLACK).font('GeistBold').fontSize(bold ? 14 : 10).text(value, left, y, { width, align: 'right' });
      y += bold ? 24 : 18;
    };
    const fee = data.customerFeeAmount ?? 0;
    if (data.discountAmount > 0 || fee > 0) {
      sumRow('Medzisúčet', fmt(data.subtotal, data.currency));
      if (data.discountAmount > 0) {
        sumRow(`Zľava${data.couponCode ? ` (${data.couponCode})` : ''}`, `−${fmt(data.discountAmount, data.currency)}`);
      }
      if (fee > 0) {
        sumRow('Poplatok za spracovanie', fmt(fee, data.currency));
      }
    }
    sumRow('SPOLU', fmt(data.total, data.currency), true);
    y += 4;
    doc.fillColor(GRAY).font('Geist').fontSize(9).text(`Spôsob platby: ${data.paymentLabel}`, left, y);

    // Pätička
    doc.fillColor(LGRAY).font('Geist').fontSize(7.5)
      .text(
        `Toto je potvrdenie o objednávke, nie je daňovým dokladom. Vystavil ${p.legalName} prostredníctvom TicketAll.`,
        left, 802, { width, align: 'center' },
      );

    doc.end();
  });
}
