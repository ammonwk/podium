import type { LLMMessage } from '@apm/shared';

export let conversationHistory: LLMMessage[] = [];

export function resetState(): void {
  conversationHistory = [];
  console.log('[STATE] Conversation history cleared');
}

/** Expose the reference so the orchestrator can push to it. */
export function getConversationHistory(): LLMMessage[] {
  return conversationHistory;
}
