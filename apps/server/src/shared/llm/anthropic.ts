import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMStreamEvent, LLMMessage, LLMToolDefinition } from '@apm/shared';

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  public readonly provider = 'anthropic';
  public readonly model: string;

  constructor(model: string) {
    this.model = model;
    this.client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  }

  async *stream(
    system: string,
    messages: LLMMessage[],
    tools: LLMToolDefinition[],
  ): AsyncIterable<LLMStreamEvent> {
    // Track tool_use blocks being built
    const activeToolCalls = new Map<
      number,
      { id: string; name: string; inputJson: string }
    >();

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8192,
      system,
      messages: messages as Anthropic.MessageParam[],
      tools: tools as Anthropic.Tool[],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block;
        if (block.type === 'tool_use') {
          activeToolCalls.set(event.index, {
            id: block.id,
            name: block.name,
            inputJson: '',
          });
          yield {
            type: 'tool_use_start',
            tool_call: { id: block.id, name: block.name, input: {} },
          };
        }
      } else if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
          yield { type: 'text', text: delta.text };
        } else if (delta.type === 'input_json_delta') {
          const tc = activeToolCalls.get(event.index);
          if (tc) {
            tc.inputJson += delta.partial_json;
          }
        }
      } else if (event.type === 'content_block_stop') {
        const tc = activeToolCalls.get(event.index);
        if (tc) {
          let input: Record<string, unknown> = {};
          try {
            input = tc.inputJson ? JSON.parse(tc.inputJson) : {};
          } catch {
            console.error(
              `[ANTHROPIC] Failed to parse tool input JSON: ${tc.inputJson}`,
            );
          }
          yield {
            type: 'tool_use_done',
            tool_call: { id: tc.id, name: tc.name, input },
          };
          activeToolCalls.delete(event.index);
        }
      } else if (event.type === 'message_stop') {
        // We need the stop_reason from message_delta, not message_stop
      } else if (event.type === 'message_delta') {
        const md = event.delta as { stop_reason?: string };
        if (md.stop_reason) {
          yield { type: 'done', stop_reason: md.stop_reason };
        }
      }
    }
  }
}
