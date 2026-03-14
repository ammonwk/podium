import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

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
import Stripe from 'stripe';
import type { IncomingEvent, DemoEvent, SurgeWebhookPayload, ChatRequest, LLMMessage } from '@apm/shared';
import { AGENT_CONFIG, PROVIDERS } from '@apm/shared';
import { connectDB, seed, shouldSeed, initSSESequence, SSEEventLogModel, ConversationModel, ChatSessionModel, ScheduledTaskModel } from './shared/db.js';
import { addClient, emitSSE } from './shared/sse.js';
import type { LaneContext } from './shared/sse.js';
import { resetState } from './shared/state.js';
import { cancelAll as cancelAllTasks, registerTask } from './shared/scheduler.js';
import { getProviderConfig, setProvider } from './shared/llm/client.js';
import { runLoop } from './agent/orchestrator.js';
import { createDashboardEmitter, createChatEmitter } from './agent/emitters.js';
import { formatEvent, wrapUntrustedInput } from './agent/format-event.js';
import { addChatClient, clearAllChatClients } from './shared/chat-sse.js';
import { setHandleEventCallback } from './tools/schedule-task.js';
import { laneManager, DEMO_LANE_ID } from './shared/lane-manager.js';
import type { ConversationType } from './shared/lane-manager.js';
import { getOwnerSettings, setOwnerSettings, loadOwnerSettings, initOwnerSettings } from './shared/owner-settings.js';
import { buildSystemPrompt } from './agent/system-prompt.js';
import { ALL_TOOLS, CHAT_BOOKING_TOOLS, CHAT_OWNER_TOOLS, CHAT_OCCUPANT_TOOLS, NO_TOOLS } from './tools/definitions.js';
import { normalizePhone } from './shared/phone-utils.js';
import { executeCreateBooking } from './tools/create-booking.js';
import { BookingModel, PropertyModel, ScheduleEventModel, WorkOrderModel } from './shared/db.js';
import { startProactiveLoops, resetProactiveState } from './proactive/proactive-loops.js';

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();

// Per-session mutex to prevent concurrent runLoop executions from clobbering history
const sessionLocks = new Map<string, Promise<void>>();
let proactiveHandle: { stopAll: () => void } | null = null;
app.use(cors());

// ─── Stripe Webhook (must be before express.json() for raw body verification) ─
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '');

app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[STRIPE] Missing STRIPE_WEBHOOK_SECRET');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[STRIPE] Webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    return;
  }

  console.log(`[STRIPE] Received event: ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.booking_id;
    const guestPhone = session.metadata?.guest_phone;

    if (bookingId) {
      console.log(`[STRIPE] Payment completed for booking ${bookingId}`);
      await BookingModel.updateOne(
        { id: bookingId },
        { payment_status: 'paid' },
      );

      // Look up the booking to get guest details for the AI event
      const booking = await BookingModel.findOne({ id: bookingId }).lean();
      const guestName = booking?.guest_name || 'Guest';
      const propertyId = booking?.property_id || session.metadata?.property_id || '';

      // Feed a system event into the agent so it can confirm with the guest
      enqueueEvent(
        {
          type: 'system',
          source: 'system',
          name: `Payment Received: ${guestName} (${bookingId})`,
          payload: {
            message: `Payment confirmed for booking ${bookingId}. Guest ${guestName} (${guestPhone}) has paid $${((session.amount_total || 0) / 100).toFixed(2)} for property ${propertyId}. Send them a confirmation message acknowledging their payment and confirming their reservation details.`,
          },
        },
        guestPhone || DEMO_LANE_ID,
        guestPhone ? 'caller' : 'demo',
      );
    }
  }

  res.json({ received: true });
});

app.use(express.json());

const PORT = parseInt(process.env.PORT || '8000', 10);

// ─── Auth Gate ──────────────────────────────────────────────────────────────

const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'secret demo password';
const AUTH_SECRET = process.env.AUTH_SECRET || 'podium-hackathon-auth';

function makeAuthToken(): string {
  return crypto.createHmac('sha256', AUTH_SECRET).update('authenticated').digest('hex');
}

function getCookie(header: string, name: string): string | undefined {
  const match = header.split(';').find(c => c.trim().startsWith(`${name}=`));
  return match ? match.split('=').slice(1).join('=').trim() : undefined;
}

const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>VibePM</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e4e4e7;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:#16161e;border:1px solid #27272a;border-radius:16px;padding:48px 40px;width:100%;max-width:380px;text-align:center}
.logo{font-size:36px;margin-bottom:12px}
.title{font-size:22px;font-weight:800;letter-spacing:-0.03em;margin-bottom:4px}
.subtitle{font-size:14px;color:#71717a;margin-bottom:32px}
input{width:100%;padding:12px 16px;background:#0a0a0f;border:1px solid #27272a;border-radius:10px;color:#e4e4e7;font-size:15px;outline:none;margin-bottom:16px;font-family:inherit}
input:focus{border-color:#7c3aed}
button{width:100%;padding:12px;background:#7c3aed;border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s}
button:hover{background:#6d28d9}
.error{color:#ef4444;font-size:13px;margin-bottom:12px;display:none}
</style></head><body>
<div class="card">
<div class="title">VibePM</div>
<div class="subtitle">Enter the demo password to continue</div>
<div class="error" id="err">Invalid password</div>
<form id="f">
<input type="password" id="pw" placeholder="Password" autofocus>
<button type="submit">Enter</button>
</form>
</div>
<script>
document.getElementById('f').onsubmit=async e=>{
  e.preventDefault();
  const res=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('pw').value})});
  if(res.ok){window.location.reload()}else{document.getElementById('err').style.display='block'}
};
</script></body></html>`;

// Auth middleware (only in production — dev uses Vite proxy without auth)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  // Skip auth for webhooks, health, and login
  if (req.path === '/surge/webhook' || req.path === '/stripe/webhook' || req.path === '/health' || req.path === '/login') {
    return next();
  }
  // Check auth cookie
  const token = getCookie(req.headers.cookie || '', 'auth');
  if (token === makeAuthToken()) {
    return next();
  }
  // API/SSE requests get 401
  if (req.path.startsWith('/api') || req.path === '/events/stream' || req.path.startsWith('/chat')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  // Everything else gets the login page
  res.send(LOGIN_PAGE);
});

// Login endpoint
app.post('/login', (req, res) => {
  if (req.body?.password === AUTH_PASSWORD) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `auth=${makeAuthToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`);
    res.json({ status: 'ok' });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Rewrite /api/* to /* (Vite dev proxy strips this prefix; this does the same in production)
app.use((req, _res, next) => {
  if (req.url.startsWith('/api/') || req.url === '/api') {
    req.url = req.url.replace(/^\/api/, '') || '/';
  }
  next();
});

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
  await runLoop(lane.history, {
    label: `LANE:${laneId}`,
    eventName: event.name,
    maxIterations: AGENT_CONFIG.MAX_ITERATIONS,
    tools: ALL_TOOLS,
    systemPrompt: buildSystemPrompt(),
    emitter: createDashboardEmitter(laneContext),
  });

  // Persist conversation history to MongoDB
  await laneManager.persist(laneId);
}

function enqueueEvent(event: IncomingEvent, laneId: string, laneType: ConversationType): void {
  const laneContext: LaneContext = { conversation_id: laneId, conversation_type: laneType };

  // Emit queued event immediately so dashboard can show it
  // Include trigger message content for guest_message events so the frontend
  // can display the inbound SMS (not just for demo events)
  emitSSE('event_queued', {
    event_name: event.name,
    source: event.source,
    ...(event.type === 'guest_message' && event.payload?.from && event.payload?.body
      ? { trigger_from: event.payload.from, trigger_body: event.payload.body }
      : {}),
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

// ─── Chat Sessions (MongoDB-backed) ─────────────────────────────────────────

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

  // Route guest_message events to per-phone lanes for concurrent processing;
  // non-guest events (e.g. market_alert) use the shared demo lane
  const laneId = demoEvent.type === 'guest_message' && demoEvent.from
    ? demoEvent.from
    : DEMO_LANE_ID;
  const laneType: ConversationType = demoEvent.type === 'guest_message' && demoEvent.from
    ? 'caller'
    : 'demo';

  enqueueEvent(event, laneId, laneType);
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
  enqueueEvent(event, from, 'caller');
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

// GET /chat/history — Load previous chat messages
app.get('/chat/history', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId' });
    return;
  }

  try {
    const session = await ChatSessionModel.findOne({ session_id: sessionId }).lean();
    if (!session) {
      res.json({ messages: [], role: null });
      return;
    }
    res.json({
      messages: session.messages,
      role: session.role,
      phoneNumber: session.phone_number,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /chat — Send chat message
app.post('/chat', async (req, res) => {
  const { message, role, sessionId, phoneNumber } = req.body as ChatRequest;

  if (!message || !role || !sessionId) {
    res.status(400).json({ error: 'Missing message, role, or sessionId' });
    return;
  }

  const now = new Date().toISOString();

  // Get or create session from MongoDB
  let session = await ChatSessionModel.findOne({ session_id: sessionId });
  if (!session) {
    session = await ChatSessionModel.create({
      session_id: sessionId,
      role,
      phone_number: phoneNumber,
      messages: [],
      history: [],
      created_at: now,
      updated_at: now,
    });
  } else if (phoneNumber && !session.phone_number) {
    session.phone_number = phoneNumber;
  }

  // Wait for any in-flight runLoop on this session to finish before mutating
  const pendingLock = sessionLocks.get(sessionId);
  if (pendingLock) {
    await pendingLock;
  }

  // Re-load session after awaiting lock to get the latest persisted state
  if (pendingLock) {
    session = await ChatSessionModel.findOne({ session_id: sessionId });
    if (!session) {
      res.status(404).json({ error: 'Session lost' });
      return;
    }
  }

  // Persist user message
  const userMsg = {
    id: `msg_${Date.now()}`,
    role: 'user' as const,
    content: message,
    timestamp: now,
  };
  session.messages.push(userMsg);

  // Wrap user message in untrusted-input tags (same defense as SMS path)
  session.history.push({ role: 'user', content: wrapUntrustedInput(message) });
  session.updated_at = now;
  session.markModified('history');
  session.markModified('messages');
  await session.save();

  // Run unified loop in background (streaming via SSE)
  const normalizedPhone = session.phone_number ? normalizePhone(session.phone_number) : undefined;
  const tools = role === 'interested_person'
    ? CHAT_BOOKING_TOOLS
    : role === 'property_owner'
      ? CHAT_OWNER_TOOLS
      : role === 'current_occupant'
        ? CHAT_OCCUPANT_TOOLS
        : NO_TOOLS;

  // Use a mutable reference to the history array so runLoop can push to it
  const history = session.history as import('@apm/shared').LLMMessage[];

  // Sanitize: remove trailing assistant messages with orphaned tool_use blocks
  // (can happen if server crashed mid-loop)
  while (history.length > 0) {
    const last = history[history.length - 1];
    if (last.role !== 'assistant') break;
    const blocks = Array.isArray(last.content) ? last.content : [];
    const hasToolUse = blocks.some((b: any) => b.type === 'tool_use');
    if (!hasToolUse) break;
    console.warn(`[CHAT:${sessionId}] Removing orphaned assistant tool_use message from history`);
    history.pop();
  }

  // Run loop with per-session lock to prevent concurrent mutations
  const loopPromise = (async () => {
    try {
      await runLoop(history, {
        label: `CHAT:${sessionId}`,
        eventName: `chat-${sessionId}`,
        maxIterations: AGENT_CONFIG.CHAT_MAX_ITERATIONS,
        tools,
        systemPrompt: buildSystemPrompt(role, normalizedPhone || session!.phone_number),
        emitter: createChatEmitter(sessionId),
        sessionId,
      });

      // After loop completes, persist updated history and add assistant message
      const assistantBlocks = history.filter(m => m.role === 'assistant');
      const lastAssistant = assistantBlocks[assistantBlocks.length - 1];
      if (lastAssistant) {
        const text = typeof lastAssistant.content === 'string'
          ? lastAssistant.content
          : (lastAssistant.content as any[])
              .filter((b: any) => b.type === 'text')
              .map((b: any) => b.text)
              .join('');
        if (text) {
          session!.messages.push({
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: text,
            timestamp: new Date().toISOString(),
          });
        }
      }
      session!.history = history;
      session!.updated_at = new Date().toISOString();
      session!.markModified('history');
      session!.markModified('messages');
      await session!.save();
    } catch (err) {
      console.error('[CHAT] Error:', err);
    } finally {
      sessionLocks.delete(sessionId);
    }
  })();

  sessionLocks.set(sessionId, loopPromise);

  res.json({ status: 'ok' });
});

// GET /events/history — Fetch all persisted SSE events for dashboard hydration
app.get('/events/history', async (_req, res) => {
  try {
    const events = await SSEEventLogModel.find().sort({ seq: 1 }).lean();
    res.json({ events: events.map(e => e.data) });
  } catch (err: any) {
    console.error('[HISTORY] Error fetching events:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch history' });
  }
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

    // Stop proactive loops
    if (proactiveHandle) proactiveHandle.stopAll();
    resetProactiveState();

    // Cancel all pending tasks
    cancelAllTasks();

    // Reset all conversation lanes
    resetState();

    // Clear SMS rate limiter
    smsLastSeen.clear();

    // Clear chat sessions
    clearAllChatClients();

    // Re-seed database and reset owner settings
    await seed();
    await loadOwnerSettings();

    // Notify connected clients
    emitSSE('reset', { message: 'Server state reset' });

    // Restart proactive loops after reset
    proactiveHandle = startProactiveLoops((event, laneId, laneType) => {
      enqueueEvent(event, laneId, laneType);
    });

    console.log('[RESET] Complete');
    res.json({ status: 'reset' });
  } catch (err: any) {
    console.error('[RESET] Error:', err);
    res.status(500).json({ error: err.message || 'Reset failed' });
  }
});

// GET /settings/owner
app.get('/settings/owner', async (_req, res) => {
  res.json(await getOwnerSettings());
});

// PUT /settings/owner
app.put('/settings/owner', async (req, res) => {
  const { name, phone } = req.body || {};

  if (!name || !phone) {
    res.status(400).json({ error: 'Missing name or phone' });
    return;
  }

  if (!/^\+\d{7,15}$/.test(phone)) {
    res.status(400).json({ error: 'Invalid phone format. Use E.164 (e.g. +18015550000)' });
    return;
  }

  await setOwnerSettings(name, phone);
  res.json({ status: 'ok', ...(await getOwnerSettings()) });
});

// ─── Booking CRUD ────────────────────────────────────────────────────────────

// GET /properties — list all properties (for dropdown)
app.get('/properties', async (_req, res) => {
  const properties = await PropertyModel.find({}).lean();
  res.json(properties);
});

// GET /bookings — list all bookings
app.get('/bookings', async (_req, res) => {
  const bookings = await BookingModel.find({}).lean();
  res.json(bookings);
});

// POST /bookings — create a booking
app.post('/bookings', async (req, res) => {
  try {
    const { property_id, guest_name, guest_phone, check_in, check_out } = req.body || {};
    if (!property_id || !guest_name || !guest_phone || !check_in || !check_out) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const result = await executeCreateBooking({ property_id, guest_name, guest_phone, check_in, check_out });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create booking' });
  }
});

// DELETE /bookings/:id — delete a booking and its schedule events
app.delete('/bookings/:id', async (req, res) => {
  try {
    const booking = await BookingModel.findOne({ id: req.params.id }).lean();
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }
    // Remove associated schedule events (checkin/checkout for this guest on this property)
    await ScheduleEventModel.deleteMany({
      property_id: booking.property_id,
      notes: { $regex: booking.guest_name },
    });
    await BookingModel.deleteOne({ id: req.params.id });
    res.json({ status: 'deleted', id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete booking' });
  }
});

// POST /work-orders/resolve — Mark a work order as completed and dismiss the issue
app.post('/work-orders/resolve', async (req, res) => {
  const { property_id, issue_description } = req.body || {};

  if (!property_id || !issue_description) {
    res.status(400).json({ error: 'Missing property_id or issue_description' });
    return;
  }

  // Find and update the matching work order
  const workOrder = await WorkOrderModel.findOneAndUpdate(
    { property_id, issue_description, status: { $nin: ['completed', 'cancelled'] } },
    { status: 'completed' },
    { new: true },
  ).lean();

  // Emit SSE event so all clients (including history replay) know this issue is resolved
  emitSSE('issue_resolved', { property_id, issue_description });

  res.json({
    status: 'ok',
    work_order_updated: !!workOrder,
    property_id,
    issue_description,
  });
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

// ─── Static Files (Production) ───────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardDist = path.resolve(__dirname, '../../dashboard/dist');

if (fs.existsSync(dashboardDist)) {
  app.use(express.static(dashboardDist));
  app.get('*', (req, res) => {
    if (req.accepts('html')) {
      res.sendFile(path.join(dashboardDist, 'index.html'));
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });
}

// ─── Restore Scheduled Tasks ─────────────────────────────────────────────────

async function restoreScheduledTasks(): Promise<void> {
  const pendingTasks = await ScheduledTaskModel.find({ status: 'pending' }).lean();
  if (pendingTasks.length === 0) return;

  let restored = 0;
  for (const task of pendingTasks) {
    const remaining = new Date(task.fires_at).getTime() - Date.now();
    const delayMs = Math.max(remaining, 1000); // At least 1s if overdue

    registerTask(task.task_id, delayMs, async () => {
      console.log(`[SCHEDULER] Restored task ${task.task_id} fired: ${task.description}`);
      await ScheduledTaskModel.updateOne({ task_id: task.task_id }, { status: 'fired' });

      enqueueEvent(
        {
          type: 'scheduled_task',
          source: 'self-scheduled',
          name: `Self-Scheduled: ${task.description.substring(0, 60)}`,
          payload: {
            task_id: task.task_id,
            task_description: task.description,
          },
        },
        DEMO_LANE_ID,
        'demo',
      );
    });
    restored++;
  }
  console.log(`[SCHEDULER] Restored ${restored} pending tasks`);
}

// ─── Stripe Webhook Registration ─────────────────────────────────────────────

async function ensureStripeWebhook(): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('[STRIPE] No STRIPE_SECRET_KEY, skipping webhook registration');
    return;
  }

  const appUrl = process.env.APP_URL || 'https://hackathon.plaibook.tech';
  const webhookUrl = `${appUrl}/stripe/webhook`;

  try {
    // Check if a webhook for this URL already exists
    const existing = await stripeClient.webhookEndpoints.list({ limit: 100 });
    const found = existing.data.find((wh) => wh.url === webhookUrl && wh.status === 'enabled');

    if (found) {
      console.log(`[STRIPE] Webhook already registered: ${webhookUrl}`);
      // Update the local secret to match the registered endpoint
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.warn('[STRIPE] STRIPE_WEBHOOK_SECRET not set — webhook signature verification may fail');
      }
      return;
    }

    // Create a new webhook endpoint
    const endpoint = await stripeClient.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: ['checkout.session.completed'],
    });

    console.log(`[STRIPE] Webhook registered: ${webhookUrl}`);
    console.log(`[STRIPE] Webhook secret: ${endpoint.secret}`);
    console.log(`[STRIPE] ⚠️  Update STRIPE_WEBHOOK_SECRET in .env with the value above if signature verification fails`);

    // Use the new secret for this session if one wasn't already set
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      process.env.STRIPE_WEBHOOK_SECRET = endpoint.secret!;
    }
  } catch (err: any) {
    console.error('[STRIPE] Failed to register webhook (non-fatal):', err.message);
  }
}

// ─── Startup ────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  try {
    await connectDB();

    // Only seed if database is empty (preserves data across restarts)
    if (await shouldSeed()) {
      await seed();
    } else {
      console.log('[DB] Database already seeded, skipping seed');
      await initSSESequence();
      await laneManager.loadAll();
      await loadOwnerSettings();
      await restoreScheduledTasks();
    }

    // Register Stripe webhook endpoint (non-blocking, non-fatal)
    await ensureStripeWebhook();

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  Agentic Property Manager — Server`);
      console.log(`  http://localhost:${PORT}`);
      console.log(`  Provider: ${getProviderConfig().provider} (${getProviderConfig().model})`);
      console.log(`========================================\n`);
    });

    // Start proactive autonomy loops (morning briefing, Ticketmaster polling, checkout follow-ups)
    proactiveHandle = startProactiveLoops((event, laneId, laneType) => {
      enqueueEvent(event, laneId, laneType);
    });
  } catch (err) {
    console.error('[STARTUP] Fatal error:', err);
    process.exit(1);
  }
}

start();
