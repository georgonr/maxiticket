import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

const fontPath = path.join(__dirname, '..', 'assets', 'fonts');
const TEAL = '#10B981';
const BLACK = '#111827';
const GRAY = '#6B7280';
const LGRAY = '#9CA3AF';

export interface InvoiceParty {
  name: string;
  ico?: string | null;
  dic?: string | null;
  icDph?: string | null;
  address?: string | null;
  iban?: string | null;
}

export interface InvoicePdfLine {
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatPercent: number;
  lineNetCents: number;
  lineVatCents: number;
  lineTotalCents: number;
}

export interface InvoicePdfData {
  isDraft: boolean;
  invoiceNumber: string | null;
  issueDate: Date;
  taxDate: Date;
  dueDate: Date;
  currency: string;
  supplier: InvoiceParty; // DODÁVATEĽ = platforma (z ENV)
  buyer: InvoiceParty;    // ODBERATEĽ = organizátor (snapshot)
  lines: InvoicePdfLine[];
  subtotalCents: number;
  vatTotalCents: number;
  totalCents: number;
  note?: string | null;
  statement: { ticketsSold: number; revenueCents: number; commissionCents: number; vatCents: number; refundedTickets: number; refundFeesCents: number; netPayoutCents: number };
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('Geist', path.join(fontPath, 'Geist-Regular.ttf'));
    doc.registerFont('GeistBold', path.join(fontPath, 'Geist-Bold.ttf'));
    doc.registerFont('Bebas', path.join(fontPath, 'BebasNeue-Regular.ttf'));

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const right = left + width;
    const eur = (c: number) => new Intl.NumberFormat('sk-SK', { style: 'currency', currency: data.currency }).format(c / 100);
    const d = (date: Date) => new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(date);

    // ── Vodoznak NÁVRH ───────────────────────────────────────────────────────
    if (data.isDraft) {
      doc.save();
      doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc.fillColor('#FCA5A5').font('Bebas').fontSize(90)
        .text('NÁVRH', 0, doc.page.height / 2 - 60, { width: doc.page.width, align: 'center' });
      doc.restore();
    }

    // ── Hlavička ─────────────────────────────────────────────────────────────
    doc.fillColor(TEAL).font('GeistBold').fontSize(13).text('TicketAll', left, 40);
    doc.fillColor(BLACK).font('Bebas').fontSize(26)
      .text(data.isDraft ? 'VYÚČTOVANIE' : 'FAKTÚRA', left, 40, { width, align: 'right' });
    doc.fillColor(GRAY).font('Geist').fontSize(10)
      .text(data.isDraft ? 'Návrh – neplatný daňový doklad' : `Č. ${data.invoiceNumber}`, left, 70, { width, align: 'right' });
    doc.moveTo(left, 92).lineTo(right, 92).strokeColor('#E5E7EB').lineWidth(1).stroke();

    // ── Strany ───────────────────────────────────────────────────────────────
    const party = (title: string, p: InvoiceParty, x: number) => {
      let y = 104;
      doc.fillColor(LGRAY).font('GeistBold').fontSize(8).text(title.toUpperCase(), x, y); y += 14;
      doc.fillColor(BLACK).font('GeistBold').fontSize(11).text(p.name, x, y, { width: width / 2 - 10 }); y += 16;
      doc.fillColor(GRAY).font('Geist').fontSize(9);
      if (p.address) { doc.text(p.address, x, y, { width: width / 2 - 10 }); y += 12; }
      if (p.ico) { doc.text(`IČO: ${p.ico}`, x, y); y += 12; }
      if (p.dic) { doc.text(`DIČ: ${p.dic}`, x, y); y += 12; }
      if (p.icDph) { doc.text(`IČ DPH: ${p.icDph}`, x, y); y += 12; }
    };
    party('Dodávateľ', data.supplier, left);
    party('Odberateľ', data.buyer, left + width / 2);

    // ── Meta ─────────────────────────────────────────────────────────────────
    let y = 200;
    const meta: [string, string][] = [
      ['Dátum vystavenia', d(data.issueDate)],
      ['Dátum dodania (DUZP)', d(data.taxDate)],
      ['Splatnosť', d(data.dueDate)],
      ['Variabilný symbol', data.invoiceNumber ?? '—'],
    ];
    for (const [l, v] of meta) {
      doc.fillColor(GRAY).font('Geist').fontSize(9).text(l, left, y, { width: 160 });
      doc.fillColor(BLACK).font('GeistBold').fontSize(9).text(v, left + 160, y);
      y += 14;
    }
    y += 8;

    // ── Položky ──────────────────────────────────────────────────────────────
    const cols = { desc: left, qty: left + 250, unit: left + 300, vat: left + 370, net: left + 410, total: left };
    doc.fillColor(GRAY).font('GeistBold').fontSize(8);
    doc.text('Popis', cols.desc, y, { width: 240 });
    doc.text('Ks', cols.qty, y, { width: 40, align: 'right' });
    doc.text('J. cena', cols.unit, y, { width: 60, align: 'right' });
    doc.text('DPH', cols.vat, y, { width: 35, align: 'right' });
    doc.text('Spolu', cols.total, y, { width, align: 'right' });
    y += 14;
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke(); y += 6;

    for (const li of data.lines) {
      doc.fillColor(BLACK).font('Geist').fontSize(9);
      const h = doc.heightOfString(li.description, { width: 240 });
      doc.text(li.description, cols.desc, y, { width: 240 });
      doc.text(String(li.quantity), cols.qty, y, { width: 40, align: 'right' });
      doc.text(eur(li.unitPriceCents), cols.unit, y, { width: 60, align: 'right' });
      doc.text(`${li.vatPercent}%`, cols.vat, y, { width: 35, align: 'right' });
      doc.fillColor(BLACK).font('GeistBold').text(eur(li.lineTotalCents), cols.total, y, { width, align: 'right' });
      y += Math.max(h, 11) + 6;
    }
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke(); y += 8;

    // ── Rekapitulácia ────────────────────────────────────────────────────────
    const sumRow = (l: string, v: string, bold = false) => {
      doc.fillColor(bold ? BLACK : GRAY).font(bold ? 'GeistBold' : 'Geist').fontSize(bold ? 12 : 9).text(l, left, y, { width: width - 120 });
      doc.fillColor(bold ? TEAL : BLACK).font('GeistBold').fontSize(bold ? 13 : 9).text(v, left, y, { width, align: 'right' });
      y += bold ? 22 : 15;
    };
    sumRow('Základ DPH (bez DPH)', eur(data.subtotalCents));
    sumRow('DPH', eur(data.vatTotalCents));
    sumRow('CELKOM K ÚHRADE', eur(data.totalCents), true);

    // ── Platobné údaje ───────────────────────────────────────────────────────
    if (data.supplier.iban) {
      y += 4;
      doc.fillColor(GRAY).font('Geist').fontSize(9).text(`IBAN: ${data.supplier.iban}   ·   VS: ${data.invoiceNumber ?? '—'}`, left, y);
      y += 16;
    }
    if (data.note) {
      doc.fillColor(GRAY).font('Geist').fontSize(8).text(data.note, left, y, { width }); y += 18;
    }

    // ── Výpis (informačné) ───────────────────────────────────────────────────
    y += 8;
    doc.fillColor(BLACK).font('GeistBold').fontSize(10).text('Výpis k vyúčtovaniu (informačné)', left, y); y += 16;
    const st = data.statement;
    const stRow = (l: string, v: string, neg = false, bold = false) => {
      doc.fillColor(bold ? BLACK : GRAY).font(bold ? 'GeistBold' : 'Geist').fontSize(bold ? 10 : 8.5).text(l, left, y, { width: width - 120 });
      doc.fillColor(bold ? BLACK : BLACK).font(bold ? 'GeistBold' : 'Geist').fontSize(bold ? 10 : 8.5).text(`${neg ? '−' : ''}${v}`, left, y, { width, align: 'right' });
      y += bold ? 16 : 13;
    };
    stRow('Predané lístky', String(st.ticketsSold));
    stRow('Hrubá tržba', eur(st.revenueCents));
    stRow('Provízia', eur(st.commissionCents), true);
    stRow('DPH z provízie', eur(st.vatCents), true);
    stRow(`Refund poplatky (${st.refundedTickets} ks)`, eur(st.refundFeesCents), true);
    stRow('NETTO VÝPLATA organizátorovi', eur(st.netPayoutCents), false, true);

    // ── Pätička ──────────────────────────────────────────────────────────────
    doc.fillColor(LGRAY).font('Geist').fontSize(7.5)
      .text(`${data.supplier.name} · ticketall.eu`, left, 802, { width, align: 'center' });

    doc.end();
  });
}
