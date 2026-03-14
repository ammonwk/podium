import { emitSSE } from '../shared/sse.js';
import type { LaneContext } from '../shared/sse.js';
import { emitChatSSE } from '../shared/chat-sse.js';
import type { LoopEmitter } from './types.js';

const THINKING_FLUSH_MS = 80; // batch thinking deltas — feels real-time, 10x fewer writes

export function createDashboardEmitter(laneContext?: LaneContext): LoopEmitter {
  let currentEventName = '';
  let thinkingBuffer = '';
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let assistantBuffer = '';
  let assistantFlushTimer: ReturnType<typeof setTimeout> | null = null;

  function flushThinking() {
    if (thinkingBuffer) {
      emitSSE('thinking', { text: thinkingBuffer, event_name: currentEventName }, laneContext);
      thinkingBuffer = '';
    }
    flushTimer = null;
  }

  function bufferThinking(text: string) {
    thinkingBuffer += text;
    if (!flushTimer) {
      flushTimer = setTimeout(flushThinking, THINKING_FLUSH_MS);
    }
  }

  function flushAssistant() {
    if (assistantBuffer) {
      emitSSE('assistant_text', { text: assistantBuffer, event_name: currentEventName }, laneContext);
      assistantBuffer = '';
    }
    assistantFlushTimer = null;
  }

  function bufferAssistant(text: string) {
    assistantBuffer += text;
    if (!assistantFlushTimer) {
      assistantFlushTimer = setTimeout(flushAssistant, THINKING_FLUSH_MS);
    }
  }

  return {
    onThinkingDelta(text) {
      bufferThinking(text);
    },
    onTextDelta(text) {
      bufferAssistant(text);
    },
    onToolCall(toolName, input, result, _isError) {
      flushThinking(); // flush any pending thinking before tool card appears
      flushAssistant(); // flush any pending assistant text too
      emitSSE('tool_call', { tool_name: toolName, input, result, event_name: currentEventName }, laneContext);
    },
    onError(message) {
      flushThinking();
      flushAssistant();
      emitSSE('error', { message }, laneContext);
    },
    onStart(eventName, source) {
      currentEventName = eventName;
      emitSSE('event_start', {
        event_name: eventName,
        source,
        description: `Processing: ${eventName}`,
      }, laneContext);
    },
    onDone() {
      flushThinking(); // flush remaining thinking before done event
      flushAssistant(); // flush remaining assistant text too
      emitSSE('event_done', { event_name: currentEventName }, laneContext);
    },
  };
}

export function createChatEmitter(sessionId: string): LoopEmitter {
  return {
    onThinkingDelta(_text) {
      // Silence thinking for chat
    },
    onTextDelta(text) {
      emitChatSSE(sessionId, 'chat_text', { text });
    },
    onToolCall(toolName, input, result, isError) {
      emitChatSSE(sessionId, 'chat_tool_call', {
        tool_name: toolName,
        input,
        result,
        is_error: isError,
      });
    },
    onError(message) {
      emitChatSSE(sessionId, 'chat_error', { message: message || 'Sorry, something went wrong. Please try again.' });
    },
    onStart(_eventName, _source) {
      // No start event for chat
    },
    onDone() {
      emitChatSSE(sessionId, 'chat_done', {});
    },
  };
}
