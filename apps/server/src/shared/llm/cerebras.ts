import type { LLMClient, LLMStreamEvent, LLMMessage, LLMToolDefinition } from '@apm/shared';

export class CerebrasClient implements LLMClient {
  public readonly provider = 'cerebras';
  public readonly model: string;

  constructor(model: string) {
    this.model = model;
  }

  async *stream(
    _system: string,
    _messages: LLMMessage[],
    _tools: LLMToolDefinition[],
  ): AsyncIterable<LLMStreamEvent> {
    yield {
      type: 'text',
      text: 'Cerebras provider is not configured. Switch to Anthropic.',
    };
    yield { type: 'done', stop_reason: 'end_turn' };
  }
}
