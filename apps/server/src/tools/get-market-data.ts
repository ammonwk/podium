import type { GetMarketDataInput, GetMarketDataResult } from '@apm/shared';
import { PROPERTY_IDS } from '@apm/shared';
import { PropertyModel } from '../shared/db.js';

export async function executeGetMarketData(
  input: GetMarketDataInput,
): Promise<GetMarketDataResult> {
  const location = input.location.toLowerCase().trim();

  if (location.includes('park city')) {
    // Park City market data
    const prop1 = await PropertyModel.findOne({
      id: PROPERTY_IDS.OCEANVIEW_COTTAGE,
    }).lean();
    const prop2 = await PropertyModel.findOne({
      id: PROPERTY_IDS.MOUNTAIN_LOFT,
    }).lean();

    const avgRate = 310;
    const yourProperties = [];

    if (prop1) {
      const gap = prop1.current_price - avgRate;
      yourProperties.push({
        id: prop1.id,
        name: prop1.name,
        current_price: prop1.current_price,
        gap:
          gap < 0
            ? `$${Math.abs(gap)} below market avg`
            : gap > 0
              ? `$${gap} above market avg`
              : 'at market avg',
      });
    }
    if (prop2) {
      const gap = prop2.current_price - avgRate;
      yourProperties.push({
        id: prop2.id,
        name: prop2.name,
        current_price: prop2.current_price,
        gap:
          gap < 0
            ? `$${Math.abs(gap)} below market avg`
            : gap > 0
              ? `$${gap} above market avg`
              : 'at market avg',
      });
    }

    console.log(`[TOOL:get_market_data] Park City — avg $${avgRate}, 94% occupancy`);

    const result: GetMarketDataResult = {
      location: 'Park City, UT',
      avg_competitor_rate: avgRate,
      occupancy_percent: 94,
      local_events:
        'Park City Jazz Festival this weekend — high demand expected',
      your_properties: yourProperties,
    };

    return result;
  }

  if (location.includes('moab')) {
    const prop3 = await PropertyModel.findOne({
      id: PROPERTY_IDS.CANYON_HOUSE,
    }).lean();

    const avgRate = 270;
    const yourProperties = [];

    if (prop3) {
      const gap = prop3.current_price - avgRate;
      yourProperties.push({
        id: prop3.id,
        name: prop3.name,
        current_price: prop3.current_price,
        gap:
          gap < 0
            ? `$${Math.abs(gap)} below market avg`
            : gap > 0
              ? `$${gap} above market avg`
              : 'at market avg',
      });
    }

    console.log(`[TOOL:get_market_data] Moab — avg $${avgRate}, 71% occupancy`);

    const result: GetMarketDataResult = {
      location: 'Moab, UT',
      avg_competitor_rate: avgRate,
      occupancy_percent: 71,
      local_events: 'No major events this weekend',
      your_properties: yourProperties,
    };

    return result;
  }

  // Unknown location — generic response
  console.log(`[TOOL:get_market_data] Unknown location: ${input.location}`);

  const result: GetMarketDataResult = {
    location: input.location,
    avg_competitor_rate: 270,
    occupancy_percent: 71,
    local_events: 'No market data available for this location',
    your_properties: [],
  };

  return result;
}
