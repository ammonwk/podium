import OpenAI from 'openai';
import type {
  LLMClient,
  LLMStreamEvent,
  LLMMessage,
  LLMToolDefinition,
} from '@apm/shared';
import { convertMessages, convertTools } from './openai-format.js';

export class OpenRouterClient implements LLMClient {
  private client: OpenAI;
  public readonly provider = 'openrouter';
  public readonly model: string;
  private providerOrder?: string[];

  constructor(model: string, providerOrder?: string[]) {
    this.model = model;
    this.providerOrder = providerOrder;
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  async *stream(
    system: string,
    messages: LLMMessage[],
    tools: LLMToolDefinition[],
  ): AsyncIterable<LLMStreamEvent> {
    const openaiMessages = convertMessages(system, messages);
    const openaiTools = convertTools(tools);

    const params: OpenAI.ChatCompletionCreateParamsStreaming = {
      model: this.model,
      messages: openaiMessages,
      stream: true,
      ...(openaiTools.length > 0 ? { tools: openaiTools } : {}),
    };
    // OpenRouter-specific: route through a preferred provider
    if (this.providerOrder) {
      (params as unknown as Record<string, unknown>).provider = {
        order: this.providerOrder,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const stream = await this.client.chat.completions.create(params, {
      signal: controller.signal,
    });

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
              const existing = activeToolCalls.get(tc.index);
              if (existing && tc.function?.arguments) {
                existing.argumentsJson += tc.function.arguments;
              }
            }
          }
        }

        if (choice.finish_reason) {
          for (const [, tc] of activeToolCalls) {
            let input: Record<string, unknown> = {};
            try {
              input = tc.argumentsJson ? JSON.parse(tc.argumentsJson) : {};
            } catch {
              console.error(
                `[OPENROUTER] Failed to parse tool arguments: ${tc.argumentsJson}`,
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
