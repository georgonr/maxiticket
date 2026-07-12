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

// Guest (neprihlásený) agent – fáza 2A. VŽDY najprv over totožnosť, pred overením nič neprezraď.
const GUEST_SYSTEM_PROMPT = `Si zákaznícky asistent platformy TicketAll (predaj vstupeniek). Hovoríš s NEPRIHLÁSENÝM zákazníkom.

KRITICKÉ pravidlá overenia:
- PRED akoukoľvek akciou (info o objednávke, preposlanie lístka, QR) MUSÍ prebehnúť overenie totožnosti cez nástroj verifyIdentity.
- Na overenie potrebuješ: posledné 4 čísla platobnej karty A JEDEN identifikátor (e-mail, číslo objednávky MT-…, alebo číslo platby). Slušne si ich vyžiadaj.
- Ty NEROZHODUJEŠ o úspechu overenia – rozhodne to nástroj. Riaď sa jeho výsledkom (verified true/false).
- PRED úspešným overením NIKDY neprezraď žiadne údaje o objednávke a nevolaj iné nástroje než verifyIdentity.
- Ak zákazník chce lístok na INÝ e-mail (nie pôvodný z objednávky): NEPOSIELAJ ho – použi escalateToAdmin (odovzdá to ľudskej podpore).
- Ak výsledok overenia je NEEDS_ESCALATION (nedá sa overiť kartou) alebo je problém, ponúkni escalateToAdmin.

Po úspešnom overení:
- getOrderInfo = detail objednávky, resendTicketToOriginalEmail = pošle lístky LEN na pôvodný e-mail, getTicketQR = QR do chatu.
- Údaje získavaj VÝHRADNE cez nástroje, nikdy si nič nevymýšľaj.
- Odpovedaj stručne a priateľsky, v jazyku používateľa.`;

// Status hlášky (SSE) sú verejne viditeľné v chate → lokalizované per jazyk (prihlásený aj guest nástroje).
const STATUS_LABELS: Record<AssistantLocale, Record<string, string>> = {
  sk: {
    findMyOrders: 'Hľadám vaše objednávky…',
    getOrderDetail: 'Načítavam objednávku…',
    resendTicketEmail: 'Posielam vstupenky e-mailom…',
    getTicketQR: 'Pripravujem QR kód…',
    getTicketPdfLink: 'Pripravujem PDF…',
    verifyIdentity: 'Overujem totožnosť…',
    getOrderInfo: 'Načítavam objednávku…',
    resendTicketToOriginalEmail: 'Posielam vstupenky e-mailom…',
    escalateToAdmin: 'Odovzdávam podpore…',
  },
  en: {
    findMyOrders: 'Looking up your orders…',
    getOrderDetail: 'Loading the order…',
    resendTicketEmail: 'Sending tickets by e-mail…',
    getTicketQR: 'Preparing the QR code…',
    getTicketPdfLink: 'Preparing the PDF…',
    verifyIdentity: 'Verifying identity…',
    getOrderInfo: 'Loading the order…',
    resendTicketToOriginalEmail: 'Sending tickets by e-mail…',
    escalateToAdmin: 'Handing over to support…',
  },
  cs: {
    findMyOrders: 'Hledám vaše objednávky…',
    getOrderDetail: 'Načítám objednávku…',
    resendTicketEmail: 'Posílám vstupenky e-mailem…',
    getTicketQR: 'Připravuji QR kód…',
    getTicketPdfLink: 'Připravuji PDF…',
    verifyIdentity: 'Ověřuji totožnost…',
    getOrderInfo: 'Načítám objednávku…',
    resendTicketToOriginalEmail: 'Posílám vstupenky e-mailem…',
    escalateToAdmin: 'Předávám podpoře…',
  },
};

const MSG_WORKING: Record<AssistantLocale, string> = { sk: 'Pracujem…', en: 'Working…', cs: 'Pracuji…' };
const MSG_NOT_CONFIGURED: Record<AssistantLocale, string> = {
  sk: 'Asistent momentálne nie je dostupný (chýba konfigurácia API kľúča asistenta).',
  en: 'The assistant is currently unavailable (the assistant API key is not configured).',
  cs: 'Asistent momentálně není dostupný (chybí konfigurace API klíče asistenta).',
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

  /** Agent loop pre PRIHLÁSENÉHO zákazníka. userId zo session – nikdy z LLM. */
  async runChat(
    userId: string,
    history: ChatHistoryMsg[],
    emit: (e: AssistantEvent) => void,
    locale: AssistantLocale = 'sk',
  ): Promise<void> {
    return this.runLoop({
      systemPrompt: SYSTEM_PROMPT,
      history,
      toolDefs: this.tools.toolDefs(),
      dispatch: (name, args) => this.tools.dispatch(name, args, userId),
      emit,
      locale,
    });
  }

  /**
   * Agent loop pre GUEST (neprihlásený) zákazník. Scoping cez chatSessionId (server-side Redis).
   * verifiedOrderId sa NIKDY nedostane do LLM kontextu; nástroje si ho čítajú z Redisu sami.
   */
  async runGuestChat(
    chatSessionId: string,
    history: ChatHistoryMsg[],
    emit: (e: AssistantEvent) => void,
    locale: AssistantLocale = 'sk',
  ): Promise<void> {
    return this.runLoop({
      systemPrompt: GUEST_SYSTEM_PROMPT,
      history,
      toolDefs: this.tools.guestToolDefs(),
      dispatch: (name, args) => this.tools.dispatchGuest(name, args, chatSessionId),
      emit,
      locale,
    });
  }

  /** Zdieľané jadro agent-loopu – líši sa len systémový prompt, tool defs a dispatch. */
  private async runLoop(params: {
    systemPrompt: string;
    history: ChatHistoryMsg[];
    toolDefs: ReturnType<AssistantToolsService['toolDefs']>;
    dispatch: (name: string, args: Record<string, any>) => Promise<{ summary: unknown; attachments?: Record<string, unknown>[] }>;
    emit: (e: AssistantEvent) => void;
    locale: AssistantLocale;
  }): Promise<void> {
    const { systemPrompt, history, toolDefs, dispatch, emit, locale } = params;
    if (!this.llm.isConfigured()) {
      emit({ type: 'error', message: MSG_NOT_CONFIGURED[locale] });
      emit({ type: 'done' });
      return;
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: `${systemPrompt}\n\n${LANG_DIRECTIVE[locale]}` },
      ...history.map((h) => ({ role: h.role, content: h.content })),
    ];

    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const result = await this.llm.streamChat(messages, toolDefs, (d) => emit({ type: 'delta', text: d }));

        if (result.toolCalls.length === 0) {
          emit({ type: 'done' });
          return;
        }

        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: result.toolCalls.map((tc) => ({
            id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        for (const tc of result.toolCalls) {
          emit({ type: 'status', text: STATUS_LABELS[locale][tc.name] ?? MSG_WORKING[locale] });
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.arguments || '{}'); } catch { /* ignore */ }
          const res = await dispatch(tc.name, args);
          if (res.attachments) for (const a of res.attachments) emit({ type: 'attachment', attachment: a });
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(res.summary) });
        }
      }
      emit({ type: 'delta', text: MSG_REFINE[locale] });
      emit({ type: 'done' });
    } catch (e: any) {
      this.logger.error(`Assistant chat failed: ${e.message}`);
      emit({ type: 'error', message: MSG_ERROR[locale] });
      emit({ type: 'done' });
    }
  }
}
