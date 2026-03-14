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

  const previousPrice = property.current_price;
  const percentChange =
    (((new_price - previousPrice) / previousPrice) * 100).toFixed(1) + '%';

  // Update in DB
  await PropertyModel.updateOne({ id: property_id }, { current_price: new_price });

  console.log(
    `[TOOL:adjust_price] ${property.name}: $${previousPrice} → $${new_price} (${percentChange}) — ${reason}`,
  );

  const result: AdjustPriceResult = {
    property_id,
    property_name: property.name,
    previous_price: previousPrice,
    new_price,
    percent_change: percentChange,
  };

  return result;
}
