export type ErrorEndpoint = 'login' | 'register-organizer' | 'register-customer' | 'password-reset';

export function getReadableError({
  endpoint,
  status,
  code,
}: {
  endpoint: ErrorEndpoint;
  status?: number;
  code?: string | string[];
}): string {
  if (!status) return 'Nemôžeme sa pripojiť k serveru. Skontrolujte pripojenie.';

  // Normalize array message from NestJS ValidationPipe
  const msg = Array.isArray(code) ? code.join(' ') : (code ?? '');
  const msgLow = msg.toLowerCase();

  switch (endpoint) {
    case 'login':
      if (status === 401) return 'Nesprávny e-mail alebo heslo. Skontrolujte údaje a skúste znova.';
      if (status === 423) return 'Účet je dočasne uzamknutý. Skúste o pár minút.';
      if (status === 400) return 'Vyplňte e-mail a heslo.';
      break;

    case 'register-organizer':
      if (status === 409) {
        if (msg === 'EMAIL_EXISTS_STAFF') return 'Tento e-mail je už registrovaný ako účet skenera/zamestnanca. Použite prosím iný e-mail.';
        if (msg === 'EMAIL_EXISTS_CUSTOMER') return 'Účet s týmto e-mailom už existuje. Prihláste sa, prípadne obnovte heslo.';
        if (msgLow.includes('slug')) return 'Tento URL slug je už obsadený. Skúste iný.';
        return 'Tento e-mail je už zaregistrovaný. Skúste sa prihlásiť.';
      }
      if (status === 400) {
        if (msgLow.includes('password') || msgLow.includes('weak'))
          return 'Heslo musí mať aspoň 8 znakov, vrátane veľkého písmena a číslice.';
        if (msgLow.includes('email'))
          return 'Zadajte platný e-mail.';
      }
      break;

    case 'register-customer':
      if (status === 409) return 'Tento e-mail je už zaregistrovaný. Skúste sa prihlásiť.';
      if (status === 400) {
        if (msgLow.includes('email')) return 'Zadajte platný e-mail.';
        if (msgLow.includes('password')) return 'Heslo musí mať aspoň 8 znakov, vrátane veľkého písmena a číslice.';
      }
      break;

    case 'password-reset':
      if (status === 400) return 'Tento odkaz na obnovenie hesla už nie je platný. Požiadajte o nový.';
      break;
  }

  if (status >= 500) return 'Nastala chyba na strane servera. Skúste neskôr.';
  return 'Niečo sa pokazilo. Skúste znova.';
}
