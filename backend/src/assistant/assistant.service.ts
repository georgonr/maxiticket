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

const SYSTEM_PROMPT = `Si zákaznícky asistent platformy TicketAll (predaj vstupeniek na podujatia).
Pomáhaš PRIHLÁSENÉMU zákazníkovi s jeho VLASTNÝMI objednávkami a vstupenkami a so všeobecnými otázkami o fungovaní (nákup, doručenie lístkov e-mailom, QR kód pri vstupe, vrátenie peňazí/refund, skenovanie na vstupe).

Pravidlá:
- Údaje o objednávkach a vstupenkách získavaj VÝHRADNE cez nástroje. NIKDY si nevymýšľaj čísla objednávok, sumy, e-maily, stavy ani počty.
- Pracuješ len s objednávkami prihláseného používateľa – nástroje to automaticky zabezpečujú. Nikdy nežiadaj cudzie objednávky ani identitu iného používateľa.
- Keď chce zákazník znova poslať lístky, použi resendTicketEmail – odošle sa LEN na e-mail z jeho objednávky.
- Na QR kód použi getTicketQR, na PDF getTicketPdfLink – po ich priložení stručne napíš, že QR/PDF je v chate.
- Otázky mimo témy (predaj vstupeniek a jeho objednávky) slušne odmietni a nasmeruj späť k téme.
- Odpovedaj stručne a priateľsky, v jazyku používateľa (default slovenčina).`;

const STATUS_LABELS: Record<string, string> = {
  findMyOrders: 'Hľadám vaše objednávky…',
  getOrderDetail: 'Načítavam objednávku…',
  resendTicketEmail: 'Posielam vstupenky e-mailom…',
  getTicketQR: 'Pripravujem QR kód…',
  getTicketPdfLink: 'Pripravujem PDF…',
};

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
  async runChat(userId: string, history: ChatHistoryMsg[], emit: (e: AssistantEvent) => void): Promise<void> {
    if (!this.llm.isConfigured()) {
      emit({ type: 'error', message: 'Asistent momentálne nie je dostupný (chýba konfigurácia OPENAI_API_KEY).' });
      emit({ type: 'done' });
      return;
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
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
          emit({ type: 'status', text: STATUS_LABELS[tc.name] ?? 'Pracujem…' });
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.arguments || '{}'); } catch { /* ignore */ }
          const res = await this.tools.dispatch(tc.name, args, userId);
          if (res.attachments) for (const a of res.attachments) emit({ type: 'attachment', attachment: a });
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(res.summary) });
        }
      }
      // poistka proti slučke
      emit({ type: 'delta', text: '\n\nSkúste prosím otázku spresniť.' });
      emit({ type: 'done' });
    } catch (e: any) {
      this.logger.error(`Assistant chat failed: ${e.message}`);
      emit({ type: 'error', message: 'Asistent narazil na chybu. Skúste to znova.' });
      emit({ type: 'done' });
    }
  }
}
