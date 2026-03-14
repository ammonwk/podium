import { v4 as uuid } from 'uuid';
import type { ScheduleTaskInput, ScheduleTaskResult } from '@apm/shared';
import { AGENT_CONFIG } from '@apm/shared';
import { ScheduledTaskModel } from '../shared/db.js';
import { registerTask, getPendingCount } from '../shared/scheduler.js';
import { emitSSE } from '../shared/sse.js';

// Callback registry to avoid circular imports with main.ts
let handleEventCallback: ((event: {
  type: 'scheduled_task';
  source: 'self-scheduled';
  name: string;
  payload: { task_id: string; task_description: string };
}) => void) | null = null;

export function setHandleEventCallback(
  cb: (event: {
    type: 'scheduled_task';
    source: 'self-scheduled';
    name: string;
    payload: { task_id: string; task_description: string };
  }) => void,
): void {
  handleEventCallback = cb;
}

export async function executeScheduleTask(
  input: ScheduleTaskInput,
): Promise<ScheduleTaskResult> {
  const { delay_minutes, task_description, priority } = input;

  // Guardrail: max pending tasks
  if (getPendingCount() >= AGENT_CONFIG.MAX_PENDING_TASKS) {
    throw new Error(
      `Maximum pending tasks (${AGENT_CONFIG.MAX_PENDING_TASKS}) reached. Wait for some to fire or cancel existing tasks.`,
    );
  }

  // Guardrail: max delay
  if (delay_minutes > AGENT_CONFIG.MAX_SCHEDULE_DELAY_MINUTES) {
    throw new Error(
      `Delay ${delay_minutes} minutes exceeds maximum of ${AGENT_CONFIG.MAX_SCHEDULE_DELAY_MINUTES} minutes.`,
    );
  }

  if (delay_minutes <= 0) {
    throw new Error('Delay must be greater than 0 minutes.');
  }

  const taskId = `TASK_${uuid().substring(0, 8).toUpperCase()}`;
  const delayMs = delay_minutes * AGENT_CONFIG.SCHEDULE_DELAY_MULTIPLIER;
  const firesAt = new Date(Date.now() + delayMs).toISOString();

  // Save to DB
  await ScheduledTaskModel.create({
    task_id: taskId,
    description: task_description,
    fires_at: firesAt,
    delay_minutes,
    priority,
    status: 'pending',
  });

  // Register timer
  registerTask(taskId, delayMs, async () => {
    console.log(`[SCHEDULER] Task ${taskId} fired: ${task_description}`);

    // Update status in DB
    await ScheduledTaskModel.updateOne({ task_id: taskId }, { status: 'fired' });

    // Invoke the event handler
    if (handleEventCallback) {
      handleEventCallback({
        type: 'scheduled_task',
        source: 'self-scheduled',
        name: `Self-Scheduled: ${task_description.substring(0, 60)}`,
        payload: {
          task_id: taskId,
          task_description,
        },
      });
    } else {
      console.error('[SCHEDULER] No handleEvent callback registered!');
    }
  });

  // Emit SSE so dashboard can show it
  emitSSE('scheduled_task', {
    task_id: taskId,
    description: task_description,
    fires_at: firesAt,
  });

  console.log(
    `[TOOL:schedule_task] ${taskId} scheduled — fires in ${delayMs}ms (${delay_minutes} demo-minutes): ${task_description}`,
  );

  const result: ScheduleTaskResult = {
    task_id: taskId,
    scheduled_time: firesAt,
    description: task_description,
    fires_in: `${delay_minutes} minutes (${(delayMs / 1000).toFixed(1)}s in demo time)`,
  };

  return result;
}
