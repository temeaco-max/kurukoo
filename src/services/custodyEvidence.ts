export type CustodyEvidenceStage = 'handover_pending' | 'handed_over' | 'collected' | 'delivered' | 'confirmed';
export type CustodyParticipantRole = 'seller' | 'delivery_provider' | 'service_provider' | 'external_platform' | 'agent';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasText(value: unknown): boolean {
  return (typeof value === 'string' || typeof value === 'number') && String(value).trim().length > 0;
}

function hasOneOf(evidence: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => hasText(evidence[key]));
}

/**
 * Enforce the small, shared truth boundary for custody events. It deliberately
 * validates only who may report a handover or physical movement and the minimum
 * durable reference. It does not create a second delivery lifecycle, calculate
 * settlement, or treat a provider report as final outcome completion.
 */
export function validateCustodyEvidenceUpdate(input: {
  role: CustodyParticipantRole;
  status: CustodyEvidenceStage | string;
  isOwner: boolean;
  isDirectParticipant: boolean;
  evidence?: Record<string, unknown>;
}): void {
  const evidence = record(input.evidence);
  const status = String(input.status);

  if (input.role === 'seller' && status === 'handed_over') {
    if (!input.isDirectParticipant) throw new Error('Only the seller may report an item handover.');
    if (!hasOneOf(evidence, ['handover_receipt', 'handover_reference', 'handover_code'])) {
      throw new Error('Seller handover evidence requires a handover receipt, reference, or code.');
    }
  }

  if (input.role === 'delivery_provider' && status === 'collected') {
    if (!input.isDirectParticipant) throw new Error('Only the selected delivery provider may report collection.');
    if (!hasOneOf(evidence, ['collection_receipt', 'collection_reference', 'handover_reference'])) {
      throw new Error('Delivery collection evidence requires a collection receipt or reference.');
    }
  }

  if (input.role === 'delivery_provider' && status === 'delivered') {
    if (!input.isDirectParticipant) throw new Error('Only the selected delivery provider may report delivery.');
    if (!hasOneOf(evidence, ['delivery_receipt', 'delivery_reference', 'recipient_reference', 'tracking_reference'])) {
      throw new Error('Delivery evidence requires a delivery, recipient, or tracking reference.');
    }
  }

  if (status === 'confirmed') {
    if (!input.isOwner) throw new Error('Only the economic request owner may confirm a custody event.');
    if (!hasOneOf(evidence, ['recipient_confirmation', 'owner_confirmation', 'confirmation_reference'])) {
      throw new Error('Custody confirmation requires an owner or recipient confirmation reference.');
    }
  }
}
