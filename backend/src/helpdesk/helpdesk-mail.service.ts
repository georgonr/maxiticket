import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { TICKET_NUMBER_RE } from './helpdesk-number.service';

const MAILBOX = 'INBOX';
const INTERVAL_NAME = 'helpdesk-imap-poll';

/** Maily nad týmto limitom preskakujeme – prílohy nesťahujeme, nemá zmysel ich ťahať do RAM. */
const MAX_MAIL_BYTES = 5 * 1024 * 1024;

/** Strop dĺžky uloženej správy. Citovaná história sa odreže ešte pred týmto. */
const MAX_BODY_CHARS = 8000;

/** Koľko znakov správy ide do Telegram notifikácie. */
const TELEGRAM_SNIPPET = 200;

/**
 * Markery začiatku citovanej histórie. Berieme NAJSKORŠÍ výskyt – klient môže
 * použiť viacero naraz (Gmail "On … wrote:" + zalomené ">").
 */
const QUOTE_MARKERS: RegExp[] = [
  /^\s*On .*wrote:/mi,
  /^\s*Dňa .* napísal/mi,
  /^\s*Dna .* napisal/mi,
  /^-----Original Message-----/mi,
  /^\s*Od:\s/mi,
  /^\s*From:\s/mi,
  /^\s*_{5,}\s*$/m, // Outlook oddeľovač
  /^\s*>{1,}/m,
];

/**
 * Odreže citovanú históriu z tela odpovede. Keď by výsledok bol prázdny
 * (marker hneď na začiatku, napr. top-post bez nového textu), vraciame pôvodný
 * text – radšej uložiť aj citáciu než stratiť obsah.
 */
export function stripQuoted(raw: string): string {
  let cut = raw.length;
  for (const re of QUOTE_MARKERS) {
    const m = raw.match(re);
    if (m?.index !== undefined && m.index < cut) cut = m.index;
  }
  const stripped = raw.slice(0, cut).trim();
  return stripped.length > 0 ? stripped : raw.trim();
}

/**
 * IMAP poller helpdesku (krok 29).
 *
 * DVE TVRDÉ OBMEDZENIA, lebo info@ticketall.eu je bežná firemná schránka,
 * nie vyhradený helpdesk:
 *  1. Spracujeme LEN maily spárovateľné s existujúcim tiketom. Z nespárovaných
 *     sa NIKDY nezakladá nový tiket – inak by sa každá faktúra a newsletter
 *     stali helpdeskovou požiadavkou.
 *  2. Schránka sa NEMENÍ. Otvára sa READ-ONLY, žiadne MOVE/DELETE/\Seen.
 *     Používateľ musí vidieť poštu presne tak, ako ju nechal. Pozíciu drží
 *     výhradne UID kurzor v HelpdeskMailState.
 */
@Injectable()
export class HelpdeskMailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HelpdeskMailService.name);
  /** Guard proti prekrývaniu behov – IMAP kolo môže trvať dlhšie než interval. */
  private running = false;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private telegram: TelegramService,
    private scheduler: SchedulerRegistry,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('Helpdesk IMAP poller vypnutý (HELPDESK_ENABLED != true).');
      return;
    }
    // @Interval dekorátor berie konštantu; interval má byť konfigurovateľný
    // cez ENV bez zásahu do kódu, preto ho registrujeme dynamicky.
    const sec = Number(this.config.get('HELPDESK_IMAP_POLL_SEC', '60')) || 60;
    const handle = setInterval(() => void this.poll(), sec * 1000);
    this.scheduler.addInterval(INTERVAL_NAME, handle);
    this.logger.log(`Helpdesk IMAP poller zapnutý (${MAILBOX}, každých ${sec}s, read-only).`);
  }

  onModuleDestroy() {
    if (this.scheduler.doesExist('interval', INTERVAL_NAME)) {
      this.scheduler.deleteInterval(INTERVAL_NAME);
    }
  }

  private isEnabled(): boolean {
    if (this.config.get<string>('HELPDESK_ENABLED') !== 'true') return false;
    return ['HELPDESK_IMAP_HOST', 'HELPDESK_IMAP_USER', 'HELPDESK_IMAP_PASS'].every(
      (k) => !!this.config.get<string>(k),
    );
  }

  /** Jedno kolo pollovania. Verejné kvôli ručnému spusteniu pri diagnostike. */
  async poll(): Promise<{ skipped?: string; seen: number; matched: number; ignored: number }> {
    const empty = { seen: 0, matched: 0, ignored: 0 };
    // Vypnuté / nedokonfigurované = ticho preskoč. Žiadne ERROR logy každú minútu.
    if (!this.isEnabled()) return { ...empty, skipped: 'disabled' };
    if (this.running) {
      this.logger.warn('Predchádzajúce IMAP kolo ešte beží, preskakujem.');
      return { ...empty, skipped: 'overlap' };
    }
    this.running = true;

    const client = new ImapFlow({
      host: this.config.get<string>('HELPDESK_IMAP_HOST'),
      port: Number(this.config.get('HELPDESK_IMAP_PORT', '993')),
      secure: true,
      auth: {
        user: this.config.get<string>('HELPDESK_IMAP_USER'),
        pass: this.config.get<string>('HELPDESK_IMAP_PASS'),
      },
      logger: false,
      greetingTimeout: 15_000,
      socketTimeout: 60_000,
    });

    let seen = 0;
    let matched = 0;
    let ignored = 0;
    let lock: { release: () => void } | undefined;

    try {
      await client.connect();
      lock = await client.getMailboxLock(MAILBOX, { readOnly: true });

      const mailbox = client.mailbox as { uidNext: number; uidValidity: bigint | number };
      const uidValidity = BigInt(mailbox.uidValidity);
      const state = await this.prisma.helpdeskMailState.findUnique({ where: { mailbox: MAILBOX } });

      // Prvý beh alebo server prečísloval UID → NEspracúvaj históriu. Inak by
      // prvé spustenie prešlo celú firemnú schránku a rozposlalo notifikácie.
      if (!state || state.uidValidity === null || state.uidValidity !== uidValidity) {
        const baseline = Math.max(0, mailbox.uidNext - 1);
        await this.saveCursor(baseline, uidValidity);
        this.logger.log(
          `Baseline nastavená na UID ${baseline} (uidValidity ${uidValidity}), história sa nespracúva.`,
        );
        return { ...empty, skipped: 'baseline' };
      }

      const from = state.lastUid + 1;
      if (from >= mailbox.uidNext) return empty;

      // Dvojfázovo: najprv len UID + veľkosť, telo až pre maily pod limitom.
      // Jeden fetch so `source` by stiahol aj 20 MB prílohu, ktorú aj tak zahodíme.
      const heads: { uid: number; size: number }[] = [];
      for await (const msg of client.fetch(`${from}:*`, { uid: true, size: true }, { uid: true })) {
        // `from:*` vráti aj poslednú správu, keď je schránka prázdnejšia než kurzor.
        if (msg.uid < from) continue;
        heads.push({ uid: msg.uid, size: msg.size ?? 0 });
      }
      heads.sort((a, b) => a.uid - b.uid); // vzostupne, poradie správ musí sedieť

      for (const head of heads) {
        seen++;
        try {
          const handled = await this.handleMessage(client, head.uid, head.size);
          if (handled) matched++;
          else ignored++;
        } catch (e: any) {
          // Jeden pokazený mail nesmie zablokovať kurzor navždy.
          ignored++;
          this.logger.error(`UID ${head.uid}: spracovanie zlyhalo: ${e.message}`);
        }
        // Kurzor priebežne – po páde sa neopakuje už spracované.
        await this.saveCursor(head.uid, uidValidity);
      }

      if (seen > 0) {
        this.logger.log(`IMAP kolo: ${seen} nových, ${matched} spárovaných, ${ignored} ignorovaných.`);
      }
      return { seen, matched, ignored };
    } catch (e: any) {
      this.logger.error(`IMAP kolo zlyhalo: ${e.message}`);
      return { ...empty, skipped: 'error' };
    } finally {
      lock?.release();
      try {
        await client.logout();
      } catch {
        client.close();
      }
      this.running = false;
    }
  }

  private async saveCursor(lastUid: number, uidValidity: bigint): Promise<void> {
    await this.prisma.helpdeskMailState.upsert({
      where: { mailbox: MAILBOX },
      create: { mailbox: MAILBOX, lastUid, uidValidity },
      update: { lastUid, uidValidity },
    });
  }

  /** @returns true = spárované a uložené, false = ignorované */
  private async handleMessage(client: ImapFlow, uid: number, size: number): Promise<boolean> {
    if (size > MAX_MAIL_BYTES) {
      this.logger.log(`UID ${uid}: preskočený, ${Math.round(size / 1024)} kB > limit.`);
      return false;
    }

    const full = await client.fetchOne(String(uid), { source: true }, { uid: true });
    if (!full || !full.source) {
      this.logger.warn(`UID ${uid}: chýba source, preskakujem.`);
      return false;
    }

    const mail = await simpleParser(full.source);

    const loop = this.loopReason(mail);
    if (loop) {
      this.logger.log(`UID ${uid}: ignorovaný (${loop}).`);
      return false;
    }

    const ticket = await this.matchTicket(mail);
    if (!ticket) {
      this.logger.log(`UID ${uid}: ignored, no match (subject: ${(mail.subject ?? '').slice(0, 80)}).`);
      return false;
    }

    const body = stripQuoted(mail.text ?? '').slice(0, MAX_BODY_CHARS);

    // Prílohy zásadne NEUKLADÁME – len stopu, že prišli. Žiadny obsah nikam.
    const names = (mail.attachments ?? [])
      .map((a) => a.filename)
      .filter((n): n is string => !!n);
    const count = (mail.attachments ?? []).length;
    const attachmentNote =
      count > 0 ? `${count} ${this.plural(count)}: ${names.join(', ') || 'bez názvu'}` : null;

    const messageId = mail.messageId ?? null;
    const inReplyTo = mail.inReplyTo ?? null;

    try {
      await this.prisma.$transaction([
        this.prisma.helpdeskMessage.create({
          data: {
            ticketId: ticket.id,
            sender: 'CUSTOMER',
            body,
            viaEmail: true,
            emailMessageId: messageId,
            emailInReplyTo: inReplyTo,
            hasAttachments: count > 0,
            attachmentNote,
          },
        }),
        this.prisma.helpdeskTicket.update({
          where: { id: ticket.id },
          data: { status: 'OPEN', updatedAt: new Date() },
        }),
      ]);
    } catch (e: any) {
      // emailMessageId je @unique – ten istý mail videný druhýkrát (retry, dvojitý
      // fetch) sa má ticho preskočiť a kurzor sa aj tak posunúť.
      if (e?.code === 'P2002') {
        this.logger.log(`UID ${uid}: už spracovaný (Message-ID ${messageId}), preskakujem.`);
        return false;
      }
      throw e;
    }

    this.logger.log(`UID ${uid}: pripojený k tiketu ${ticket.ticketNumber}.`);
    await this.notifyTelegram(ticket.ticketNumber, body);
    return true;
  }

  private plural(n: number): string {
    if (n === 1) return 'príloha';
    if (n < 5) return 'prílohy';
    return 'príloh';
  }

  /**
   * Ochrana proti slučke. Bez nej stačí jedna dovolenková autoodpoveď: pošleme
   * notifikáciu → autoresponder odpovie → spárujeme → dokola.
   * @returns dôvod zahodenia alebo null
   */
  private loopReason(mail: ParsedMail): string | null {
    const fromAddr = mail.from?.value?.[0]?.address?.toLowerCase() ?? '';
    if (!fromAddr) return 'prázdny odosielateľ (bounce/MAILER-DAEMON)';

    const smtpUser = (this.config.get<string>('SMTP_USER') ?? '').toLowerCase();
    if (smtpUser && fromAddr === smtpUser) return 'vlastná odoslaná pošta';

    const header = (name: string): string =>
      String(mail.headers.get(name) ?? '').toLowerCase();

    const autoSubmitted = header('auto-submitted');
    if (autoSubmitted && autoSubmitted !== 'no') return `Auto-Submitted: ${autoSubmitted}`;
    if (mail.headers.has('x-autoreply')) return 'X-Autoreply';
    if (mail.headers.has('x-autorespond')) return 'X-Autorespond';

    const precedence = header('precedence');
    if (['bulk', 'auto_reply', 'junk'].includes(precedence)) return `Precedence: ${precedence}`;

    return null;
  }

  /**
   * Párovanie v poradí: značka [HD-…] v predmete, potom e-mailové hlavičky.
   * Značka je spoľahlivejšia – prežije aj klienta, ktorý In-Reply-To nepošle.
   */
  private async matchTicket(mail: ParsedMail) {
    const select = { id: true, ticketNumber: true };

    const tag = (mail.subject ?? '').match(TICKET_NUMBER_RE);
    if (tag) {
      const ticket = await this.prisma.helpdeskTicket.findUnique({
        where: { ticketNumber: tag[1].toUpperCase() },
        select,
      });
      if (ticket) return ticket;
    }

    const refs = [
      mail.inReplyTo,
      ...(Array.isArray(mail.references) ? mail.references : [mail.references]),
    ].filter((r): r is string => !!r);

    if (refs.length > 0) {
      const prior = await this.prisma.helpdeskMessage.findFirst({
        where: { emailMessageId: { in: refs } },
        select: { ticket: { select } },
      });
      if (prior) return prior.ticket;
    }

    return null;
  }

  /**
   * Telegram notifikácia. Zámerne NIE cez shouldNotifySummary() – ten flag
   * (escalationOnly) sa týka zhrnutí AI konverzácií, nie helpdesku.
   * Nikdy nehádže: výpadok Telegramu nesmie zahodiť už uloženú správu.
   */
  private async notifyTelegram(ticketNumber: string, body: string): Promise<void> {
    const snippet = body.slice(0, TELEGRAM_SNIPPET) + (body.length > TELEGRAM_SNIPPET ? '…' : '');
    const text = `📩 <b>Odpoveď na tiket ${ticketNumber}</b>\n${this.escapeHtml(snippet)}`;
    await this.telegram
      .sendMessage(text, { parseMode: 'HTML', disableWebPagePreview: true })
      .catch((e: any) => this.logger.warn(`Telegram notifikácia zlyhala: ${e.message}`));
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
