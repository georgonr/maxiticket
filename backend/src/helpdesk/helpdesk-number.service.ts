import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Prefix čísla tiketu. Zámerne NIE "MT-" – to majú objednávky (MT-2026-00024). */
export const HELPDESK_NUMBER_PREFIX = 'HD-';

/** Šírka číselnej časti: HD-00001. */
const HELPDESK_NUMBER_PAD = 5;

/**
 * JEDINÉ miesto, kde vzniká predmet helpdeskového e-mailu. KROK 3 (IMAP poller)
 * parsuje presne tento tvar cez TICKET_NUMBER_RE, takže obe musia ostať v páre –
 * ak sa mení jedno, mení sa aj druhé.
 */
export function helpdeskSubject(ticketNumber: string, subject?: string | null): string {
  const topic = subject?.trim() || 'Vaša požiadavka';
  return `[${ticketNumber}] ${topic}`;
}

/**
 * Vytiahne číslo tiketu z predmetu odpovede. Zvládne aj prefixy poštových
 * klientov ("Re: [HD-00001] …", "Fwd: …") – hľadá kdekoľvek v reťazci.
 * {4,} nie {5}, aby číslovanie prežilo prechod cez 100 000 tiketov.
 */
export const TICKET_NUMBER_RE = /\[(HD-\d{4,})\]/i;

@Injectable()
export class HelpdeskNumberService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ďalšie číslo tiketu z Postgres sekvencie.
   *
   * ZÁMERNE nie count()+1 ako orderNumber v orders.service.ts: po zmazaní tiketu
   * by sa číslo recyklovalo a dvaja zákazníci by dostali to isté HD-… do e-mailu.
   * Odpovede sa párujú podľa čísla v predmete, takže by si navzájom padali do
   * cudzieho vlákna. Sekvencia je monotónna aj naprieč súbežnými requestmi a
   * nevracia sa späť ani pri rollbacku transakcie – diery v číslovaní sú v poriadku,
   * duplicity nie.
   */
  async nextTicketNumber(): Promise<string> {
    const rows = await this.prisma.$queryRaw<
      { nextval: bigint }[]
    >`SELECT nextval('helpdesk_ticket_number_seq')`;
    const n = Number(rows[0].nextval);
    return `${HELPDESK_NUMBER_PREFIX}${String(n).padStart(HELPDESK_NUMBER_PAD, '0')}`;
  }
}
