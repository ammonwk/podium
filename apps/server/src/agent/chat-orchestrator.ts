import type { LLMMessage, LLMContentBlock, ChatRole } from '@apm/shared';
import { getActiveClient } from '../shared/llm/client.js';
import { emitChatSSE } from '../shared/chat-sse.js';
import { buildSystemPrompt } from './system-prompt.js';

export async function runChatLoop(
  history: LLMMessage[],
  role: ChatRole,
  sessionId: string,
): Promise<void> {
  const client = getActiveClient();
  const system = buildSystemPrompt(role);

  console.log(`[CHAT] Starting chat loop for session ${sessionId} (role: ${role}) using ${client.provider}/${client.model}`);

  const assistantBlocks: LLMContentBlock[] = [];
  let fullText = '';

  try {
    const stream = client.stream(system, history, []);

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
        case 'done':
          break;
      }
    }
  } catch (err: any) {
    console.error('[CHAT] LLM stream error:', err);
    emitChatSSE(sessionId, 'chat_text', { text: 'Sorry, something went wrong. Please try again.' });
  }

  // Append assistant response to history
  if (fullText) {
    assistantBlocks.push({ type: 'text', text: fullText });
  }

  if (assistantBlocks.length > 0) {
    history.push({
      role: 'assistant',
      content: assistantBlocks,
    });
  }

  emitChatSSE(sessionId, 'chat_done', {});
  console.log(`[CHAT] Loop complete for session ${sessionId}`);
}
