/**
 * Absolútna URL do administrácie (krok 36).
 *
 * JEDINÝ zdroj je APP_BASE_URL. Admin beží ako /admin/* pod hlavnou doménou;
 * samostatná admin subdoména neexistuje – admin.ticketall.eu je v Caddyfile už
 * len legacy 301 s fallbackom na verejnú homepage, takže odkaz postavený na nej
 * nikdy neotvorí detail. Premenné ADMIN_BASE_URL a EMAIL_ADMIN_BASE_URL boli
 * preto zrušené.
 *
 * Base sa normalizuje: odreže sa koncové lomítko aj prípadné koncové /admin,
 * aby pri nepozornej konfigurácii nevzniklo /admin/admin/…
 */
export function adminUrl(base: string | undefined, path: string): string {
  const root = (base || 'https://ticketall.eu')
    .replace(/\/+$/, '')
    .replace(/\/admin$/i, '');
  const rel = path.replace(/^\/+/, '');
  return `${root}/admin/${rel}`;
}
