import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantLlmProvider, LlmMessage, LlmToolDef, LlmStreamResult } from './llm.types';

/**
 * OpenAI implementácia – natívny fetch (žiadny extra balík), streaming SSE + tool-calling.
 * Kľúč: OPENAI_API_KEY; model: OPENAI_MODEL (default gpt-4o-mini = lacný). Kľúč nikdy nehardcodovaný.
 */
@Injectable()
export class OpenAiProvider implements AssistantLlmProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY') ?? '';
    this.model = config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.baseUrl = config.get<string>('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1';
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY nie je nastavený – asistent bude vracať 503.');
    }
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async streamChat(
    messages: LlmMessage[],
    tools: LlmToolDef[],
    onContentDelta: (delta: string) => void,
  ): Promise<LlmStreamResult> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        ...(tools.length
          ? {
              tools: tools.map((t) => ({
                type: 'function',
                function: { name: t.name, description: t.description, parameters: t.parameters },
              })),
              tool_choice: 'auto',
            }
          : {}),
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finishReason: string | null = null;
    // Skladanie tool-call fragmentov podľa indexu.
    const acc = new Map<number, { id: string; name: string; args: string }>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') continue;
        let json: any;
        try { json = JSON.parse(data); } catch { continue; }
        const choice = json.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const delta = choice.delta;
        if (!delta) continue;
        if (typeof delta.content === 'string' && delta.content.length) {
          onContentDelta(delta.content);
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = acc.get(idx) ?? { id: '', name: '', args: '' };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name += tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            acc.set(idx, cur);
          }
        }
      }
    }

    const toolCalls = [...acc.values()]
      .filter((a) => a.name)
      .map((a) => ({ id: a.id, name: a.name, arguments: a.args || '{}' }));
    return { toolCalls, finishReason };
  }
}
