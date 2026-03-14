import { BookingModel, PropertyModel } from '../shared/db.js';
import { normalizePhone } from '../shared/phone-utils.js';

export interface LookupGuestInput {
  guest_phone: string;
}

export interface LookupGuestResult {
  found: boolean;
  bookings: Array<{
    booking_id: string;
    property_id: string;
    property_name: string;
    guest_name: string;
    guest_phone: string;
    check_in: string;
    check_out: string;
    status: string;
  }>;
}

export async function executeLookupGuest(
  input: LookupGuestInput,
): Promise<LookupGuestResult> {
  const normalized = normalizePhone(input.guest_phone);
  if (!normalized) {
    throw new Error(
      `Invalid phone number: "${input.guest_phone}". Please provide a valid US phone number.`,
    );
  }

  const bookings = await BookingModel.find({
    guest_phone: normalized,
    status: { $in: ['active', 'upcoming', 'pending_payment'] },
  }).lean();

  if (bookings.length === 0) {
    return { found: false, bookings: [] };
  }

  // Enrich with property names
  const propertyIds = [...new Set(bookings.map((b) => b.property_id))];
  const properties = await PropertyModel.find({ id: { $in: propertyIds } }).lean();
  const propMap = new Map(properties.map((p) => [p.id, p.name]));

  return {
    found: true,
    bookings: bookings.map((b) => ({
      booking_id: b.id,
      property_id: b.property_id,
      property_name: propMap.get(b.property_id) || b.property_id,
      guest_name: b.guest_name,
      guest_phone: b.guest_phone,
      check_in: b.check_in,
      check_out: b.check_out,
      status: b.status,
    })),
  };
}
