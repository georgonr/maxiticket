import { Injectable, Logger } from '@nestjs/common';
import { HelpdeskPriority, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { HelpdeskNumberService, helpdeskSubject } from './helpdesk-number.service';
import { HelpdeskMailService } from './helpdesk-mail.service';

export type EscalationChannel = 'GUEST' | 'CUSTOMER';
export type EscalationLocale = 'sk' | 'en' | 'cs';

/** Jedna správa histórie z chatu (rovnaký tvar ako ChatHistoryMsg asistenta). */
export interface EscalationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EscalateInput {
  channel: EscalationChannel;
  sessionKey: string;
  userId: string | null;
  locale: EscalationLocale;
  history: EscalationMessage[];
  agentSummary?: string;
  priority?: string;
  /** Len GUEST: e-mail zadaný cez endpoint (u CUSTOMER sa IGNORUJE, berie sa z účtu). */
  providedEmail?: string;
}

export type EscalateResult =
  | { status: 'created' | 'existing'; ticketNumber: string; email: string; ticketId: string }
  | { status: 'need_email' }
  | { status: 'invalid_email' }
  | { status: 'rate_limited' }
  | { status: 'no_account_email' };

const MAX_BODY = 8000;
const GUEST_MAX_PER_HOUR = 3;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAXLEN = 254;

/** Text potvrdzujúceho e-mailu (telo). i18n podľa locale tiketu. */
const MAIL_CONFIRM: Record<EscalationLocale, (n: string) => string> = {
  sk: (n) => `Dobrý deň,\n\nvašu požiadavku sme zaevidovali pod číslom ${n}. Podpora sa vám ozve čo najskôr.`,
  en: (n) => `Hello,\n\nyour request has been registered as ${n}. Support will get back to you as soon as possible.`,
  cs: (n) => `Dobrý den,\n\nvaši požadavku jsme zaevidovali pod číslem ${n}. Podpora se vám ozve co nejdříve.`,
};

/**
 * Eskalácia AI konverzácie do helpdeskového tiketu (krok 38).
 *
 * Volá ju tool escalateToAdmin (CUSTOMER) aj guest endpoint (GUEST po zadaní
 * e-mailu). Idempotencia stojí na HelpdeskTicket.conversationId @unique –
 * opakované volanie tej istej konverzácie vráti existujúci tiket, nezaloží druhý.
 */
@Injectable()
export class HelpdeskEscalationService {
  private readonly logger = new Logger(HelpdeskEscalationService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private numbers: HelpdeskNumberService,
    private helpdeskMail: HelpdeskMailService,
  ) {}

  async escalate(input: EscalateInput): Promise<EscalateResult> {
    // 1) E-mail: CUSTOMER z účtu (nikdy nie zadaný agentom), GUEST zo zadaného.
    let email: string;
    let customerName: string | null = null;
    if (input.channel === 'CUSTOMER') {
      if (!input.userId) return { status: 'no_account_email' };
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, firstName: true, lastName: true },
      });
      if (!user?.email) return { status: 'no_account_email' };
      email = user.email;
      customerName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
    } else {
      const raw = (input.providedEmail ?? '').trim().slice(0, EMAIL_MAXLEN);
      if (!raw) return { status: 'need_email' };
      if (!EMAIL_RE.test(raw)) return { status: 'invalid_email' };
      email = raw;
    }

    // 2) Konverzácia: reuse OPEN podľa sessionKey, inak vytvor. Nastav escalated.
    const conv = await this.resolveConversation(input);

    // 3) Idempotencia: tiket na túto konverzáciu už existuje → vráť ho, nič neposielaj znova.
    const existing = await this.prisma.helpdeskTicket.findUnique({
      where: { conversationId: conv.id },
      select: { id: true, ticketNumber: true, customerEmail: true },
    });
    if (existing) {
      return { status: 'existing', ticketNumber: existing.ticketNumber, email: existing.customerEmail, ticketId: existing.id };
    }

    // 4) Rate limit LEN pre GUEST (spam kanál): max N tiketov/hodina/sessionKey.
    if (input.channel === 'GUEST') {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recent = await this.prisma.helpdeskTicket.count({
        where: { source: 'CHAT', createdAt: { gte: hourAgo }, conversation: { sessionKey: input.sessionKey } },
      });
      if (recent >= GUEST_MAX_PER_HOUR) return { status: 'rate_limited' };
    }

    // 5) Vytvor tiket. P2002 na conversationId = súbežná eskalácia → vráť existujúci.
    const priority = this.parsePriority(input.priority);
    const aiSummary = (input.agentSummary?.trim() || this.deriveSummary(input.history)).slice(0, MAX_BODY);
    const ticketNumber = await this.numbers.nextTicketNumber();

    let ticketId: string;
    try {
      const created = await this.prisma.helpdeskTicket.create({
        data: {
          ticketNumber,
          subject: aiSummary.split('\n')[0].slice(0, 120),
          customerEmail: email,
          customerName,
          locale: input.locale,
          status: 'OPEN',
          priority,
          source: 'CHAT',
          conversationId: conv.id,
          aiSummary,
        },
        select: { id: true },
      });
      ticketId = created.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const t = await this.prisma.helpdeskTicket.findUnique({
          where: { conversationId: conv.id },
          select: { id: true, ticketNumber: true, customerEmail: true },
        });
        if (t) return { status: 'existing', ticketNumber: t.ticketNumber, email: t.customerEmail, ticketId: t.id };
      }
      throw e;
    }

    // 6) Prenes celú históriu do vlákna tiketu (user→CUSTOMER, assistant→AI).
    await this.transferHistory(ticketId, conv.id, input.history);

    // 7) Potvrdenie e-mailom. Uloží sa ako ADMIN správa s emailMessageId, aby
    //    mala odpoveď zákazníka na čo reťaziť (In-Reply-To).
    await this.sendConfirmation(ticketId, ticketNumber, email, input.locale);

    // 8) Telegram – jednotný formát s odkazom „Otvoriť v admin".
    await this.helpdeskMail.notifyTelegram({
      title: '🆕 <b>Nový tiket z chatu</b>',
      ticketNumber,
      ticketId,
      customerEmail: email,
      snippet: aiSummary,
    });

    this.logger.log(`Eskalácia ${input.channel} → tiket ${ticketNumber} (${email}).`);
    return { status: 'created', ticketNumber, email, ticketId };
  }

  private async resolveConversation(input: EscalateInput) {
    const now = new Date();
    const existing = await this.prisma.conversation.findFirst({
      where: { sessionKey: input.sessionKey, status: 'OPEN' },
      orderBy: { lastMessageAt: 'desc' },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.conversation.update({
        where: { id: existing.id },
        data: { escalated: true, lastMessageAt: now },
      });
      return existing;
    }
    return this.prisma.conversation.create({
      data: {
        channel: input.channel,
        sessionKey: input.sessionKey,
        userId: input.userId,
        locale: input.locale,
        escalated: true,
        lastMessageAt: now,
      },
      select: { id: true },
    });
  }

  /**
   * Prenesie históriu do HelpdeskMessage. createdAt sa berie z už uložených
   * Conversation.Message riadkov podľa poradia (zachová pôvodný čas); posledná
   * (práve poslaná, ešte neuložená) správa dostane aktuálny čas.
   */
  private async transferHistory(ticketId: string, conversationId: string, history: EscalationMessage[]): Promise<void> {
    if (history.length === 0) return;
    const persisted = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, createdAt: true },
    });
    const base = Date.now();
    const rows = history.map((h, i) => {
      const p = persisted[i];
      const createdAt = p && p.role === h.role ? p.createdAt : new Date(base + i);
      return {
        ticketId,
        sender: (h.role === 'user' ? 'CUSTOMER' : 'AI') as 'CUSTOMER' | 'AI',
        body: h.content.slice(0, MAX_BODY),
        viaEmail: false,
        createdAt,
      };
    });
    await this.prisma.helpdeskMessage.createMany({ data: rows });
  }

  private async sendConfirmation(ticketId: string, ticketNumber: string, email: string, locale: EscalationLocale): Promise<void> {
    const body = MAIL_CONFIRM[locale](ticketNumber);
    const saved = await this.prisma.helpdeskMessage.create({
      data: { ticketId, sender: 'ADMIN', body, viaEmail: true },
      select: { id: true },
    });
    const res = await this.mail.sendHelpdeskReply({
      to: email,
      subject: helpdeskSubject(ticketNumber, null),
      text: body,
      locale,
      ticketNumber,
    });
    if (res.ok && res.messageId) {
      await this.prisma.helpdeskMessage.update({ where: { id: saved.id }, data: { emailMessageId: res.messageId } });
    } else {
      this.logger.warn(`Potvrdenie ${ticketNumber} uložené, e-mail zlyhal: ${res.error}`);
    }
  }

  private parsePriority(value?: string): HelpdeskPriority {
    const v = (value ?? '').toUpperCase();
    return v === 'LOW' || v === 'HIGH' ? (v as HelpdeskPriority) : HelpdeskPriority.NORMAL;
  }

  /** Fallback zhrnutie, keď agent nedodal summary (napr. guest endpoint) – posledná otázka zákazníka. */
  private deriveSummary(history: EscalationMessage[]): string {
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    return lastUser?.content.slice(0, 300) || 'Požiadavka zákazníka z chatu.';
  }
}
