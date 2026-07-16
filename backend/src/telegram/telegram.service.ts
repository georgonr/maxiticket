import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/** Config pre admin UI – zámerne bez tokenu, len tokenSet príznak. */
export interface TelegramConfigView {
  chatId: string | null;
  enabled: boolean;
  escalationOnly: boolean;
  tokenSet: boolean;
}

/**
 * Telegram notifikácie (krok AI-KONV-2). Hybrid config:
 *  - TELEGRAM_BOT_TOKEN je tajomstvo v .env (nikdy v DB, nikdy sa nevracia klientovi),
 *  - chatId + enabled toggle v DB (TelegramConfig singleton, editovateľné cez admin UI v kroku 4).
 * Best-effort: výpadok Telegramu nesmie nič zhodiť.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private token(): string {
    return this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  /** Singleton config riadok (vytvorí prázdny ak neexistuje). */
  private async getConfigRow() {
    const existing = await this.prisma.telegramConfig.findFirst();
    if (existing) return existing;
    return this.prisma.telegramConfig.create({ data: {} });
  }

  /** Config pre admin UI – NIKDY nevracia token, len tokenSet boolean. */
  async getTelegramConfig(): Promise<TelegramConfigView> {
    const row = await this.getConfigRow();
    return {
      chatId: row.chatId,
      enabled: row.enabled,
      escalationOnly: row.escalationOnly,
      tokenSet: this.token().length > 0,
    };
  }

  /** Uloží chatId/enabled/escalationOnly (admin UI, krok 4). Token sa cez toto NIKDY nemení. */
  async setTelegramConfig(
    patch: { chatId?: string | null; enabled?: boolean; escalationOnly?: boolean },
    updatedById?: string,
  ): Promise<TelegramConfigView> {
    const row = await this.getConfigRow();
    const updated = await this.prisma.telegramConfig.update({
      where: { id: row.id },
      data: {
        ...(patch.chatId !== undefined ? { chatId: patch.chatId || null } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.escalationOnly !== undefined ? { escalationOnly: patch.escalationOnly } : {}),
        ...(updatedById ? { updatedById } : {}),
      },
    });
    return {
      chatId: updated.chatId,
      enabled: updated.enabled,
      escalationOnly: updated.escalationOnly,
      tokenSet: this.token().length > 0,
    };
  }

  /**
   * Má sa o zatvorenej konverzácii posielať Telegram notifikácia?
   * Pri escalationOnly=true prejdú len eskalované. Zámerne mimo sendMessage() –
   * test správa z admin UI musí odísť vždy, filter sa týka len summary notifikácií.
   */
  async shouldNotifySummary(escalated: boolean): Promise<boolean> {
    if (escalated) return true;
    const row = await this.getConfigRow();
    return !row.escalationOnly;
  }

  /**
   * Pošle správu do Telegramu. No-op (false) ak: enabled=false ALEBO prázdny token ALEBO prázdny chatId.
   * Chyby swallow (log warn, vráť false). Žiadna npm závislosť – natívny fetch na Telegram Bot API.
   */
  async sendMessage(
    text: string,
    opts?: { parseMode?: 'Markdown' | 'HTML'; disableWebPagePreview?: boolean },
  ): Promise<boolean> {
    const token = this.token();
    const row = await this.getConfigRow();
    if (!row.enabled || !token || !row.chatId) {
      this.logger.log(
        `Telegram sendMessage no-op (enabled=${row.enabled}, tokenSet=${!!token}, chatIdSet=${!!row.chatId}).`,
      );
      return false;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: row.chatId,
          text,
          ...(opts?.parseMode ? { parse_mode: opts.parseMode } : {}),
          ...(opts?.disableWebPagePreview ? { disable_web_page_preview: true } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Telegram sendMessage HTTP ${res.status}: ${body.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (e: any) {
      this.logger.warn(`Telegram sendMessage failed: ${e.message}`);
      return false;
    }
  }
}
