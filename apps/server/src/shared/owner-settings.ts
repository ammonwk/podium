import { PHONE_NUMBERS } from '@apm/shared';
import { OwnerSettingsModel } from './db.js';

interface OwnerSettings {
  name: string;
  phone: string;
}

// In-memory cache — always serves reads from here for performance
let cache: OwnerSettings = {
  name: 'David Reyes',
  phone: PHONE_NUMBERS.OWNER_DAVID,
};

/**
 * Load owner settings from MongoDB on startup (call once after connectDB).
 * Exported as both `initOwnerSettings` and `loadOwnerSettings` for compatibility.
 */
export async function loadOwnerSettings(): Promise<void> {
  try {
    const doc = await OwnerSettingsModel.findOne().lean();
    if (doc) {
      cache = { name: doc.name, phone: doc.phone };
      console.log(`[OWNER] Loaded settings: ${doc.name}`);
    } else {
      // Seed defaults to MongoDB
      await OwnerSettingsModel.create(cache);
      console.log('[OWNER] Seeded default settings');
    }
  } catch (err: any) {
    console.error('[OWNER] Failed to load settings:', err.message);
  }
}

export const initOwnerSettings = loadOwnerSettings;

export async function getOwnerSettings(): Promise<OwnerSettings> {
  return { ...cache };
}

export async function setOwnerSettings(name: string, phone: string): Promise<void> {
  await OwnerSettingsModel.updateOne(
    {},
    { $set: { name, phone } },
    { upsert: true },
  );
  cache = { name, phone };
}
