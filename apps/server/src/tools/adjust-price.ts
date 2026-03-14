import type { AdjustPriceInput, AdjustPriceResult } from '@apm/shared';
import { PropertyModel } from '../shared/db.js';

export async function executeAdjustPrice(
  input: AdjustPriceInput,
): Promise<AdjustPriceResult> {
  const { property_id, new_price, reason } = input;

  // Look up property
  const property = await PropertyModel.findOne({ id: property_id }).lean();
  if (!property) {
    throw new Error(`Property not found: ${property_id}`);
  }

  // Guardrail: price must be between 50% and 300% of base_price
  const minPrice = property.base_price * 0.5;
  const maxPrice = property.base_price * 3.0;

  if (new_price < minPrice || new_price > maxPrice) {
    throw new Error(
      `Price $${new_price} is outside the allowed range for ${property.name}. ` +
        `Allowed: $${minPrice.toFixed(0)}–$${maxPrice.toFixed(0)} (50%–300% of base price $${property.base_price}).`,
    );
  }

  // Apply weekend/weekday modifier relative to base price
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  let adjustedPrice = new_price;
  if (isWeekend) {
    // Ensure at least a 15% premium above base on weekends
    const weekendFloor = Math.round(property.base_price * 1.15);
    if (adjustedPrice < weekendFloor) {
      adjustedPrice = weekendFloor;
    }
  } else {
    // Weekdays: cap at base price unless there's a surge reason
    const weekdayCeiling = property.base_price;
    if (adjustedPrice > weekdayCeiling && new_price <= property.base_price) {
      adjustedPrice = weekdayCeiling;
    }
  }

  const previousPrice = property.current_price;
  const percentChange =
    (((adjustedPrice - previousPrice) / previousPrice) * 100).toFixed(1) + '%';

  // Update in DB
  await PropertyModel.updateOne({ id: property_id }, { current_price: adjustedPrice });

  console.log(
    `[TOOL:adjust_price] ${property.name}: $${previousPrice} → $${adjustedPrice} (${percentChange}) — ${reason}${adjustedPrice !== new_price ? ` [weekend/weekday adjusted from $${new_price}]` : ''}`,
  );

  const result: AdjustPriceResult = {
    property_id,
    property_name: property.name,
    previous_price: previousPrice,
    new_price: adjustedPrice,
    percent_change: percentChange,
  };

  return result;
}
