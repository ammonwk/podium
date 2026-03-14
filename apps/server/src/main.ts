import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Walk up from cwd to find .env (turbo runs from apps/server/, .env is at repo root)
function findEnv(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) return envPath;
    dir = path.dirname(dir);
  }
  return '.env'; // fallback
}
dotenv.config({ path: findEnv() });

import express from 'express';
import cors from 'cors';
import type { IncomingEvent, DemoEvent, SurgeWebhookPayload, ChatRequest, LLMMessage } from '@apm/shared';
import { AGENT_CONFIG, PROVIDERS } from '@apm/shared';
import { connectDB, seed } from './shared/db.js';
import { addClient, emitSSE } from './shared/sse.js';
import type { LaneContext } from './shared/sse.js';
import { resetState } from './shared/state.js';
import { cancelAll as cancelAllTasks } from './shared/scheduler.js';
import { getProviderConfig, setProvider } from './shared/llm/client.js';
import { runAgentLoop } from './agent/orchestrator.js';
import { runChatLoop } from './agent/chat-orchestrator.js';
import { formatEvent } from './agent/format-event.js';
import { addChatClient, clearAllChatClients } from './shared/chat-sse.js';
import { setHandleEventCallback } from './tools/schedule-task.js';
import { laneManager, DEMO_LANE_ID } from './shared/lane-manager.js';
import type { ConversationType } from './shared/lane-manager.js';
import { getOwnerSettings, setOwnerSettings } from './shared/owner-settings.js';

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

const PORT = parseInt(process.env.PORT || '8000', 10);

// ─── Lane-Based Event Handling ───────────────────────────────────────────────

async function handleEvent(event: IncomingEvent, laneId: string, laneType: ConversationType): Promise<void> {
  const lane = laneManager.getOrCreate(laneId, laneType);
  const laneContext: LaneContext = { conversation_id: laneId, conversation_type: laneType };

  // Format the event into a user message
  const formattedMessage = await formatEvent(event);

  console.log(
    `[LANE:${laneId}] Processing event: "${event.name}" (source: ${event.source})`,
  );

  // Push user message to lane's history
  lane.history.push({
    role: 'user',
    content: formattedMessage,
  });

  // Run the agent loop
  await runAgentLoop(lane.history, event.name, event.source, laneContext);
}

function enqueueEvent(event: IncomingEvent, laneId: string, laneType: ConversationType): void {
  const laneContext: LaneContext = { conversation_id: laneId, conversation_type: laneType };

  // Emit queued event immediately so dashboard can show it
  emitSSE('event_queued', {
    event_name: event.name,
    source: event.source,
  }, laneContext);

  console.log(
    `[LANE:${laneId}] Event queued: "${event.name}"`,
  );

  // Chain onto this lane's queue — events in the same lane run serially,
  // but different lanes run concurrently
  laneManager.enqueue(laneId, laneType, async () => {
    try {
      await handleEvent(event, laneId, laneType);
    } catch (err: any) {
      console.error(`[LANE:${laneId}] Error processing event "${event.name}":`, err);
      emitSSE('error', {
        message: `Error processing "${event.name}": ${err.message || 'Unknown error'}`,
      }, laneContext);
    }
  });
}

// Register the callback for scheduled tasks (avoids circular imports)
setHandleEventCallback((event) => {
  enqueueEvent(event, DEMO_LANE_ID, 'demo');
});

// ─── Chat Sessions ──────────────────────────────────────────────────────────

const chatSessions = new Map<string, { history: LLMMessage[]; phoneNumber?: string }>();

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

  enqueueEvent(event, DEMO_LANE_ID, 'demo');
  res.json({ status: 'queued', event_name: event.name });
});

// POST /surge/webhook — Inbound SMS from Surge
app.post('/surge/webhook', (req, res) => {
  console.log('[SURGE WEBHOOK] Raw body:', JSON.stringify(req.body, null, 2));

  // Parse Surge's nested webhook format:
  // { data: { body, conversation: { contact: { phone_number } } } }
  const surgeData = req.body?.data;
  const from = surgeData?.conversation?.contact?.phone_number;
  const body = surgeData?.body;

  if (!from || !body) {
    console.warn('[SURGE WEBHOOK] Could not extract from/body from payload');
    res.status(400).json({ error: 'Missing from or body in webhook data' });
    return;
  }

  console.log(`[SURGE WEBHOOK] Inbound SMS from ${from}: "${body}"`);

  // Rate limit
  if (isRateLimited(from)) {
    res.json({ status: 'rate_limited' });
    return;
  }

  const event: IncomingEvent = {
    type: 'guest_message',
    source: 'human',
    name: `Inbound SMS from ${from}`,
    payload: {
      from,
      body,
    },
  };

  // Route to a per-phone-number lane for concurrent processing
  enqueueEvent(event, payload.from, 'caller');
  res.json({ status: 'queued', event_name: event.name });
});

// GET /chat/stream — Chat SSE endpoint
app.get('/chat/stream', (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  addChatClient(sessionId, res);
});

// POST /chat — Send chat message
app.post('/chat', (req, res) => {
  const { message, role, sessionId, phoneNumber } = req.body as ChatRequest;

  if (!message || !role || !sessionId) {
    res.status(400).json({ error: 'Missing message, role, or sessionId' });
    return;
  }

  // Get or create session
  let session = chatSessions.get(sessionId);
  if (!session) {
    session = { history: [], phoneNumber };
    chatSessions.set(sessionId, session);
  } else if (phoneNumber && !session.phoneNumber) {
    session.phoneNumber = phoneNumber;
  }

  // Push user message
  session.history.push({ role: 'user', content: message });

  // Run chat loop in background (streaming via SSE)
  runChatLoop(session.history, role, sessionId, { phoneNumber: session.phoneNumber }).catch((err) => {
    console.error('[CHAT] Error:', err);
  });

  res.json({ status: 'ok' });
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

    // Reset all conversation lanes
    resetState();

    // Clear SMS rate limiter
    smsLastSeen.clear();

    // Clear chat sessions
    chatSessions.clear();
    clearAllChatClients();

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

// GET /settings/owner
app.get('/settings/owner', (_req, res) => {
  res.json(getOwnerSettings());
});

// PUT /settings/owner
app.put('/settings/owner', (req, res) => {
  const { name, phone } = req.body || {};

  if (!name || !phone) {
    res.status(400).json({ error: 'Missing name or phone' });
    return;
  }

  if (!/^\+\d{7,15}$/.test(phone)) {
    res.status(400).json({ error: 'Invalid phone format. Use E.164 (e.g. +18015550000)' });
    return;
  }

  setOwnerSettings(name, phone);
  res.json({ status: 'ok', ...getOwnerSettings() });
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

// POST /provider — toggle or explicit switch
app.post('/provider', (req, res) => {
  let { provider, model } = req.body || {};

  // If no body, toggle to the other provider
  if (!provider || !model) {
    const current = getProviderConfig();
    if (current.provider === 'anthropic') {
      provider = PROVIDERS.CEREBRAS.provider;
      model = PROVIDERS.CEREBRAS.model;
    } else {
      provider = PROVIDERS.ANTHROPIC.provider;
      model = PROVIDERS.ANTHROPIC.model;
    }
  }

  if (provider !== 'anthropic' && provider !== 'cerebras') {
    res.status(400).json({ error: `Unknown provider: ${provider}` });
    return;
  }

  setProvider({ provider, model });
  const config = getProviderConfig();
  res.json({ status: 'ok', provider: config.provider, model: config.model });
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
