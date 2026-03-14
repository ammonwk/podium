import { v4 as uuid } from 'uuid';
import type { Response } from 'express';
import type { SSEEventType } from '@apm/shared';

const clients = new Set<Response>();

export function addClient(res: Response): void {
  clients.add(res);
  console.log(`[SSE] Client connected (${clients.size} total)`);

  res.on('close', () => {
    clients.delete(res);
    console.log(`[SSE] Client disconnected (${clients.size} total)`);
  });
}

export function emitSSE(type: SSEEventType, payload: unknown): void {
  const event = {
    id: uuid(),
    type,
    timestamp: new Date().toISOString(),
    payload,
  };

  const data = JSON.stringify(event);
  const message = `id: ${event.id}\nevent: ${type}\ndata: ${data}\n\n`;

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
