import type { EscalateToOwnerInput, EscalateToOwnerResult } from '@apm/shared';
import { PropertyModel } from '../shared/db.js';
import { getOwnerSettings } from '../shared/owner-settings.js';
import { executeSendSms } from './send-sms.js';

export async function executeEscalateToOwner(
  input: EscalateToOwnerInput,
): Promise<EscalateToOwnerResult> {
  const { summary, severity, property_id } = input;

  const owner = await getOwnerSettings();

  let propertyContext = '';
  if (property_id) {
    const property = await PropertyModel.findOne({ id: property_id }).lean();
    if (property) {
      propertyContext = ` at ${property.name}`;
    }
  }

  const emoji = severity === 'emergency' ? '\u{1F6A8}' : '\u{26A0}\u{FE0F}';
  const body = `${emoji} ${severity.toUpperCase()}${propertyContext}: ${summary}`;

  await executeSendSms({ to: owner.phone, body });

  console.log(`[TOOL:escalate_to_owner] Sent ${severity} escalation to ${owner.name}: ${summary}`);

  return {
    status: 'sent',
    owner_name: owner.name,
    timestamp: new Date().toISOString(),
    summary_sent: summary,
  };
}
