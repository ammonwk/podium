import type { LLMMessage, LLMContentBlock, LLMStreamEvent } from '@apm/shared';
import { AGENT_CONFIG, TOOL_NAMES } from '@apm/shared';
import { getActiveClient } from '../shared/llm/client.js';
import { emitSSE } from '../shared/sse.js';
import { buildSystemPrompt } from './system-prompt.js';
import { toolDefinitions } from '../tools/definitions.js';
import { executeSendSms } from '../tools/send-sms.js';
import { executeCreateWorkOrder } from '../tools/create-work-order.js';
import { executeAdjustPrice } from '../tools/adjust-price.js';
import { executeLogDecision } from '../tools/log-decision.js';
import { executeGetMarketData } from '../tools/get-market-data.js';
import { executeUpdateSchedule } from '../tools/update-schedule.js';
import { executeScheduleTask } from '../tools/schedule-task.js';
import { executeCreateBooking } from '../tools/create-booking.js';
import { executeEditBooking } from '../tools/edit-booking.js';

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (name) {
    case TOOL_NAMES.SEND_SMS:
      return (await executeSendSms(input as any)) as unknown as Record<string, unknown>;
    case TOOL_NAMES.CREATE_WORK_ORDER:
      return (await executeCreateWorkOrder(input as any)) as unknown as Record<
        string,
        unknown
      >;
    case TOOL_NAMES.ADJUST_PRICE:
      return (await executeAdjustPrice(input as any)) as unknown as Record<
        string,
        unknown
      >;
    case TOOL_NAMES.LOG_DECISION:
      return (await executeLogDecision(input as any)) as unknown as Record<
        string,
        unknown
      >;
    case TOOL_NAMES.GET_MARKET_DATA:
      return (await executeGetMarketData(input as any)) as unknown as Record<
        string,
        unknown
      >;
    case TOOL_NAMES.UPDATE_SCHEDULE:
      return (await executeUpdateSchedule(input as any)) as unknown as Record<
        string,
        unknown
      >;
    case TOOL_NAMES.SCHEDULE_TASK:
      return (await executeScheduleTask(input as any)) as unknown as Record<
        string,
        unknown
      >;
    case TOOL_NAMES.CREATE_BOOKING:
      return (await executeCreateBooking(input as any)) as unknown as Record<
        string,
        unknown
      >;
    case TOOL_NAMES.EDIT_BOOKING:
      return (await executeEditBooking(input as any)) as unknown as Record<
        string,
        unknown
      >;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function runAgentLoop(
  conversationHistory: LLMMessage[],
  eventName: string,
  source: 'human' | 'system' | 'self-scheduled',
): Promise<void> {
  const client = getActiveClient();
  const system = buildSystemPrompt();

  console.log(
    `[AGENT] Starting loop for "${eventName}" (source: ${source}) using ${client.provider}/${client.model}`,
  );

  emitSSE('event_start', {
    event_name: eventName,
    source,
    description: `Processing: ${eventName}`,
  });

  let iteration = 0;

  while (iteration < AGENT_CONFIG.MAX_ITERATIONS) {
    iteration++;
    console.log(`[AGENT] Iteration ${iteration}/${AGENT_CONFIG.MAX_ITERATIONS}`);

    // Collect the full response from the streaming call
    const assistantBlocks: LLMContentBlock[] = [];
    const pendingToolCalls: ToolCall[] = [];
    let fullText = '';
    let stopReason = '';

    try {
      const stream = client.stream(system, conversationHistory, toolDefinitions);

      for await (const event of stream) {
        switch (event.type) {
          case 'thinking_delta': {
            // Stream thinking text to dashboard for live display
            const thinkingText = event.text || '';
            emitSSE('thinking', { text: thinkingText, event_name: eventName });
            break;
          }
          case 'thinking_done': {
            // Capture complete thinking block (with signature) for conversation history
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
            // Emit text to dashboard as well
            emitSSE('thinking', { text, event_name: eventName });
            break;
          }
          case 'tool_use_start': {
            // Tool call starting — we'll get the full input on tool_use_done
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
            stopReason = event.stop_reason || 'end_turn';
            break;
          }
        }
      }
    } catch (err: any) {
      console.error('[AGENT] LLM stream error:', err);
      emitSSE('error', {
        message: `LLM error: ${err.message || 'Unknown error'}`,
      });
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
      console.warn('[AGENT] Empty response from LLM, breaking loop');
      break;
    }

    // Append the assistant message to conversation history
    conversationHistory.push({
      role: 'assistant',
      content: assistantBlocks,
    });

    // If no tool calls, we're done
    if (pendingToolCalls.length === 0) {
      console.log('[AGENT] No tool calls, loop complete');
      break;
    }

    // Execute tool calls and build tool results
    const toolResultBlocks: LLMContentBlock[] = [];

    for (const tc of pendingToolCalls) {
      console.log(`[AGENT] Executing tool: ${tc.name}`);
      let result: Record<string, unknown>;
      let isError = false;

      try {
        result = await executeTool(tc.name, tc.input);
      } catch (err: any) {
        console.error(`[TOOL:${tc.name}] Error:`, err.message);
        result = { error: err.message };
        isError = true;
      }

      // Emit SSE for dashboard
      emitSSE('tool_call', {
        tool_name: tc.name,
        input: tc.input,
        result,
        event_name: eventName,
      });

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

    // If stop reason was end_turn even though there were tool calls, still loop
    // (the model might have text + tool calls in one response)
    // The loop condition at the top will handle max iterations
  }

  if (iteration >= AGENT_CONFIG.MAX_ITERATIONS) {
    console.warn(
      `[AGENT] Hit max iterations (${AGENT_CONFIG.MAX_ITERATIONS}) for "${eventName}"`,
    );
  }

  emitSSE('event_done', { event_name: eventName });
  console.log(`[AGENT] Loop complete for "${eventName}" (${iteration} iterations)`);
}
