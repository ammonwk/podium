import OpenAI from 'openai';
import type {
  LLMClient,
  LLMStreamEvent,
  LLMMessage,
  LLMToolDefinition,
  LLMContentBlock,
} from '@apm/shared';

// ─── Format converters (Anthropic → OpenAI) ────────────────────────────────

function convertMessages(
  system: string,
  messages: LLMMessage[],
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'user', content: msg.content });
      } else {
        // Check for tool_result blocks (sent as user messages in Anthropic format)
        const toolResults = (msg.content as LLMContentBlock[]).filter(
          (b) => b.type === 'tool_result',
        );
        if (toolResults.length > 0) {
          for (const block of toolResults) {
            if (block.type === 'tool_result') {
              result.push({
                role: 'tool',
                tool_call_id: block.tool_use_id,
                content: block.content,
              });
            }
          }
        } else {
          // Extract text from content blocks
          const text = (msg.content as LLMContentBlock[])
            .filter((b) => b.type === 'text')
            .map((b) => (b as { type: 'text'; text: string }).text)
            .join('\n');
          if (text) {
            result.push({ role: 'user', content: text });
          }
        }
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'assistant', content: msg.content });
      } else {
        // Extract text and tool_use blocks, skip thinking blocks
        const blocks = msg.content as LLMContentBlock[];
        const textParts = blocks
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('\n');

        const toolUses = blocks.filter((b) => b.type === 'tool_use');

        if (toolUses.length > 0) {
          result.push({
            role: 'assistant',
            content: textParts || null,
            tool_calls: toolUses.map((b) => {
              const tu = b as {
                type: 'tool_use';
                id: string;
                name: string;
                input: Record<string, unknown>;
              };
              return {
                id: tu.id,
                type: 'function' as const,
                function: {
                  name: tu.name,
                  arguments: JSON.stringify(tu.input),
                },
              };
            }),
          });
        } else if (textParts) {
          result.push({ role: 'assistant', content: textParts });
        }
      }
    }
  }

  return result;
}

function convertTools(
  tools: LLMToolDefinition[],
): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as OpenAI.FunctionParameters,
    },
  }));
}

// ─── Client ─────────────────────────────────────────────────────────────────

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

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      tools: openaiTools,
      stream: true,
    });

    // Track tool calls being assembled from streamed deltas
    const activeToolCalls = new Map<
      number,
      { id: string; name: string; argumentsJson: string }
    >();

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
  }
}
