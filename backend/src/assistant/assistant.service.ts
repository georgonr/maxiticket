import { Inject, Injectable, Logger } from '@nestjs/common';
import { ASSISTANT_LLM, AssistantLlmProvider, LlmMessage } from './llm/llm.types';
import { AssistantToolsService } from './assistant-tools.service';

export type ChatHistoryMsg = { role: 'user' | 'assistant'; content: string };
export type AssistantEvent =
  | { type: 'status'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'attachment'; attachment: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; message: string };

const MAX_TOOL_ITERATIONS = 5;

export type AssistantLocale = 'sk' | 'en' | 'cs';

// Doľaďovák 2: jazyková direktíva pripojená na koniec promptu (má prednosť pred
// SK znením promptu) → asistent odpovedá v jazyku stránky /sk /en /cs.
const LANG_DIRECTIVE: Record<AssistantLocale, string> = {
  sk: 'DÔLEŽITÉ: Odpovedaj VÝHRADNE v slovenčine.',
  en: 'IMPORTANT: Reply EXCLUSIVELY in English, regardless of the language of this prompt.',
  cs: 'DŮLEŽITÉ: Odpovídej VÝHRADNĚ v češtině, bez ohledu na jazyk tohoto promptu.',
};

const SYSTEM_PROMPT = `Si zákaznícky asistent platformy TicketAll (predaj vstupeniek na podujatia).
Pomáhaš PRIHLÁSENÉMU zákazníkovi s jeho VLASTNÝMI objednávkami a vstupenkami a so všeobecnými otázkami o fungovaní (nákup, doručenie lístkov e-mailom, QR kód pri vstupe, vrátenie peňazí/refund, skenovanie na vstupe).

Pravidlá:
- Údaje o objednávkach a vstupenkách získavaj VÝHRADNE cez nástroje. NIKDY si nevymýšľaj čísla objednávok, sumy, e-maily, stavy ani počty.
- Pracuješ len s objednávkami prihláseného používateľa – nástroje to automaticky zabezpečujú. Nikdy nežiadaj cudzie objednávky ani identitu iného používateľa.
- Keď chce zákazník znova poslať lístky, použi resendTicketEmail – odošle sa LEN na e-mail z jeho objednávky.
- Na QR kód použi getTicketQR, na PDF getTicketPdfLink – po ich priložení stručne napíš, že QR/PDF je v chate.
- Otázky mimo témy (predaj vstupeniek a jeho objednávky) slušne odmietni a nasmeruj späť k téme.
- Odpovedaj stručne a priateľsky, v jazyku používateľa (default slovenčina).`;

// Status hlášky (SSE) sú verejne viditeľné v chate → lokalizované per jazyk.
const STATUS_LABELS: Record<AssistantLocale, Record<string, string>> = {
  sk: {
    findMyOrders: 'Hľadám vaše objednávky…',
    getOrderDetail: 'Načítavam objednávku…',
    resendTicketEmail: 'Posielam vstupenky e-mailom…',
    getTicketQR: 'Pripravujem QR kód…',
    getTicketPdfLink: 'Pripravujem PDF…',
  },
  en: {
    findMyOrders: 'Looking up your orders…',
    getOrderDetail: 'Loading the order…',
    resendTicketEmail: 'Sending tickets by e-mail…',
    getTicketQR: 'Preparing the QR code…',
    getTicketPdfLink: 'Preparing the PDF…',
  },
  cs: {
    findMyOrders: 'Hledám vaše objednávky…',
    getOrderDetail: 'Načítám objednávku…',
    resendTicketEmail: 'Posílám vstupenky e-mailem…',
    getTicketQR: 'Připravuji QR kód…',
    getTicketPdfLink: 'Připravuji PDF…',
  },
};

const MSG_WORKING: Record<AssistantLocale, string> = { sk: 'Pracujem…', en: 'Working…', cs: 'Pracuji…' };
const MSG_NOT_CONFIGURED: Record<AssistantLocale, string> = {
  sk: 'Asistent momentálne nie je dostupný (chýba konfigurácia OPENAI_API_KEY).',
  en: 'The assistant is currently unavailable (OPENAI_API_KEY is not configured).',
  cs: 'Asistent momentálně není dostupný (chybí konfigurace OPENAI_API_KEY).',
};
const MSG_REFINE: Record<AssistantLocale, string> = {
  sk: '\n\nSkúste prosím otázku spresniť.',
  en: '\n\nPlease try to refine your question.',
  cs: '\n\nZkuste prosím otázku upřesnit.',
};
const MSG_ERROR: Record<AssistantLocale, string> = {
  sk: 'Asistent narazil na chybu. Skúste to znova.',
  en: 'The assistant ran into an error. Please try again.',
  cs: 'Asistent narazil na chybu. Zkuste to znovu.',
};
// Export pre controller fallback (chyby mimo runChat).
export const assistantErrorMessage = (locale: AssistantLocale = 'sk'): string => MSG_ERROR[locale];

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @Inject(ASSISTANT_LLM) private readonly llm: AssistantLlmProvider,
    private readonly tools: AssistantToolsService,
  ) {}

  isConfigured(): boolean {
    return this.llm.isConfigured();
  }

  /** Agent loop. userId zo session – nikdy z LLM. Emituje status/delta/attachment/done/error. */
  async runChat(
    userId: string,
    history: ChatHistoryMsg[],
    emit: (e: AssistantEvent) => void,
    locale: AssistantLocale = 'sk',
  ): Promise<void> {
    if (!this.llm.isConfigured()) {
      emit({ type: 'error', message: MSG_NOT_CONFIGURED[locale] });
      emit({ type: 'done' });
      return;
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${LANG_DIRECTIVE[locale]}` },
      ...history.map((h) => ({ role: h.role, content: h.content })),
    ];
    const toolDefs = this.tools.toolDefs();

    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const result = await this.llm.streamChat(messages, toolDefs, (d) => emit({ type: 'delta', text: d }));

        if (result.toolCalls.length === 0) {
          emit({ type: 'done' });
          return;
        }

        // zapíš asistentov tool-call turn
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        // vykonaj nástroje (scoped na userId) + priklad attachments
        for (const tc of result.toolCalls) {
          emit({ type: 'status', text: STATUS_LABELS[locale][tc.name] ?? MSG_WORKING[locale] });
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.arguments || '{}'); } catch { /* ignore */ }
          const res = await this.tools.dispatch(tc.name, args, userId);
          if (res.attachments) for (const a of res.attachments) emit({ type: 'attachment', attachment: a });
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(res.summary) });
        }
      }
      // poistka proti slučke
      emit({ type: 'delta', text: MSG_REFINE[locale] });
      emit({ type: 'done' });
    } catch (e: any) {
      this.logger.error(`Assistant chat failed: ${e.message}`);
      emit({ type: 'error', message: MSG_ERROR[locale] });
      emit({ type: 'done' });
    }
  }
}
