import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AssistantLlmProvider, LlmMessage, LlmToolDef, LlmStreamResult } from './llm.types';

/**
 * Anthropic (Claude) implementácia AssistantLlmProvider – rovnaké rozhranie ako OpenAI provider.
 * Agent-loop, nástroje aj SSE formát (status/delta/attachment/done/error) ostávajú nezmenené;
 * tento provider len prekladá OpenAI-tvar správ na Anthropic Messages API a späť.
 *
 * Kľúč: ANTHROPIC_API_KEY; model: ASSISTANT_MODEL (default Haiku 4.5 – rýchly/lacný pre tool-use).
 */
@Injectable()
export class AnthropicProvider implements AssistantLlmProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly client: Anthropic | null;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ANTHROPIC_API_KEY') ?? '';
    this.model = config.get<string>('ASSISTANT_MODEL') ?? 'claude-haiku-4-5-20251001';
    this.maxTokens = Number(config.get<string>('ASSISTANT_MAX_TOKENS') ?? '1024') || 1024;
    this.client = this.apiKey ? new Anthropic({ apiKey: this.apiKey }) : null;
    if (!this.apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY nie je nastavený – asistent bude vracať 503.');
    }
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Prevedie OpenAI-tvar správ (system/user/assistant/tool + tool_calls/tool_call_id) na
   * Anthropic tvar: system je samostatný param, tool výsledky idú ako user/tool_result bloky.
   * Susedné rovnaké role sa zlúčia (Anthropic vyžaduje striedanie user/assistant a všetky
   * tool_result pre jeden assistant-turn v jednej user správe).
   */
  private convert(messages: LlmMessage[]): { system: string; msgs: Anthropic.MessageParam[] } {
    const systemParts: string[] = [];
    const raw: Anthropic.MessageParam[] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        if (m.content) systemParts.push(m.content);
        continue;
      }
      if (m.role === 'tool') {
        raw.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.tool_call_id ?? '', content: m.content ?? '' }],
        });
        continue;
      }
      if (m.role === 'assistant') {
        const blocks: Anthropic.ContentBlockParam[] = [];
        if (m.content) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.tool_calls ?? []) {
          let input: unknown = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch { input = {}; }
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
        }
        if (blocks.length) raw.push({ role: 'assistant', content: blocks });
        continue;
      }
      // user
      raw.push({ role: 'user', content: [{ type: 'text', text: m.content ?? '' }] });
    }

    // Zlúč susedné správy s rovnakou rolou (concat content blokov).
    const msgs: Anthropic.MessageParam[] = [];
    for (const cur of raw) {
      const prev = msgs[msgs.length - 1];
      if (prev && prev.role === cur.role) {
        const a = Array.isArray(prev.content) ? prev.content : [{ type: 'text', text: prev.content } as Anthropic.ContentBlockParam];
        const b = Array.isArray(cur.content) ? cur.content : [{ type: 'text', text: cur.content } as Anthropic.ContentBlockParam];
        prev.content = [...a, ...b];
      } else {
        msgs.push(cur);
      }
    }
    return { system: systemParts.join('\n\n'), msgs };
  }

  async streamChat(
    messages: LlmMessage[],
    tools: LlmToolDef[],
    onContentDelta: (delta: string) => void,
  ): Promise<LlmStreamResult> {
    if (!this.client) throw new Error('Anthropic client not configured');
    const { system, msgs } = this.convert(messages);

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      ...(system ? { system } : {}),
      messages: msgs,
      ...(tools.length
        ? {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters as Anthropic.Tool.InputSchema,
            })),
          }
        : {}),
    });

    // Skladanie tool_use blokov podľa indexu; text delty rovno klientovi.
    const acc = new Map<number, { id: string; name: string; args: string }>();
    let finishReason: string | null = null;

    for await (const event of stream as AsyncIterable<any>) {
      if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        acc.set(event.index, { id: event.content_block.id, name: event.content_block.name, args: '' });
      } else if (event.type === 'content_block_delta') {
        const d = event.delta;
        if (d?.type === 'text_delta' && d.text) {
          onContentDelta(d.text);
        } else if (d?.type === 'input_json_delta' && typeof d.partial_json === 'string') {
          const cur = acc.get(event.index);
          if (cur) cur.args += d.partial_json;
        }
      } else if (event.type === 'message_delta') {
        finishReason = event.delta?.stop_reason ?? finishReason;
      }
    }

    const toolCalls = [...acc.values()]
      .filter((a) => a.name)
      .map((a) => ({ id: a.id, name: a.name, arguments: a.args || '{}' }));
    return { toolCalls, finishReason };
  }
}
