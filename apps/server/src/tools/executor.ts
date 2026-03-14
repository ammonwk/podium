import { TOOL_NAMES } from '@apm/shared';
import { executeSendSms } from './send-sms.js';
import { executeCreateWorkOrder } from './create-work-order.js';
import { executeAdjustPrice } from './adjust-price.js';
import { executeLogDecision } from './log-decision.js';
import { executeGetMarketData } from './get-market-data.js';
import { executeUpdateSchedule } from './update-schedule.js';
import { executeScheduleTask } from './schedule-task.js';
import { executeCreateBooking } from './create-booking.js';
import { executeEditBooking } from './edit-booking.js';
import { executeGetPropertyStatus } from './get-property-status.js';
import { executeLookupGuest } from './lookup-guest.js';
import { executeQueryDatabase } from './query-database.js';

type ToolExecutor = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

const registry: Record<string, ToolExecutor> = {
  [TOOL_NAMES.SEND_SMS]: (input) =>
    executeSendSms(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.CREATE_WORK_ORDER]: (input) =>
    executeCreateWorkOrder(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.ADJUST_PRICE]: (input) =>
    executeAdjustPrice(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.LOG_DECISION]: (input) =>
    executeLogDecision(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.GET_MARKET_DATA]: (input) =>
    executeGetMarketData(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.UPDATE_SCHEDULE]: (input) =>
    executeUpdateSchedule(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.SCHEDULE_TASK]: (input) =>
    executeScheduleTask(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.CREATE_BOOKING]: (input) =>
    executeCreateBooking(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.EDIT_BOOKING]: (input) =>
    executeEditBooking(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.GET_PROPERTY_STATUS]: (input) =>
    executeGetPropertyStatus(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.LOOKUP_GUEST]: (input) =>
    executeLookupGuest(input as any) as unknown as Promise<Record<string, unknown>>,
  [TOOL_NAMES.QUERY_DATABASE]: (input) =>
    executeQueryDatabase(input as any) as unknown as Promise<Record<string, unknown>>,
};

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const executor = registry[name];
  if (!executor) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return executor(input);
}
