# VibePM

**An autonomous AI property manager that runs your short-term rental portfolio while you sleep.**

---

## The Problem

Managing short-term rental properties is a relentless, fragmented job. Every day brings a flood of decisions that need to happen fast and in coordination:

- **Dynamic pricing is a guessing game.** A music festival gets announced 20 miles away and you find out two days late. Your competitor raised rates by 30% while your units sat at base price. Conversely, you have empty midweek nights nobody's booking because you didn't drop the rate in time.

- **Guest communication never stops.** Texts come in at 2 AM asking for the WiFi password. A prospective guest wants to book but you're at dinner. A current guest reports a broken pipe and expects an immediate response. Every unanswered message is a potential bad review.

- **Maintenance coordination is a chain reaction.** A plumber needs to come fix a leak, which pushes the cleaning crew's start time, which pushes the next guest's check-in, which means you need to text that guest a new arrival time. Miss one link in the chain and someone shows up to a dirty unit.

- **Checkout follow-ups don't happen.** You mean to send a thank-you text and ask for a review, but by the time checkout rolls around you're already dealing with the next check-in. Those reviews that build your listing's ranking just don't get collected.

- **Nothing scales.** At 2-3 properties, you can maybe keep it all in your head. At 5+, you're drowning. Hiring a human property manager costs $2,000-4,000/month and still requires your oversight.

This isn't a hypothetical problem. Our team lives it. We manage properties in Utah and know firsthand that the difference between a 4.2-star and a 4.8-star listing is often just response time and operational consistency -- things humans are bad at maintaining under load.

---

## The Solution

VibePM is an AI agent named **Alex** that autonomously operates a short-term rental portfolio with **zero human in the loop**. Alex doesn't wait to be told what to do. Alex identifies what needs doing and does it.

### What Alex Does Autonomously

**Proactive Market Intelligence**
Alex polls Ticketmaster every few minutes for events near your properties. When a jazz festival or basketball game is announced, Alex doesn't just alert you -- Alex analyzes the demand impact, checks competitor rates, evaluates which units are available, and adjusts pricing automatically. Weekend premiums, event surges, and vacancy discounts are all handled with guardrails (prices stay within 50-300% of base rate).

**Morning Briefings**
Every day on startup, Alex reviews the day's bookings and takes action. Guests checking in today get a personalized SMS with their door code, WiFi password, and parking instructions -- before they even think to ask. Schedule conflicts are flagged and resolved. No human reminder needed.

**Guest Communication via Real SMS**
When a guest texts about a broken faucet at midnight, Alex reads the message, looks up their booking, assesses the issue's severity, finds the best available vendor (highest-rated + currently on shift), checks the estimated cost against the property's auto-approve threshold, dispatches the vendor or escalates to the owner, texts the guest a reassurance, and schedules a follow-up check -- all in one autonomous loop. The guest gets a response in seconds, not hours.

**Vendor Dispatch with Cost Guardrails**
Alex maintains relationships with 10 vendors across plumbing, electrical, HVAC, cleaning, and general maintenance. Vendor selection considers rating, hourly rate, availability windows, and specialty match. If the estimated repair cost is under the property's auto-approve limit, Alex dispatches immediately. If it's over, Alex escalates to the owner with a summary and recommendation -- never leaving the guest hanging.

**Schedule Coordination**
The cleaning crew handles two Park City properties back-to-back with a 30-minute drive between them. Alex traces the full dependency chain before making any schedule change: PROP_002 cleaning end, plus 30 min drive, equals PROP_001 cleaning start, plus 2 hours cleaning, equals earliest check-in time. If a link breaks, Alex restructures the chain and notifies affected guests proactively.

**Post-Checkout Follow-ups**
When a guest's checkout time passes, Alex automatically sends a warm, personalized thank-you SMS and requests a review. This happens every time, for every guest, without anyone remembering to do it.

**Payment Processing**
Alex generates Stripe payment links immediately after creating a booking and shares them with the guest in-chat. When payment completes, a webhook triggers a confirmation event that Alex handles -- sending the guest a payment receipt and reservation confirmation via SMS.

**Self-Scheduled Follow-Through**
Alex schedules its own follow-up tasks: checking back on a vendor dispatch, compiling an owner briefing after a busy period, verifying a guest received their check-in instructions. No human needs to set reminders. After 4+ events, Alex proactively schedules a portfolio briefing where it re-evaluates earlier decisions and recommends adjustments.

**Decision Logging & Transparency**
Every decision Alex makes is logged with full reasoning, confidence level, alternatives considered, and caveats. The property owner can review the decision trail at any time through the real-time dashboard.

---

## How It Works

### Architecture

VibePM is built as a **Turborepo monorepo** with three packages:

- **`apps/server`** -- Express backend with the AI agent, tool executor, lane-based concurrency, and real-time SSE event system
- **`apps/dashboard`** -- React dashboard with Three.js 3D property visualization, real-time activity feed, and live agent thinking display
- **`packages/shared`** -- Shared TypeScript types, constants, and tool schemas

### The Agent Loop

Alex runs on Claude (Anthropic) with extended thinking enabled. The core loop:

1. An event arrives (SMS, market alert, scheduled task, or proactive system event)
2. The event is formatted with full context (booking lookup, property state, conversation history)
3. Alex streams a response with visible reasoning, calling tools as needed
4. Tool results feed back into the loop -- Alex can chain multiple actions per event (up to 10 iterations)
5. Every tool call, thinking block, and decision streams to the dashboard via SSE in real-time

### 15 Autonomous Tools

| Tool | What It Does |
|------|-------------|
| `send_sms` | Send real SMS to guests, vendors, or the owner |
| `report_maintenance_issue` | Auto-dispatch best vendor by specialty + rating + availability |
| `create_work_order` | Manual vendor dispatch with cost threshold enforcement |
| `escalate_to_owner` | Emergency escalation for safety or legal situations |
| `adjust_price` | Dynamic pricing with weekend/weekday and event-driven guardrails |
| `get_market_data` | Query competitor rates, occupancy, and local events via Ticketmaster |
| `log_decision` | Record reasoning, confidence, and alternatives for every decision |
| `update_schedule` | Reschedule events with dependency chain tracing |
| `schedule_task` | Self-schedule follow-up actions (up to 60 min delay) |
| `create_booking` | Book guests with date validation and conflict checking |
| `edit_booking` | Modify existing reservations |
| `lookup_guest` | Find guest bookings by phone number |
| `get_property_status` | Check all properties, availability, and current state |
| `query_database` | Read-only MongoDB queries for analytics and reporting |
| `send_payment_link` | Generate Stripe checkout links for booking payment |

### Proactive Autonomy (No Human Trigger)

Three background systems run independently of any user action:

- **Ticketmaster Polling** -- Scans for high-impact events near each property every 3 minutes. Injects market alerts into the agent loop for autonomous pricing decisions.
- **Morning Routine** -- On startup, reviews all bookings, sends check-in instructions to arriving guests, flags schedule conflicts.
- **Checkout Monitor** -- Detects when guests' checkout times pass and triggers personalized thank-you messages and review requests.

All proactive actions appear in the dashboard timeline with a **SYSTEM** badge, showing full agent reasoning and tool calls -- demonstrating genuine autonomous initiative.

### Multi-Role Chat Interface

Three chat personas with role-based tool access:

- **Prospective Guest** -- Can browse properties, create bookings, make payments
- **Current Occupant** -- Can report maintenance issues, escalate emergencies
- **Property Owner** -- Can query the database for financials, occupancy, and operational data

### Reliability

- **Multi-LLM support** with circuit breaker failover (Anthropic primary, Cerebras fallback, OpenRouter as last resort)
- **Lane-based concurrency** -- each phone number gets its own serial processing lane; different guests are handled in parallel
- **Mutating tool deduplication** -- prevents double-dispatching vendors, double-booking, or sending duplicate SMS across loop iterations
- **Persistent conversation history** in MongoDB with restore-on-restart

---

## Mapping to Judging Criteria

### Autonomy (40%)

This is the core design philosophy. VibePM was built around a single question: **can we remove the human from the loop entirely?**

- Alex operates with **zero human intervention** for the vast majority of decisions -- pricing, guest communication, vendor dispatch, scheduling, and follow-ups all happen autonomously
- **Proactive, not just reactive:** Alex doesn't wait for events. It polls Ticketmaster for market intelligence, runs morning briefings on startup, monitors checkout times, and schedules its own follow-up tasks
- **Self-reflection:** After busy periods, Alex schedules a portfolio briefing where it re-evaluates its own earlier decisions and recommends course corrections
- **Guardrails, not gatekeepers:** Cost thresholds, price bounds, and severity-based escalation rules ensure Alex makes safe decisions without requiring approval for routine operations. Only genuinely uncertain or high-stakes situations get escalated to the owner
- **12 decision principles** embedded in the system prompt give Alex a framework for judgment calls -- not rigid rules, but a way of thinking about tradeoffs (ratings vs. revenue, speed vs. cost, transparency vs. guest experience)

### Value (30%)

- **Real problem, real market.** Short-term rental management is a $100B+ industry where operational consistency directly drives revenue through ratings and occupancy
- **Quantifiable impact:** A human property manager costs $2,000-4,000/month. Alex handles the same workload 24/7 at a fraction of the cost with faster response times
- **Revenue optimization:** Dynamic pricing based on real Ticketmaster event data, weekend premiums, and vacancy filling. Every empty night at full price is worse than a booked night at a discount -- Alex understands this tradeoff
- **Rating protection:** Alex won't surge-price a unit with an active maintenance issue. It prioritizes long-term reputation over short-term revenue
- **End-to-end payment flow:** Stripe integration means bookings go from inquiry to paid confirmation without a human touching anything

### Technical Complexity (20%)

- **Agentic loop with extended thinking** -- Claude streams reasoning in real-time, chains up to 10 tool-call iterations per event, and exposes its thinking on the dashboard
- **Lane-based concurrency** -- per-phone serial processing with cross-lane parallelism, preventing race conditions while maximizing throughput
- **Real-time SSE architecture** -- event hydration from MongoDB on page load, then live streaming. Dashboard never misses an event, even across refreshes
- **Three.js 3D property visualization** -- interactive property village rendered in the browser
- **Multi-LLM with circuit breaker** -- automatic failover across Anthropic, Cerebras, and OpenRouter with provider switching at runtime
- **Mutating tool deduplication** -- tracks tool call signatures across loop iterations to prevent idempotency violations
- **Stripe webhook integration** -- raw body verification, booking status updates, and autonomous payment confirmation via the agent loop
- **Proactive background systems** -- three independent polling/scheduling loops that inject events into the agent pipeline without any user trigger

### Demo + Presentation (10%)

- **Live agent reasoning** -- watch Alex think in real-time as extended thinking blocks stream to the dashboard
- **Real SMS delivery** -- send a text to the demo number and watch Alex respond live
- **Proactive events on startup** -- within seconds of launching, the morning briefing fires and Alex starts taking autonomous action before anyone touches a button
- **Full activity feed** -- every SMS, price change, work order, schedule update, and decision appears in a real-time feed with color-coded cards
- **3D property village** -- visual property overview with occupancy status, pricing, and emergency indicators
