import { Bed, Brush, Package, ScanFace, ShowerHead, Shirt, Trash2 } from 'lucide-react';
import type {
  HousekeepingChecklistItem,
  HousekeepingChecklistKey,
} from '../types/housekeeping.types';

export const HOUSEKEEPING_CHECKLIST: HousekeepingChecklistItem[] = [
  { key: 'BED', label: 'Bed', icon: Bed, completed: false },
  { key: 'BATHROOM', label: 'Bathroom', icon: ShowerHead, completed: false },
  { key: 'TOWELS', label: 'Towels', icon: Shirt, completed: false },
  { key: 'TOILETRIES', label: 'Toiletries', icon: Package, completed: false },
  { key: 'MIRROR', label: 'Mirror', icon: ScanFace, completed: false },
  { key: 'FLOOR', label: 'Floor', icon: Brush, completed: false },
  { key: 'DUSTBIN', label: 'Dustbin', icon: Trash2, completed: false },
];

export function createChecklist(completedKeys: HousekeepingChecklistKey[] = []) {
  const completed = new Set(completedKeys);
  return HOUSEKEEPING_CHECKLIST.map((item) => ({
    ...item,
    completed: completed.has(item.key),
  }));
}

export function serializeChecklist(items: HousekeepingChecklistItem[]) {
  return items.map(({ completed, key }) => ({ completed, key }));
}
