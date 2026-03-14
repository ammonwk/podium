import { v4 as uuid } from 'uuid';
import type { LogDecisionInput, LogDecisionResult } from '@apm/shared';
import { DecisionModel } from '../shared/db.js';

export async function executeLogDecision(
  input: LogDecisionInput,
): Promise<LogDecisionResult> {
  const { category, summary, reasoning, confidence, confidence_caveat, property_id } =
    input;

  const decisionId = `DEC_${uuid().substring(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  await DecisionModel.create({
    id: decisionId,
    timestamp: now,
    tool: 'log_decision',
    input: { category, summary, property_id },
    result: { reasoning, confidence_caveat },
    reasoning,
    confidence,
    category,
  });

  console.log(
    `[TOOL:log_decision] ${decisionId} [${category}/${confidence}] ${summary}`,
  );

  const result: LogDecisionResult = {
    decision_id: decisionId,
    timestamp: now,
    category,
    summary,
  };

  return result;
}
