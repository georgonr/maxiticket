/**
 * Zdieľaný HTML layout pre e-maily (krok 32).
 *
 * Farby a hlavička sú prevzaté z existujúcich šablón sendTickets/sendInvoice,
 * aby helpdesk nezaviedol druhý vizuálny štýl. Nič sa nevymýšľalo nanovo.
 *
 * PRAVIDLÁ E-MAILOVÉHO HTML (nie je to web):
 *  - layout cez <table>, nie flexbox/grid – Outlook (Word engine) ich nevie
 *  - všetky štýly inline, žiadny <style> blok ani externé CSS
 *  - šírka 600 px, vycentrované, s tabuľkou na 100 % ako pozadím
 *  - font-family so systémovým fallbackom
 *
 * HLAVIČKA JE TEXTOVÝ WORDMARK, NIE OBRÁZOK – zámerne. Vo frontend/public
 * neexistuje žiadny použiteľný PNG s logom (všetky logá sú SVG, ktoré Gmail
 * nezobrazí, a icons/icon-*.png sú 69-bajtové placeholdery).
 * Až keď pribudne skutočný PNG, stačí sem doplniť <img> s absolútnou URL,
 * pevnou šírkou a alt textom.
 */

/** Farby zhodné s sendTickets/sendInvoice. */
export const MAIL_TEAL = '#10B981';
export const MAIL_TEXT = '#374151';
export const MAIL_MUTED = '#6b7280';
export const MAIL_FAINT = '#9ca3af';
export const MAIL_BORDER = '#e5e7eb';
export const MAIL_BG = '#f9fafb';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escape do HTML kontextu. Telo píše zákazník aj operátor – nikdy ho nevkladáme surové. */
export function escapeHtmlForMail(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Text → HTML odstavec so zachovanými zalomeniami riadkov. */
export function textToHtml(s: string): string {
  return escapeHtmlForMail(s).replace(/\r?\n/g, '<br/>');
}

export interface EmailLayoutOptions {
  /** Hlavný obsah – už hotové HTML (volajúci si ho escapuje sám). */
  bodyHtml: string;
  /** Zvýraznená poznámka nad pätičkou (napr. výzva odpovedať). */
  noteHtml?: string;
  /** Riadky pätičky, každý na vlastnom riadku, drobným písmom. */
  footerLines?: string[];
  /** Odkaz v pätičke. */
  linkUrl?: string;
  linkLabel?: string;
}

export function renderEmailLayout(o: EmailLayoutOptions): string {
  const footer = (o.footerLines ?? [])
    .map((l) => `<div style="margin:0 0 4px;">${l}</div>`)
    .join('');

  const link = o.linkUrl
    ? `<div style="margin:8px 0 0;"><a href="${o.linkUrl}" style="color:${MAIL_MUTED};text-decoration:underline;">${o.linkLabel ?? o.linkUrl}</a></div>`
    : '';

  const note = o.noteHtml
    ? `<tr><td style="padding:0 32px 20px;">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${MAIL_BG};border-radius:8px;">
           <tr><td style="padding:14px 16px;font-family:${FONT};font-size:13px;line-height:20px;color:${MAIL_MUTED};">${o.noteHtml}</td></tr>
         </table>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:${MAIL_BG};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background-color:${MAIL_BG};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="border-collapse:collapse;width:600px;max-width:600px;background-color:#ffffff;border:1px solid ${MAIL_BORDER};border-radius:12px;">

      <tr><td align="center" style="padding:28px 32px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr><td style="background-color:${MAIL_TEAL};border-radius:8px;padding:8px 16px;font-family:${FONT};font-size:18px;font-weight:700;color:#ffffff;">TicketAll</td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:0 32px 20px;font-family:${FONT};font-size:15px;line-height:23px;color:${MAIL_TEXT};">
        ${o.bodyHtml}
      </td></tr>

      <tr><td style="padding:0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr><td style="border-top:1px solid ${MAIL_BORDER};font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td></tr>

      <tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>
      ${note}

      <tr><td align="center" style="padding:0 32px 28px;font-family:${FONT};font-size:12px;line-height:18px;color:${MAIL_FAINT};">
        ${footer}${link}
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}
