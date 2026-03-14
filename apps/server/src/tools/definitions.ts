import type { LLMToolDefinition } from '@apm/shared';
import { TOOL_NAMES } from '@apm/shared';

export const toolDefinitions: LLMToolDefinition[] = [
  {
    name: 'send_sms',
    description:
      'Send an SMS message to a guest, vendor, or the property owner. Returns delivery status, recipient name, and message preview. Only known phone numbers (guests with active/upcoming bookings, vendors, or the owner) are allowed.',
    input_schema: {
      type: 'object',
      required: ['to', 'body'],
      properties: {
        to: {
          type: 'string',
          description:
            'Phone number in E.164 format (e.g., +18015550001). Must be a known guest, vendor, or the owner.',
        },
        body: {
          type: 'string',
          description:
            'Message body. Keep under 300 characters when possible. Write like a friendly property manager — use contractions, casual punctuation, no bullet points.',
        },
      },
    },
  },
  {
    name: 'create_work_order',
    description:
      'Dispatch a vendor for a maintenance issue at a property. Returns the work order ID, vendor details, estimated cost, and status. Will be rejected if estimated cost exceeds the property\'s auto-approve threshold — in that case, escalate to the owner.',
    input_schema: {
      type: 'object',
      required: [
        'property_id',
        'vendor_id',
        'issue_description',
        'severity',
        'estimated_cost',
      ],
      properties: {
        property_id: {
          type: 'string',
          description: 'Property ID (e.g., PROP_001)',
        },
        vendor_id: {
          type: 'string',
          description: 'Vendor ID (e.g., VENDOR_001)',
        },
        issue_description: {
          type: 'string',
          description: 'Detailed description of the maintenance issue',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'emergency'],
          description: 'Issue severity level',
        },
        estimated_cost: {
          type: 'number',
          description: 'Estimated total cost in dollars',
        },
      },
    },
  },
  {
    name: 'adjust_price',
    description:
      'Change the nightly price for a property. Returns the old price, new price, and percent change. Prices must be between 50% and 300% of the property\'s base price or the change will be rejected.',
    input_schema: {
      type: 'object',
      required: ['property_id', 'new_price', 'reason'],
      properties: {
        property_id: {
          type: 'string',
          description: 'Property ID (e.g., PROP_001)',
        },
        new_price: {
          type: 'number',
          description: 'New nightly price in dollars',
        },
        reason: {
          type: 'string',
          description: 'Explanation for the price change (logged for the owner)',
        },
      },
    },
  },
  {
    name: 'log_decision',
    description:
      'Record a decision with full reasoning. These feed the dashboard and the owner report. Include numbers, tradeoffs, alternatives you rejected, and a confidence caveat. Returns the decision ID and timestamp.',
    input_schema: {
      type: 'object',
      required: [
        'category',
        'summary',
        'reasoning',
        'confidence',
        'confidence_caveat',
      ],
      properties: {
        category: {
          type: 'string',
          enum: ['communications', 'operations', 'pricing', 'escalation'],
          description: 'Decision category',
        },
        summary: {
          type: 'string',
          description: 'One-line summary of what you decided',
        },
        reasoning: {
          type: 'string',
          description:
            'Full reasoning: what you considered, what alternatives you rejected, why you chose this path',
        },
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Your confidence level in this decision',
        },
        confidence_caveat: {
          type: 'string',
          description:
            'What would change your confidence level — one line explaining the key uncertainty',
        },
        property_id: {
          type: 'string',
          description: 'Property ID if this decision relates to a specific property',
        },
      },
    },
  },
  {
    name: 'get_market_data',
    description:
      'Retrieve current market data for a location including competitor rates, occupancy, local events, and how your properties compare. Returns averages, your property prices, and the gap to market.',
    input_schema: {
      type: 'object',
      required: ['location'],
      properties: {
        location: {
          type: 'string',
          description:
            'Location to query (e.g., "Park City" or "Moab")',
        },
      },
    },
  },
  {
    name: 'update_schedule',
    description:
      'Modify a scheduled event (checkout, cleaning, check-in, maintenance) at a property. Returns the old and new times plus a downstream impact analysis. For Park City properties, this traces the cleaning crew chain automatically.',
    input_schema: {
      type: 'object',
      required: [
        'property_id',
        'event_type',
        'original_time',
        'new_time',
        'reason',
      ],
      properties: {
        property_id: {
          type: 'string',
          description: 'Property ID (e.g., PROP_001)',
        },
        event_type: {
          type: 'string',
          enum: ['checkout', 'cleaning', 'checkin', 'maintenance'],
          description: 'Type of schedule event to update',
        },
        original_time: {
          type: 'string',
          description: 'Original start time in ISO 8601 format',
        },
        new_time: {
          type: 'string',
          description: 'New start time in ISO 8601 format',
        },
        reason: {
          type: 'string',
          description: 'Explanation for the schedule change',
        },
      },
    },
  },
  {
    name: 'schedule_task',
    description:
      'Schedule a self-initiated task to fire after a delay. Use this for follow-ups, check-ins, owner briefings, or anything you want to handle later. The task will appear as a self-scheduled event in the timeline. Max delay: 60 minutes. Max pending tasks: 10.',
    input_schema: {
      type: 'object',
      required: ['delay_minutes', 'task_description', 'priority'],
      properties: {
        delay_minutes: {
          type: 'number',
          description:
            'Minutes from now until the task fires (max 60). In demo mode, time is compressed: 1 minute = 0.5 seconds.',
        },
        task_description: {
          type: 'string',
          description:
            'What this task should do when it fires. Be specific — your future self will read this as the event prompt.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Task priority level',
        },
      },
    },
  },
  {
    name: 'create_booking',
    description:
      'Create a new booking for a guest at a property. Maximum stay is 7 nights. Returns booking confirmation with property details and price estimate. Will be rejected if dates overlap an existing booking on the same property.',
    input_schema: {
      type: 'object',
      required: ['property_id', 'guest_name', 'guest_phone', 'check_in', 'check_out'],
      properties: {
        property_id: {
          type: 'string',
          description: 'Property ID (e.g., PROP_001)',
        },
        guest_name: {
          type: 'string',
          description: 'Full name of the guest',
        },
        guest_phone: {
          type: 'string',
          description: 'Guest phone number in E.164 format (e.g., +18015551234)',
        },
        check_in: {
          type: 'string',
          description: 'Check-in date in YYYY-MM-DD format. Platform enforces 3 PM check-in.',
        },
        check_out: {
          type: 'string',
          description: 'Check-out date in YYYY-MM-DD format. Platform enforces 11 AM check-out.',
        },
      },
    },
  },
  {
    name: 'edit_booking',
    description:
      'Edit an existing active or upcoming booking. Finds the booking by guest phone number. If the guest has multiple bookings, provide property_id to disambiguate. Maximum stay is 7 nights. Will be rejected if new dates overlap another booking.',
    input_schema: {
      type: 'object',
      required: ['guest_phone'],
      properties: {
        guest_phone: {
          type: 'string',
          description: 'Guest phone number in E.164 format — used to find the booking',
        },
        property_id: {
          type: 'string',
          description: 'Property ID to disambiguate if the guest has multiple bookings',
        },
        new_check_in: {
          type: 'string',
          description: 'New check-in date in YYYY-MM-DD format. Platform enforces 3 PM check-in.',
        },
        new_check_out: {
          type: 'string',
          description: 'New check-out date in YYYY-MM-DD format. Platform enforces 11 AM check-out.',
        },
        new_property_id: {
          type: 'string',
          description: 'Move booking to a different property (property ID)',
        },
      },
    },
  },
  {
    name: 'lookup_guest',
    description:
      'Look up a guest\'s active or upcoming booking(s) by their phone number. Returns booking details including property, dates, and status. Use this when a guest provides their phone number and wants to check their reservation.',
    input_schema: {
      type: 'object',
      required: ['guest_phone'],
      properties: {
        guest_phone: {
          type: 'string',
          description:
            'Guest phone number in E.164 format (e.g., +13853350806). Normalize before calling.',
        },
      },
    },
  },
  {
    name: 'get_property_status',
    description:
      'Get current status of one or all properties including bookings, schedule events, and available date windows. Returns property details, active/upcoming bookings, scheduled events, and open windows for booking.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: {
          type: 'string',
          description:
            'Property ID to filter to one property (e.g., PROP_001). Omit to get all properties.',
        },
        check_availability_start: {
          type: 'string',
          description:
            'Start of date window to compute availability in YYYY-MM-DD format. Defaults to today.',
        },
        check_availability_end: {
          type: 'string',
          description:
            'End of date window to compute availability in YYYY-MM-DD format. Defaults to 30 days from today.',
        },
      },
    },
  },
  {
    name: 'query_database',
    description:
      'Query the property management database. Supports read-only find and aggregate operations on whitelisted collections. Use find for specific records and aggregate for summaries, counts, averages, and grouped data. Results are capped at 50 documents.',
    input_schema: {
      type: 'object',
      required: ['collection', 'operation'],
      properties: {
        collection: {
          type: 'string',
          enum: ['bookings', 'properties', 'workorders', 'scheduleevents', 'decisions', 'vendors', 'scheduledtasks'],
          description: 'The collection to query',
        },
        operation: {
          type: 'string',
          enum: ['find', 'aggregate'],
          description: 'Query operation: "find" for filtering documents, "aggregate" for pipelines (group, sum, avg, etc.)',
        },
        filter: {
          type: 'object',
          description: 'MongoDB query filter (for find operations). Example: { "status": "active" }',
        },
        pipeline: {
          type: 'array',
          description: 'MongoDB aggregation pipeline stages (for aggregate operations). Example: [{ "$group": { "_id": "$status", "count": { "$sum": 1 } } }]',
        },
        sort: {
          type: 'object',
          description: 'Sort specification. Example: { "created_at": -1 }',
        },
        limit: {
          type: 'number',
          description: 'Maximum documents to return (default and max: 50)',
        },
      },
    },
  },
  {
    name: 'escalate_to_owner',
    description:
      'Escalate a non-maintenance emergency or urgent situation to the property owner via SMS. Use for safety hazards (fire, gas leak, intruder), guest distress, or situations requiring immediate owner intervention that are not maintenance issues.',
    input_schema: {
      type: 'object',
      required: ['summary', 'severity'],
      properties: {
        summary: {
          type: 'string',
          description: 'AI-written description of the emergency or urgent situation',
        },
        severity: {
          type: 'string',
          enum: ['high', 'emergency'],
          description: 'Severity level: high (urgent owner attention needed) or emergency (immediate safety concern)',
        },
        property_id: {
          type: 'string',
          description: 'Property ID if the situation is at a specific property (e.g., PROP_001)',
        },
      },
    },
  },
  {
    name: 'report_maintenance_issue',
    description:
      'Report a maintenance issue at a property on behalf of a guest. Creates a work order and automatically finds and dispatches the best available vendor. Returns a pending status immediately — the vendor matching happens in the background and the guest will be updated via chat.',
    input_schema: {
      type: 'object',
      required: ['property_id', 'issue_description', 'category', 'severity'],
      properties: {
        property_id: {
          type: 'string',
          description: 'Property ID (e.g., PROP_001)',
        },
        issue_description: {
          type: 'string',
          description: 'Detailed description of the maintenance issue as reported by the guest',
        },
        category: {
          type: 'string',
          enum: ['plumbing', 'electrical', 'hvac', 'cleaning', 'general'],
          description: 'Category of the maintenance issue',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'emergency'],
          description: 'Severity level: low (cosmetic), medium (comfort), high (significant impact), emergency (safety/water/fire)',
        },
      },
    },
  },
  {
    name: 'send_payment_link',
    description:
      'Generate a Stripe payment link for an existing booking, automatically send it to the guest via SMS, and return the URL. The guest can click it to pay for their stay. Returns the payment URL and total amount. You do NOT need to send a separate SMS with the link — it is sent automatically. Will not create a duplicate link if one already exists for the booking.',
    input_schema: {
      type: 'object',
      required: ['booking_id'],
      properties: {
        booking_id: {
          type: 'string',
          description: 'Booking ID (e.g., BOOK_101) to generate a payment link for',
        },
      },
    },
  },
];

export const ALL_TOOLS = toolDefinitions;

export const CHAT_BOOKING_TOOLS: LLMToolDefinition[] = toolDefinitions.filter((t) =>
  [
    TOOL_NAMES.CREATE_BOOKING,
    TOOL_NAMES.EDIT_BOOKING,
    TOOL_NAMES.GET_PROPERTY_STATUS,
    TOOL_NAMES.LOOKUP_GUEST,
    TOOL_NAMES.SEND_PAYMENT_LINK,
  ].includes(t.name as any),
);

export const CHAT_OWNER_TOOLS: LLMToolDefinition[] = toolDefinitions.filter((t) =>
  [TOOL_NAMES.QUERY_DATABASE].includes(t.name as any),
);

export const CHAT_OCCUPANT_TOOLS: LLMToolDefinition[] = toolDefinitions.filter((t) =>
  [TOOL_NAMES.REPORT_MAINTENANCE_ISSUE, TOOL_NAMES.LOOKUP_GUEST, TOOL_NAMES.ESCALATE_TO_OWNER].includes(t.name as any),
);

export const NO_TOOLS: LLMToolDefinition[] = [];
