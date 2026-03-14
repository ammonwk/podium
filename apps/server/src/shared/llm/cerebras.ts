import OpenAI from 'openai';
import type {
  LLMClient,
  LLMStreamEvent,
  LLMMessage,
  LLMToolDefinition,
} from '@apm/shared';
import { convertMessages, convertTools } from './openai-format.js';

export class CerebrasClient implements LLMClient {
  private client: OpenAI;
  public readonly provider = 'cerebras';
  public readonly model: string;

  constructor(model: string) {
    this.model = model;
    this.client = new OpenAI({
      baseURL: 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY,
    });
  }

  async *stream(
    system: string,
    messages: LLMMessage[],
    tools: LLMToolDefinition[],
  ): AsyncIterable<LLMStreamEvent> {
    const openaiMessages = convertMessages(system, messages);
    const openaiTools = convertTools(tools);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: openaiMessages,
        tools: openaiTools,
        stream: true,
      },
      { signal: controller.signal },
    );

    // Track tool calls being assembled from streamed deltas
    const activeToolCalls = new Map<
      number,
      { id: string; name: string; argumentsJson: string }
    >();

    try {
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;

        if (delta?.content) {
          yield { type: 'text', text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              // New tool call starting
              activeToolCalls.set(tc.index, {
                id: tc.id,
                name: tc.function?.name || '',
                argumentsJson: tc.function?.arguments || '',
              });
              yield {
                type: 'tool_use_start',
                tool_call: {
                  id: tc.id,
                  name: tc.function?.name || '',
                  input: {},
                },
              };
            } else {
              // Continuing existing tool call — append arguments
              const existing = activeToolCalls.get(tc.index);
              if (existing && tc.function?.arguments) {
                existing.argumentsJson += tc.function.arguments;
              }
            }
          }
        }

        if (choice.finish_reason) {
          // Emit all completed tool calls
          for (const [, tc] of activeToolCalls) {
            let input: Record<string, unknown> = {};
            try {
              input = tc.argumentsJson ? JSON.parse(tc.argumentsJson) : {};
            } catch {
              console.error(
                `[CEREBRAS] Failed to parse tool arguments: ${tc.argumentsJson}`,
              );
            }
            yield {
              type: 'tool_use_done',
              tool_call: { id: tc.id, name: tc.name, input },
            };
          }
          activeToolCalls.clear();

          yield {
            type: 'done',
            stop_reason:
              choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
          };
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
