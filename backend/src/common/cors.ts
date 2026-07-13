// Jediný zdroj pravdy pre povolené CORS domény – používa ho main.ts (enableCors) aj
// asistent SSE controllery (ktoré cez reply.hijack() obchádzajú @fastify/cors hook a
// musia CORS hlavičky doplniť ručne). Nech sa zoznamy nikdy nerozídu.
export const CORS_ORIGINS = [
  'https://ticketall.eu',
  'https://www.ticketall.eu',
  // admin.ticketall.eu odstránené (Úloha 11/3): už nesservíruje frontend, len 301 redirect.
  'https://skener.ticketall.eu',
  'http://localhost:3000',
];

/**
 * CORS hlavičky pre hijacknuté SSE odpovede. Keďže enableCors má credentials:true,
 * ACAO nesmie byť '*' → echujeme Origin, ak je v allowliste. Inak žiadne CORS hlavičky
 * (prehliadač cross-origin odpoveď zablokuje = bezpečné).
 */
export function sseCorsHeaders(origin?: string): Record<string, string> {
  if (origin && CORS_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    };
  }
  return {};
}
