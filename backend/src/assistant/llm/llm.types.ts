// Krok 28: provider-agnostická abstrakcia pre chat asistenta (tool-calling + streaming).

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string (parsovať pri dispatchu)
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface LlmToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LlmStreamResult {
  toolCalls: LlmToolCall[];
  finishReason: string | null;
}

/** Provider-agnostický LLM. Ďalší provider (napr. Claude) sa pridá bez zmeny agent-loop logiky. */
export interface AssistantLlmProvider {
  isConfigured(): boolean;
  /**
   * Streamuje jednu odpoveď modelu. Textové delty idú cez onContentDelta (rovno klientovi).
   * Tool-call fragmenty sa skladajú a vrátia v výsledku (agent loop ich vykoná).
   */
  streamChat(
    messages: LlmMessage[],
    tools: LlmToolDef[],
    onContentDelta: (delta: string) => void,
  ): Promise<LlmStreamResult>;
}

export const ASSISTANT_LLM = Symbol('AssistantLlmProvider');
