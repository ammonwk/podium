import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import type { IncomingEvent, DemoEvent, SurgeWebhookPayload } from '@apm/shared';
import { AGENT_CONFIG } from '@apm/shared';
import { connectDB, seed } from './shared/db.js';
import { addClient, emitSSE } from './shared/sse.js';
import {
  conversationHistory,
  resetState,
  getConversationHistory,
} from './shared/state.js';
import { cancelAll as cancelAllTasks } from './shared/scheduler.js';
import { getProviderConfig, setProvider } from './shared/llm/client.js';
import { runAgentLoop } from './agent/orchestrator.js';
import { formatEvent } from './agent/format-event.js';
import { setHandleEventCallback } from './tools/schedule-task.js';

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.PORT || '8000', 10);

// ─── Event Queue (promise-chain serialization) ──────────────────────────────

let eventQueue: Promise<void> = Promise.resolve();
let queueDepth = 0;

async function handleEvent(event: IncomingEvent): Promise<void> {
  const history = getConversationHistory();

  // Format the event into a user message
  const formattedMessage = await formatEvent(event);

  console.log(
    `[QUEUE] Processing event: "${event.name}" (source: ${event.source})`,
  );

  // Push user message to conversation history
  history.push({
    role: 'user',
    content: formattedMessage,
  });

  // Run the agent loop
  await runAgentLoop(history, event.name, event.source);
}

function enqueueEvent(event: IncomingEvent): void {
  queueDepth++;
  const position = queueDepth;

  // Emit queued event immediately so dashboard can show it
  emitSSE('event_queued', {
    event_name: event.name,
    source: event.source,
    position,
  });

  console.log(
    `[QUEUE] Event queued: "${event.name}" (position: ${position})`,
  );

  // Chain onto the promise queue — never run two handleEvent() concurrently
  eventQueue = eventQueue
    .then(() => handleEvent(event))
    .catch((err) => {
      console.error(`[QUEUE] Error processing event "${event.name}":`, err);
      emitSSE('error', {
        message: `Error processing "${event.name}": ${err.message || 'Unknown error'}`,
      });
    })
    .finally(() => {
      queueDepth--;
    });
}

// Register the callback for scheduled tasks (avoids circular imports)
setHandleEventCallback((event) => {
  enqueueEvent(event);
});

// ─── SMS Rate Limiter ───────────────────────────────────────────────────────

const smsLastSeen = new Map<string, number>();

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const last = smsLastSeen.get(phone);

  if (last && now - last < AGENT_CONFIG.SMS_RATE_LIMIT_MS) {
    console.log(
      `[RATE_LIMIT] Dropping SMS from ${phone} — last message ${now - last}ms ago (limit: ${AGENT_CONFIG.SMS_RATE_LIMIT_MS}ms)`,
    );
    return true;
  }

  smsLastSeen.set(phone, now);
  return false;
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// POST /events — Scripted demo events
app.post('/events', (req, res) => {
  const demoEvent = req.body as DemoEvent;

  if (!demoEvent.type) {
    res.status(400).json({ error: 'Missing event type' });
    return;
  }

  let event: IncomingEvent;

  if (demoEvent.type === 'guest_message') {
    event = {
      type: 'guest_message',
      source: 'human',
      name: req.body.name || `SMS from ${demoEvent.from}`,
      payload: {
        from: demoEvent.from,
        body: demoEvent.body,
      },
    };
  } else if (demoEvent.type === 'market_alert') {
    event = {
      type: 'market_alert',
      source: 'system',
      name: req.body.name || `Market Alert: ${demoEvent.alert_type}`,
      payload: {
        alert_type: demoEvent.alert_type,
        message: demoEvent.message,
      },
    };
  } else {
    res.status(400).json({ error: `Unknown event type: ${demoEvent.type}` });
    return;
  }

  enqueueEvent(event);
  res.json({ status: 'queued', event_name: event.name });
});

// POST /surge/webhook — Inbound SMS from Surge
app.post('/surge/webhook', (req, res) => {
  const payload = req.body as SurgeWebhookPayload;

  if (!payload.from || !payload.body) {
    res.status(400).json({ error: 'Missing from or body' });
    return;
  }

  // Rate limit
  if (isRateLimited(payload.from)) {
    res.json({ status: 'rate_limited' });
    return;
  }

  const event: IncomingEvent = {
    type: 'guest_message',
    source: 'human',
    name: `Inbound SMS from ${payload.from}`,
    payload: {
      from: payload.from,
      body: payload.body,
    },
  };

  enqueueEvent(event);
  res.json({ status: 'queued', event_name: event.name });
});

// GET /events/stream — SSE endpoint
app.get('/events/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection event
  res.write(
    `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`,
  );

  addClient(res);
});

// POST /reset — Reset everything
app.post('/reset', async (_req, res) => {
  try {
    console.log('[RESET] Resetting server state...');

    // Cancel all pending tasks
    cancelAllTasks();

    // Reset conversation history
    resetState();

    // Clear SMS rate limiter
    smsLastSeen.clear();

    // Reset queue
    eventQueue = Promise.resolve();
    queueDepth = 0;

    // Re-seed database
    await seed();

    // Notify connected clients
    emitSSE('reset', { message: 'Server state reset' });

    console.log('[RESET] Complete');
    res.json({ status: 'reset' });
  } catch (err: any) {
    console.error('[RESET] Error:', err);
    res.status(500).json({ error: err.message || 'Reset failed' });
  }
});

// GET /health
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    provider: getProviderConfig(),
  });
});

// GET /provider
app.get('/provider', (_req, res) => {
  res.json(getProviderConfig());
});

// POST /provider
app.post('/provider', (req, res) => {
  const { provider, model } = req.body;

  if (!provider || !model) {
    res.status(400).json({ error: 'Missing provider or model' });
    return;
  }

  if (provider !== 'anthropic' && provider !== 'cerebras') {
    res.status(400).json({ error: `Unknown provider: ${provider}` });
    return;
  }

  setProvider({ provider, model });
  res.json({ status: 'ok', provider: getProviderConfig() });
});

// ─── Startup ────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  try {
    await connectDB();
    await seed();

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  Agentic Property Manager — Server`);
      console.log(`  http://localhost:${PORT}`);
      console.log(`  Provider: ${getProviderConfig().provider} (${getProviderConfig().model})`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error('[STARTUP] Fatal error:', err);
    process.exit(1);
  }
}

start();
