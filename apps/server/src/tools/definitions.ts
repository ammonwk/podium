import type { LLMToolDefinition } from '@apm/shared';

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
];
