export enum HousekeepingChecklistKey {
  BED = 'BED',
  BATHROOM = 'BATHROOM',
  TOWELS = 'TOWELS',
  TOILETRIES = 'TOILETRIES',
  MIRROR = 'MIRROR',
  FLOOR = 'FLOOR',
  DUSTBIN = 'DUSTBIN',
}

export interface HousekeepingChecklistItem {
  key: HousekeepingChecklistKey;
  completed: boolean;
  completedAt: string | null;
}

export const requiredHousekeepingChecklistKeys = Object.values(HousekeepingChecklistKey);
