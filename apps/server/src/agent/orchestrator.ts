import type { LLMMessage, LLMContentBlock } from '@apm/shared';
import { getActiveClient } from '../shared/llm/client.js';
import { executeTool } from '../tools/executor.js';
import type { LoopContext } from './types.js';

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export async function runLoop(
  conversationHistory: LLMMessage[],
  context: LoopContext,
): Promise<void> {
  const client = getActiveClient();
  const allowedToolNames = new Set(context.tools.map((t) => t.name));

  console.log(
    `[${context.label}] Starting loop for "${context.eventName}" using ${client.provider}/${client.model}`,
  );

  context.emitter.onStart(context.eventName, context.label);

  let iteration = 0;

  while (iteration < context.maxIterations) {
    iteration++;
    console.log(`[${context.label}] Iteration ${iteration}/${context.maxIterations}`);

    const assistantBlocks: LLMContentBlock[] = [];
    const pendingToolCalls: ToolCall[] = [];
    let fullText = '';

    try {
      const stream = client.stream(context.systemPrompt, conversationHistory, context.tools);

      for await (const event of stream) {
        switch (event.type) {
          case 'thinking_delta': {
            const thinkingText = event.text || '';
            context.emitter.onThinkingDelta(thinkingText);
            break;
          }
          case 'thinking_done': {
            if (event.thinking_block) {
              assistantBlocks.push({
                type: 'thinking',
                thinking: event.thinking_block.thinking,
                signature: event.thinking_block.signature,
              });
            }
            break;
          }
          case 'text': {
            const text = event.text || '';
            fullText += text;
            context.emitter.onTextDelta(text);
            break;
          }
          case 'tool_use_start': {
            break;
          }
          case 'tool_use_done': {
            if (event.tool_call) {
              pendingToolCalls.push({
                id: event.tool_call.id,
                name: event.tool_call.name,
                input: event.tool_call.input,
              });
            }
            break;
          }
          case 'done': {
            break;
          }
        }
      }
    } catch (err: any) {
      console.error(`[${context.label}] LLM stream error:`, err);
      context.emitter.onError(`LLM error: ${err.message || 'Unknown error'}`);
      break;
    }

    // Build the assistant message content blocks
    if (fullText) {
      assistantBlocks.push({ type: 'text', text: fullText });
    }
    for (const tc of pendingToolCalls) {
      assistantBlocks.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input,
      });
    }

    // If we got nothing at all, something went wrong
    if (assistantBlocks.length === 0) {
      console.warn(`[${context.label}] Empty response from LLM, breaking loop`);
      break;
    }

    // Append the assistant message to conversation history
    conversationHistory.push({
      role: 'assistant',
      content: assistantBlocks,
    });

    // If no tool calls, we're done
    if (pendingToolCalls.length === 0) {
      console.log(`[${context.label}] No tool calls, loop complete`);
      break;
    }

    // Execute tool calls and build tool results
    const toolResultBlocks: LLMContentBlock[] = [];

    for (const tc of pendingToolCalls) {
      console.log(`[${context.label}] Executing tool: ${tc.name}`);
      let result: Record<string, unknown>;
      let isError = false;

      // Guard: reject tools not in the allowed set
      if (!allowedToolNames.has(tc.name)) {
        console.warn(`[${context.label}] Tool "${tc.name}" not allowed in this context`);
        result = { error: `Tool "${tc.name}" is not available in this context.` };
        isError = true;
      } else {
        try {
          result = await executeTool(tc.name, tc.input);
        } catch (err: any) {
          console.error(`[${context.label}:${tc.name}] Error:`, err.message);
          result = { error: err.message };
          isError = true;
        }
      }

      context.emitter.onToolCall(tc.name, tc.input, result, isError);

      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: JSON.stringify(result),
        is_error: isError,
      });
    }

    // Append tool results as a user message (Anthropic API format)
    conversationHistory.push({
      role: 'user',
      content: toolResultBlocks,
    });
  }

  if (iteration >= context.maxIterations) {
    console.warn(
      `[${context.label}] Hit max iterations (${context.maxIterations}) for "${context.eventName}"`,
    );
  }

  context.emitter.onDone();
  console.log(`[${context.label}] Loop complete for "${context.eventName}" (${iteration} iterations)`);
}
