import { v4 as uuid } from 'uuid';
import type { Response } from 'express';

const chatClients = new Map<string, Response>();

export function addChatClient(sessionId: string, res: Response): void {
  chatClients.set(sessionId, res);
  console.log(`[CHAT-SSE] Client connected for session ${sessionId} (${chatClients.size} total)`);

  res.on('close', () => {
    chatClients.delete(sessionId);
    console.log(`[CHAT-SSE] Client disconnected for session ${sessionId} (${chatClients.size} total)`);
  });
}

export function removeChatClient(sessionId: string): void {
  chatClients.delete(sessionId);
}

export function emitChatSSE(sessionId: string, type: string, data: Record<string, unknown>): void {
  const client = chatClients.get(sessionId);
  if (!client) return;

  const id = uuid();
  const message = `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

  try {
    client.write(message);
  } catch (err) {
    console.error('[CHAT-SSE] Write error, removing client:', err);
    chatClients.delete(sessionId);
  }
}

export function clearAllChatClients(): void {
  chatClients.clear();
}
