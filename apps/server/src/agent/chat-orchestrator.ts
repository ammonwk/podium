import type { LLMMessage, LLMContentBlock, LLMToolDefinition, ChatRole } from '@apm/shared';
import { TOOL_NAMES } from '@apm/shared';
import { getActiveClient } from '../shared/llm/client.js';
import { emitChatSSE } from '../shared/chat-sse.js';
import { buildSystemPrompt } from './system-prompt.js';
import { toolDefinitions } from '../tools/definitions.js';
import { executeCreateBooking } from '../tools/create-booking.js';
import { executeEditBooking } from '../tools/edit-booking.js';

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

const MAX_TOOL_ITERATIONS = 5;

// Subset of tools available to the interested_person chat role
const chatBookingTools: LLMToolDefinition[] = toolDefinitions.filter(
  (t) => t.name === TOOL_NAMES.CREATE_BOOKING || t.name === TOOL_NAMES.EDIT_BOOKING,
);

async function executeChatTool(
  name: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (name) {
    case TOOL_NAMES.CREATE_BOOKING:
      return (await executeCreateBooking(input as any)) as unknown as Record<string, unknown>;
    case TOOL_NAMES.EDIT_BOOKING:
      return (await executeEditBooking(input as any)) as unknown as Record<string, unknown>;
    default:
      throw new Error(`Unknown chat tool: ${name}`);
  }
}

export async function runChatLoop(
  history: LLMMessage[],
  role: ChatRole,
  sessionId: string,
  metadata?: { phoneNumber?: string },
): Promise<void> {
  const client = getActiveClient();
  const system = buildSystemPrompt(role, metadata?.phoneNumber);
  const tools = role === 'interested_person' ? chatBookingTools : [];

  console.log(`[CHAT] Starting chat loop for session ${sessionId} (role: ${role}) using ${client.provider}/${client.model}`);

  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    const assistantBlocks: LLMContentBlock[] = [];
    const pendingToolCalls: ToolCall[] = [];
    let fullText = '';

    try {
      const stream = client.stream(system, history, tools);

      for await (const event of stream) {
        switch (event.type) {
          case 'thinking_delta':
            // Skip thinking for chat — don't surface to user
            break;
          case 'thinking_done':
            if (event.thinking_block) {
              assistantBlocks.push({
                type: 'thinking',
                thinking: event.thinking_block.thinking,
                signature: event.thinking_block.signature,
              });
            }
            break;
          case 'text': {
            const text = event.text || '';
            fullText += text;
            emitChatSSE(sessionId, 'chat_text', { text });
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
          case 'done':
            break;
        }
      }
    } catch (err: any) {
      console.error('[CHAT] LLM stream error:', err);
      emitChatSSE(sessionId, 'chat_text', { text: 'Sorry, something went wrong. Please try again.' });
      break;
    }

    // Build assistant message
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

    if (assistantBlocks.length > 0) {
      history.push({
        role: 'assistant',
        content: assistantBlocks,
      });
    }

    // If no tool calls, we're done
    if (pendingToolCalls.length === 0) {
      break;
    }

    // Execute tool calls
    const toolResultBlocks: LLMContentBlock[] = [];

    for (const tc of pendingToolCalls) {
      console.log(`[CHAT] Executing tool: ${tc.name}`);
      let result: Record<string, unknown>;
      let isError = false;

      try {
        result = await executeChatTool(tc.name, tc.input);
      } catch (err: any) {
        console.error(`[CHAT:${tc.name}] Error:`, err.message);
        result = { error: err.message };
        isError = true;
      }

      emitChatSSE(sessionId, 'chat_tool_call', {
        tool_name: tc.name,
        input: tc.input,
        result,
        is_error: isError,
      });

      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: JSON.stringify(result),
        is_error: isError,
      });
    }

    // Push tool results as user message and loop
    history.push({
      role: 'user',
      content: toolResultBlocks,
    });
  }

  emitChatSSE(sessionId, 'chat_done', {});
  console.log(`[CHAT] Loop complete for session ${sessionId} (${iteration} iterations)`);
}
