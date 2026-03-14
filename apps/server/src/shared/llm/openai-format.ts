import type OpenAI from 'openai';
import type {
  LLMMessage,
  LLMToolDefinition,
  LLMContentBlock,
} from '@apm/shared';

// ─── Format converters (Anthropic → OpenAI-compatible) ──────────────────────

export function convertMessages(
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

export function convertTools(
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
