import { v4 as uuid } from 'uuid';
import type { Response } from 'express';
import type { SSEEventType } from '@apm/shared';
import type { ConversationType } from './lane-manager.js';

export interface LaneContext {
  conversation_id: string;
  conversation_type: ConversationType;
}

const clients = new Set<Response>();

export function addClient(res: Response): void {
  clients.add(res);
  console.log(`[SSE] Client connected (${clients.size} total)`);

  res.on('close', () => {
    clients.delete(res);
    console.log(`[SSE] Client disconnected (${clients.size} total)`);
  });
}

export function emitSSE(type: SSEEventType, payload: unknown, laneContext?: LaneContext): void {
  const id = uuid();
  const timestamp = new Date().toISOString();

  // Flatten payload into the data object so the client receives fields at the top level
  // (EventSource listeners parse e.data and expect payload fields directly, not nested under .payload)
  const data = JSON.stringify({
    id,
    type,
    timestamp,
    ...(payload as Record<string, unknown>),
    ...(laneContext ? { conversation_id: laneContext.conversation_id, conversation_type: laneContext.conversation_type } : {}),
  });
  const message = `id: ${id}\nevent: ${type}\ndata: ${data}\n\n`;

  for (const client of clients) {
    try {
      client.write(message);
    } catch (err) {
      console.error('[SSE] Write error, removing client:', err);
      clients.delete(client);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}

export function removeAllClients(): void {
  clients.clear();
}
