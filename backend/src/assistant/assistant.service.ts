import { Inject, Injectable, Logger } from '@nestjs/common';
import { ASSISTANT_LLM, AssistantLlmProvider, LlmMessage } from './llm/llm.types';
import { AssistantToolsService } from './assistant-tools.service';
import { PrismaService } from '../prisma/prisma.service';

export type ChatHistoryMsg = { role: 'user' | 'assistant'; content: string };

// Identita konverzácie pre perzistenciu (krok AI-KONV-1). Guest keyovaný chatSessionId, customer userId.
type ConversationCtx = {
  channel: 'GUEST' | 'CUSTOMER';
  sessionKey: string;
  userId: string | null;
  locale: AssistantLocale;
};
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

// Zdieľaný knowledge blok o fungovaní platformy (guest aj prihlásený). Fakty z FAQ + reálnej
// logiky; nesľubuje viac. Aktuálne podujatia sa ZÁMERNE neuvádzajú (menia sa) – rieši getPublicEvents.
const KNOWLEDGE = `O fungovaní TicketAll:
- Registrácia: zákazník sa zaregistruje e-mailom a heslom (na webe cez „Registrácia"). Organizátori majú vlastnú registráciu (admin.ticketall.eu).
- Prihlásenie: cez „Prihlásiť sa" (stránka účtu).
- Nákup lístka: vyber podujatie → termín → typ lístka a množstvo → košík → pokladňa (checkout) → platba.
- Platba: online cez Stripe, šifrovane; čísla platobných kariet sa neukladajú.
- Doručenie lístka: po zaplatení prídu vstupenky e-mailom ako QR kód (aj PDF). Pri vstupe sa QR naskenuje.
- Refund (vrátenie peňazí): LEN keď organizátor zruší podujatie. Spracuje sa manuálne v priebehu niekoľkých dní (nie okamžite), informujeme e-mailom; z vrátenej sumy sa môže odpočítať malý poplatok (~0,40 € za lístok). Vrátenie pri zmene názoru sa riadi pravidlami konkrétneho organizátora.
- Skenovanie: na vstupe sa QR z lístka naskenuje; každý lístok platí na jeden vstup.
- Organizátor vs zákazník: zákazník nakupuje lístky; organizátor predáva a spravuje podujatia.
- Aktuálne podujatia zisti VŽDY cez nástroj getPublicEvents (naživo z ponuky) – NIKDY ich neuvádzaj z pamäte.`;

const SYSTEM_PROMPT = `Si zákaznícky asistent platformy TicketAll (predaj vstupeniek na podujatia). Hovoríš s PRIHLÁSENÝM zákazníkom.
Pomáhaš s jeho VLASTNÝMI objednávkami a vstupenkami, so všeobecnými otázkami o fungovaní a vieš ukázať aktuálne podujatia.

Pravidlá:
- Údaje o objednávkach a vstupenkách získavaj VÝHRADNE cez nástroje (findMyOrders, getOrderDetail, resendTicketEmail, getTicketQR, getTicketPdfLink). NIKDY si nevymýšľaj čísla objednávok, sumy, e-maily ani stavy.
- Pracuješ LEN s objednávkami prihláseného používateľa – nástroje to zabezpečujú. Nikdy nežiadaj ani nepracuj s cudzou objednávkou.
- Stratený lístok: resendTicketEmail znova pošle vstupenky LEN na e-mail z jeho objednávky. Ak má viac objednávok, spýtaj sa ktorú (len jeho).
- Aktuálne podujatia: zavolaj getPublicEvents.
- Odpovedaj stručne a priateľsky, v jazyku používateľa (default slovenčina).

${KNOWLEDGE}`;

// Guest (neprihlásený) = INFOBOT o fungovaní + aktuálne verejné podujatia. ŽIADNY prístup k osobným dátam.
const GUEST_SYSTEM_PROMPT = `Si zákaznícky asistent platformy TicketAll (predaj vstupeniek). Hovoríš s NEPRIHLÁSENÝM návštevníkom.
Pomáhaš s VŠEOBECNÝMI otázkami o fungovaní platformy (registrácia, prihlásenie, nákup, platba, doručenie lístka, refund, skenovanie) a vieš ukázať AKTUÁLNE zverejnené podujatia.

Pravidlá:
- NEMÁŠ prístup k osobným údajom – žiadne objednávky, lístky ani ich stavy. Nikdy sa nepokúšaj overovať totožnosť ani pracovať s konkrétnou objednávkou.
- Keď sa návštevník pýta na SVOJ lístok/objednávku (napr. stratený lístok, poslať znova, stav objednávky): NAVEĎ ho prihlásiť sa – „Pre prácu s tvojimi lístkami sa prosím prihlás na svojom účte, potom ti pomôžem poslať vstupenku znova." Nič osobné nerieš.
- Na otázku o aktuálnych podujatiach/akciách zavolaj getPublicEvents a odpovedz reálnymi dátami (zobrazujú sa len zverejnené podujatia).
- Odpovedaj stručne a priateľsky, v jazyku používateľa (default slovenčina).

${KNOWLEDGE}`;

// Status hlášky (SSE) sú verejne viditeľné v chate → lokalizované per jazyk (prihlásený aj guest nástroje).
const STATUS_LABELS: Record<AssistantLocale, Record<string, string>> = {
  sk: {
    findMyOrders: 'Hľadám vaše objednávky…',
    getOrderDetail: 'Načítavam objednávku…',
    resendTicketEmail: 'Posielam vstupenky e-mailom…',
    getTicketQR: 'Pripravujem QR kód…',
    getTicketPdfLink: 'Pripravujem PDF…',
    getPublicEvents: 'Hľadám aktuálne podujatia…',
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
    getPublicEvents: 'Looking up current events…',
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
    getPublicEvents: 'Hledám aktuální akce…',
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
    private readonly prisma: PrismaService,
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
      conversation: { channel: 'CUSTOMER', sessionKey: userId, userId, locale },
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
      conversation: { channel: 'GUEST', sessionKey: chatSessionId, userId: null, locale },
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
    conversation?: ConversationCtx;
  }): Promise<void> {
    const { systemPrompt, history, toolDefs, dispatch, emit, locale, conversation } = params;
    if (!this.llm.isConfigured()) {
      emit({ type: 'error', message: MSG_NOT_CONFIGURED[locale] });
      emit({ type: 'done' });
      return;
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: `${systemPrompt}\n\n${LANG_DIRECTIVE[locale]}` },
      ...history.map((h) => ({ role: h.role, content: h.content })),
    ];

    // Akumuluj plný text asistenta naprieč iteráciami → 1 zápis po dokončení streamu.
    let assistantText = '';

    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const result = await this.llm.streamChat(messages, toolDefs, (d) => { assistantText += d; emit({ type: 'delta', text: d }); });

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
      assistantText += MSG_REFINE[locale];
      emit({ type: 'delta', text: MSG_REFINE[locale] });
      emit({ type: 'done' });
    } catch (e: any) {
      this.logger.error(`Assistant chat failed: ${e.message}`);
      emit({ type: 'error', message: MSG_ERROR[locale] });
      emit({ type: 'done' });
    } finally {
      // Best-effort perzistencia – zlyhanie DB nesmie ovplyvniť už odoslaný SSE stream.
      if (conversation) {
        const lastUser = history[history.length - 1];
        const userText = lastUser?.role === 'user' ? lastUser.content : '';
        await this.persistExchange(conversation, userText, assistantText.trim());
      }
    }
  }

  /**
   * Uloží jednu výmenu (user + assistant) do DB. Konverzácia sa priradí podľa sessionKey
   * (guest=chatSessionId, customer=userId) – existujúca OPEN sa reuse-ne, inak sa vytvorí nová.
   * Best-effort: chyby sa len zalogujú.
   */
  private async persistExchange(conv: ConversationCtx, userText: string, assistantText: string): Promise<void> {
    try {
      const now = new Date();
      const existing = await this.prisma.conversation.findFirst({
        where: { sessionKey: conv.sessionKey, status: 'OPEN' },
        orderBy: { lastMessageAt: 'desc' },
        select: { id: true },
      });
      let conversationId: string;
      if (existing) {
        conversationId = existing.id;
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
      } else {
        const created = await this.prisma.conversation.create({
          data: {
            channel: conv.channel,
            sessionKey: conv.sessionKey,
            userId: conv.userId,
            locale: conv.locale,
            lastMessageAt: now,
          },
          select: { id: true },
        });
        conversationId = created.id;
      }
      const data: { conversationId: string; role: string; content: string }[] = [];
      if (userText) data.push({ conversationId, role: 'user', content: userText });
      if (assistantText) data.push({ conversationId, role: 'assistant', content: assistantText });
      if (data.length) await this.prisma.message.createMany({ data });
    } catch (e: any) {
      this.logger.warn(`persistExchange failed: ${e.message}`);
    }
  }
}
