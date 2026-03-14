import type { QueryDatabaseInput, QueryDatabaseResult } from '@apm/shared';
import {
  BookingModel,
  PropertyModel,
  WorkOrderModel,
  ScheduleEventModel,
  DecisionModel,
  VendorModel,
  ScheduledTaskModel,
} from '../shared/db.js';
import type { Model, PipelineStage, SortOrder } from 'mongoose';

const MAX_RESULTS = 50;

const collectionMap: Record<string, Model<any>> = {
  bookings: BookingModel,
  properties: PropertyModel,
  workorders: WorkOrderModel,
  scheduleevents: ScheduleEventModel,
  decisions: DecisionModel,
  vendors: VendorModel,
  scheduledtasks: ScheduledTaskModel,
};

export async function executeQueryDatabase(
  input: QueryDatabaseInput,
): Promise<QueryDatabaseResult> {
  const model = collectionMap[input.collection];
  if (!model) {
    throw new Error(
      `Unknown collection: "${input.collection}". Allowed: ${Object.keys(collectionMap).join(', ')}`,
    );
  }

  const limit = Math.min(input.limit ?? MAX_RESULTS, MAX_RESULTS);

  let results: Record<string, unknown>[];

  if (input.operation === 'aggregate') {
    const pipeline = Array.isArray(input.pipeline) ? [...input.pipeline] : [];

    // Append a $limit stage if none present
    const hasLimit = pipeline.some((stage) => '$limit' in stage);
    if (!hasLimit) {
      pipeline.push({ $limit: limit });
    }

    results = await model.aggregate(pipeline as unknown as PipelineStage[]);
  } else {
    // find
    const filter = input.filter ?? {};
    const sort = (input.sort ?? {}) as Record<string, SortOrder>;
    results = await model.find(filter).sort(sort).limit(limit).lean();
  }

  return {
    collection: input.collection,
    operation: input.operation,
    count: results.length,
    results,
  };
}
