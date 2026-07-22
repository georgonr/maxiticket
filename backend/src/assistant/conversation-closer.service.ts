import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ASSISTANT_LLM, AssistantLlmProvider, LlmMessage } from './llm/llm.types';
import { TelegramService } from '../telegram/telegram.service';
import { adminUrl } from '../common/admin-url';

const IDLE_MINUTES = 10; // prah nečinnosti → konverzácia sa považuje za skončenú
const BATCH = 20; // max konverzácií na jeden beh (aby LLM volania nezahltili)

/**
 * Krok AI-KONV-3: @Cron detekcia konca konverzácie. Idle OPEN konverzácie (bez správy > 10 min)
 * sa zatvoria, cez Sonnet (ASSISTANT_LLM) sa vygeneruje zhrnutie + escalation flag a pošle sa
 * Telegram notifikácia (best-effort – Telegram/summary výpadok konverzáciu aj tak zatvorí).
 */
@Injectable()
export class ConversationCloserService {
  private readonly logger = new Logger(ConversationCloserService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ASSISTANT_LLM) private readonly llm: AssistantLlmProvider,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async closeIdleConversations(): Promise<void> {
    const cutoff = new Date(Date.now() - IDLE_MINUTES * 60 * 1000);
    const idle = await this.prisma.conversation.findMany({
      where: { status: 'OPEN', lastMessageAt: { lt: cutoff } },
      orderBy: { lastMessageAt: 'asc' },
      take: BATCH,
      select: { id: true },
    });
    if (idle.length === 0) return;
    for (const c of idle) {
      await this.closeOne(c.id).catch((e) => this.logger.warn(`closeOne ${c.id} failed: ${e.message}`));
    }
  }

  /** Verejné pre manuálne overenie/spustenie. */
  async closeOne(id: string): Promise<void> {
    // Atomicky zatvor len ak je ešte OPEN (bráni dvojitému spracovaniu súbežnými behmi).
    const claimed = await this.prisma.conversation.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    if (claimed.count === 0) return;

    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true } } },
    });
    if (!conv) return;

    // Summary + escalation (best-effort).
    let summary: string | null = null;
    let escalated = false;
    if (conv.messages.length > 0 && this.llm.isConfigured()) {
      try {
        const text = await this.summarize(conv.messages, conv.locale);
        escalated = /ESCALATE:\s*(ÁNO|ANO|YES)/i.test(text);
        summary = text.replace(/ESCALATE:\s*(ÁNO|ANO|NIE|NE|YES|NO)\.?\s*$/i, '').trim() || null;
      } catch (e: any) {
        this.logger.warn(`summarize ${id} failed: ${e.message}`);
      }
    }
    await this.prisma.conversation.update({ where: { id }, data: { summary, escalated } });

    // Konverzácia je uložená vždy; escalationOnly riadi len Telegram notifikáciu (krok 4).
    if (conv.messages.length > 0 && (await this.telegram.shouldNotifySummary(escalated))) {
      await this.notify(conv, summary, escalated).catch((e) => this.logger.warn(`notify ${id} failed: ${e.message}`));
    }
  }

  private async summarize(messages: { role: string; content: string }[], locale: string): Promise<string> {
    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'Zákazník' : 'Asistent'}: ${m.content}`)
      .join('\n')
      .slice(0, 8000);
    const sys =
      `Zhrň túto zákaznícku konverzáciu 1-2 vetami v jazyku "${locale}". ` +
      `Na koniec na nový riadok urči, či zákazník potreboval ľudskú podporu alebo agent nevedel odpovedať – ` +
      `vráť presne "ESCALATE: ÁNO" alebo "ESCALATE: NIE".`;
    const llmMessages: LlmMessage[] = [
      { role: 'system', content: sys },
      { role: 'user', content: transcript },
    ];
    let acc = '';
    await this.llm.streamChat(llmMessages, [], (d) => { acc += d; });
    return acc.trim();
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private async notify(
    conv: { id: string; channel: string; userId: string | null; locale: string; closedAt: Date | null; messages: unknown[] },
    summary: string | null,
    escalated: boolean,
  ): Promise<void> {
    let who = 'guest';
    if (conv.channel === 'CUSTOMER') {
      let email: string | null = null;
      if (conv.userId) {
        const u = await this.prisma.user.findUnique({ where: { id: conv.userId }, select: { email: true } });
        email = u?.email ?? null;
      }
      who = `prihlásený${email ? ` (${this.escapeHtml(email)})` : ''}`;
    }
    const link = adminUrl(this.config.get<string>('APP_BASE_URL'), `ai-conversations/${conv.id}`);
    const when = (conv.closedAt ?? new Date()).toISOString().slice(0, 16).replace('T', ' ');
    const title = escalated ? '⚠️ <b>Konverzácia — TREBA ODPOVEDAŤ</b>' : '🎫 <b>Nová konverzácia (zhrnutie)</b>';

    const lines = [
      title,
      `Kanál: ${who} · Jazyk: ${conv.locale} · Správ: ${conv.messages.length}`,
      `Čas: ${when}`,
      '',
      summary ? `Zhrnutie: ${this.escapeHtml(summary)}` : 'Zhrnutie sa nepodarilo vygenerovať.',
      '',
      `<a href="${link}">Otvoriť v admin</a>`,
    ];
    await this.telegram.sendMessage(lines.join('\n'), { parseMode: 'HTML', disableWebPagePreview: true });
  }
}
