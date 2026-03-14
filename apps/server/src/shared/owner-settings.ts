import { PHONE_NUMBERS } from '@apm/shared';
import { OwnerSettingsModel } from './db.js';

interface OwnerSettings {
  name: string;
  phone: string;
}

// In-memory cache — always serves reads from here for performance
let ownerSettings: OwnerSettings = {
  name: 'David Reyes',
  phone: PHONE_NUMBERS.OWNER_DAVID,
};

export function getOwnerSettings(): OwnerSettings {
  return { ...ownerSettings };
}

export function setOwnerSettings(name: string, phone: string): void {
  ownerSettings = { name, phone };
  // Write-through to MongoDB (fire-and-forget)
  OwnerSettingsModel.updateOne(
    {},
    { $set: { name, phone } },
    { upsert: true },
  ).catch(err => {
    console.error('[OWNER] Failed to persist settings:', err.message);
  });
}

// Load from MongoDB on startup (call once after connectDB)
export async function loadOwnerSettings(): Promise<void> {
  try {
    const doc = await OwnerSettingsModel.findOne().lean();
    if (doc) {
      ownerSettings = { name: doc.name, phone: doc.phone };
      console.log(`[OWNER] Loaded settings: ${doc.name}`);
    } else {
      // Seed defaults to MongoDB
      await OwnerSettingsModel.create(ownerSettings);
      console.log('[OWNER] Seeded default settings');
    }
  } catch (err: any) {
    console.error('[OWNER] Failed to load settings:', err.message);
  }
}
