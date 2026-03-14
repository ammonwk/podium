import { v4 as uuid } from 'uuid';
import type { CreateWorkOrderInput, CreateWorkOrderResult } from '@apm/shared';
import { PropertyModel, VendorModel, WorkOrderModel } from '../shared/db.js';

export async function executeCreateWorkOrder(
  input: CreateWorkOrderInput,
): Promise<CreateWorkOrderResult> {
  const { property_id, vendor_id, issue_description, severity, estimated_cost } = input;

  // Look up property
  const property = await PropertyModel.findOne({ id: property_id }).lean();
  if (!property) {
    throw new Error(`Property not found: ${property_id}`);
  }

  // Look up vendor
  const vendor = await VendorModel.findOne({ id: vendor_id }).lean();
  if (!vendor) {
    throw new Error(`Vendor not found: ${vendor_id}`);
  }

  // Guardrail: check auto-approve threshold
  if (estimated_cost > property.auto_approve_threshold) {
    throw new Error(
      `Estimated cost $${estimated_cost} exceeds auto-approve threshold of $${property.auto_approve_threshold} for ${property.name}. ` +
        `Requires owner approval. Escalate to the owner with your recommendation before proceeding.`,
    );
  }

  const workOrderId = `WO_${uuid().substring(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  const workOrder = {
    id: workOrderId,
    property_id,
    vendor_id,
    issue_description,
    severity,
    estimated_cost,
    status: 'dispatched' as const,
    created_at: now,
  };

  await WorkOrderModel.create(workOrder);

  // Mark vendor as busy
  await VendorModel.updateOne({ id: vendor_id }, { status: 'busy' });

  console.log(
    `[TOOL:create_work_order] Created ${workOrderId} — ${vendor.name} dispatched to ${property.name} ($${estimated_cost})`,
  );

  const result: CreateWorkOrderResult = {
    work_order_id: workOrderId,
    vendor_name: vendor.name,
    vendor_rating: vendor.rating,
    estimated_cost,
    severity,
    status: 'dispatched',
    property_name: property.name,
  };

  return result;
}
