import { emitSSE } from '../shared/sse.js';
import type { LaneContext } from '../shared/sse.js';
import { emitChatSSE } from '../shared/chat-sse.js';
import type { LoopEmitter } from './types.js';

export function createDashboardEmitter(laneContext?: LaneContext): LoopEmitter {
  let currentEventName = '';

  return {
    onThinkingDelta(text) {
      emitSSE('thinking', { text, event_name: currentEventName }, laneContext);
    },
    onTextDelta(text) {
      emitSSE('thinking', { text, event_name: currentEventName }, laneContext);
    },
    onToolCall(toolName, input, result, _isError) {
      emitSSE('tool_call', { tool_name: toolName, input, result, event_name: currentEventName }, laneContext);
    },
    onError(message) {
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
    onError(_message) {
      emitChatSSE(sessionId, 'chat_text', { text: 'Sorry, something went wrong. Please try again.' });
    },
    onStart(_eventName, _source) {
      // No start event for chat
    },
    onDone() {
      emitChatSSE(sessionId, 'chat_done', {});
    },
  };
}
