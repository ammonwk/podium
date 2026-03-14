import { v4 as uuid } from 'uuid';
import type { ReportMaintenanceIssueInput, ReportMaintenanceIssueResult } from '@apm/shared';
import { PropertyModel, VendorModel, WorkOrderModel } from '../shared/db.js';
import { emitChatSSE } from '../shared/chat-sse.js';
import { emitSSE } from '../shared/sse.js';
import { executeSendSms } from './send-sms.js';
import { getOwnerSettings } from '../shared/owner-settings.js';

function getMountainTime(): { day: number; hour: number } {
  const now = new Date();
  const mt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  return { day: mt.getDay(), hour: mt.getHours() };
}

async function findScheduledVendor(category: string) {
  const { day, hour } = getMountainTime();

  const vendors = await VendorModel.find({
    specialty: category,
    status: { $in: ['available', 'on_call'] },
    schedule: { $elemMatch: { day, start_hour: { $lte: hour }, end_hour: { $gt: hour } } },
  })
    .sort({ rating: -1 })
    .lean();

  return vendors[0] ?? null;
}

const SEVERITY_HOURS: Record<string, number> = {
  low: 1.5,
  medium: 2,
  high: 3,
  emergency: 4,
};

export async function executeReportMaintenanceIssue(
  input: ReportMaintenanceIssueInput,
  sessionId?: string,
): Promise<ReportMaintenanceIssueResult> {
  const { property_id, issue_description, category, severity } = input;

  // Look up property
  const property = await PropertyModel.findOne({ id: property_id }).lean();
  if (!property) {
    throw new Error(`Property not found: ${property_id}`);
  }

  const workOrderId = `WO_${uuid().substring(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  // Create pending work order
  await WorkOrderModel.create({
    id: workOrderId,
    property_id,
    vendor_id: 'UNASSIGNED',
    issue_description,
    severity,
    estimated_cost: 0,
    status: 'pending',
    created_at: now,
  });

  console.log(
    `[TOOL:report_maintenance_issue] Created pending ${workOrderId} at ${property.name} (${category}/${severity})`,
  );

  // Broadcast to dashboard SSE stream so the UI updates in real-time
  emitSSE('tool_call', {
    tool_name: 'report_maintenance_issue',
    input,
    result: { work_order_id: workOrderId, property_name: property.name, severity, status: 'pending' },
    event_name: `maintenance_${workOrderId}`,
  });

  // Auto-escalate high/emergency severity to owner
  if (severity === 'high' || severity === 'emergency') {
    const owner = await getOwnerSettings();
    await executeSendSms({
      to: owner.phone,
      body: `\u{1F6A8} ${severity.toUpperCase()} maintenance at ${property.name}: ${issue_description}. Work order ${workOrderId} created.`,
    });
    console.log(`[report_maintenance_issue] Auto-escalated ${severity} issue to owner`);
  }

  // Kick off background vendor matching
  if (sessionId) {
    matchAndDispatchVendor(workOrderId, category, property_id, sessionId).catch((err) => {
      console.error(`[report_maintenance_issue] Background match failed:`, err);
    });
  }

  return {
    work_order_id: workOrderId,
    property_name: property.name,
    severity,
    status: 'pending',
    message: 'Finding the best available vendor...',
  };
}

async function matchAndDispatchVendor(
  workOrderId: string,
  category: string,
  propertyId: string,
  sessionId: string,
): Promise<void> {
  // Small delay to simulate matching and let the agent respond first
  await new Promise((r) => setTimeout(r, 1500));

  const property = await PropertyModel.findOne({ id: propertyId }).lean();
  if (!property) return;

  const workOrder = await WorkOrderModel.findOne({ id: workOrderId }).lean();
  if (!workOrder) return;

  // Find best available vendor whose schedule covers the current time
  const vendor = await findScheduledVendor(category);

  const owner = await getOwnerSettings();

  if (!vendor) {
    // No vendor available — escalate to owner
    console.log(`[report_maintenance_issue] No vendor for ${category}, escalating to owner`);

    await executeSendSms({
      to: owner.phone,
      body: `Maintenance issue at ${property.name}: ${workOrder.issue_description}. No preferred vendor available for ${category}. Please advise.`,
    });

    emitChatSSE(sessionId, 'chat_text', {
      text: "\n\nI've notified the property manager — they'll arrange someone and follow up with you shortly.",
    });
    emitChatSSE(sessionId, 'chat_done', {});
    return;
  }

  // Calculate estimated cost
  const hours = SEVERITY_HOURS[workOrder.severity] || 2;
  const estimatedCost = vendor.hourly_rate * hours;

  // Check auto-approve threshold
  if (estimatedCost > property.auto_approve_threshold) {
    // Over threshold — escalate to owner
    console.log(
      `[report_maintenance_issue] Cost $${estimatedCost} exceeds threshold $${property.auto_approve_threshold}, escalating`,
    );

    await WorkOrderModel.updateOne(
      { id: workOrderId },
      { vendor_id: vendor.id, estimated_cost: estimatedCost },
    );

    await executeSendSms({
      to: owner.phone,
      body: `Maintenance at ${property.name}: ${workOrder.issue_description}. Best vendor: ${vendor.name} ($${estimatedCost} est). Exceeds auto-approve ($${property.auto_approve_threshold}). Please approve or advise.`,
    });

    emitChatSSE(sessionId, 'chat_text', {
      text: "\n\nI've flagged this for the property manager — they'll follow up shortly.",
    });
    emitChatSSE(sessionId, 'chat_done', {});
    return;
  }

  // Under threshold — dispatch vendor
  await WorkOrderModel.updateOne(
    { id: workOrderId },
    { vendor_id: vendor.id, estimated_cost: estimatedCost, status: 'dispatched' },
  );
  await VendorModel.updateOne({ id: vendor.id }, { status: 'busy' });

  console.log(
    `[report_maintenance_issue] Dispatched ${vendor.name} to ${property.name} ($${estimatedCost})`,
  );

  // Notify owner of the dispatch
  await executeSendSms({
    to: owner.phone,
    body: `Dispatched ${vendor.name} to ${property.name} for ${category}: ${workOrder.issue_description}. Est cost $${estimatedCost} (${workOrder.severity}). WO ${workOrderId}.`,
  });

  emitChatSSE(sessionId, 'chat_text', {
    text: `\n\nGreat news — I've dispatched ${vendor.name} to ${property.name}. They should be there shortly!`,
  });
  emitChatSSE(sessionId, 'chat_done', {});
}
