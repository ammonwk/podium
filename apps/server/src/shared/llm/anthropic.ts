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

    // Track thinking blocks being built (text + signature)
    const activeThinkingBlocks = new Map<
      number,
      { thinking: string; signature: string }
    >();

    const params: any = {
      model: this.model,
      max_tokens: 16000,
      system,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: messages as Anthropic.MessageParam[],
    };
    if (tools.length > 0) {
      params.tools = tools as Anthropic.Tool[];
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const stream = this.client.messages.stream(params, {
      signal: controller.signal,
    });

    try {
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block as any;
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
          } else if (block.type === 'thinking') {
            activeThinkingBlocks.set(event.index, { thinking: '', signature: '' });
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta as any;
          if (delta.type === 'text_delta') {
            yield { type: 'text', text: delta.text };
          } else if (delta.type === 'thinking_delta') {
            const tb = activeThinkingBlocks.get(event.index);
            if (tb) {
              tb.thinking += delta.thinking;
            }
            // Stream thinking text for live display
            yield { type: 'thinking_delta', text: delta.thinking };
          } else if (delta.type === 'signature_delta') {
            const tb = activeThinkingBlocks.get(event.index);
            if (tb) {
              tb.signature += delta.signature;
            }
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
          const tb = activeThinkingBlocks.get(event.index);
          if (tb) {
            yield {
              type: 'thinking_done',
              thinking_block: { thinking: tb.thinking, signature: tb.signature },
            };
            activeThinkingBlocks.delete(event.index);
          }
        } else if (event.type === 'message_delta') {
          const md = event.delta as { stop_reason?: string };
          if (md.stop_reason) {
            yield { type: 'done', stop_reason: md.stop_reason };
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
