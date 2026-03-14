import { PHONE_NUMBERS } from '@apm/shared';

interface OwnerSettings {
  name: string;
  phone: string;
}

let ownerSettings: OwnerSettings = {
  name: 'David Reyes',
  phone: PHONE_NUMBERS.OWNER_DAVID,
};

export function getOwnerSettings(): OwnerSettings {
  return { ...ownerSettings };
}

export function setOwnerSettings(name: string, phone: string): void {
  ownerSettings = { name, phone };
}
