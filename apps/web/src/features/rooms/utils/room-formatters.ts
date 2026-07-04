import type { InventoryPropertyDto } from '../../../lib/inventory-api';
import type { Room } from '../types';

export function getString(
  record: Record<string, unknown> | undefined,
  keys: string[],
  fallback = '',
) {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

export function isActiveRecord(record: Record<string, unknown>) {
  return getString(record, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE';
}

export function getPropertyId(property: InventoryPropertyDto) {
  return getString(property, ['id', '_id', 'uuid', 'propertyId']);
}

export function getPropertyName(property: InventoryPropertyDto) {
  return getString(property, ['name', 'title', 'displayName']);
}

export function formatArrivalLabel(value: string | undefined) {
  if (!value) return 'Arrival date not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return `Arrival ${value}`;
  return `Arrival ${parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
}

export function sortRoomLabels(values: string[]) {
  return [...values].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

export function groupRoomsByFloor(rooms: Room[], floors: string[]) {
  return floors
    .map((floor) => ({
      floor,
      rooms: rooms.filter((room) => room.floor === floor),
    }))
    .filter((group) => group.rooms.length > 0);
}

export function compactFloorLabel(floor: string) {
  const numeric = floor.match(/\d+/)?.[0];
  if (numeric) return `F${numeric}`;

  const normalized = floor.toLowerCase();
  const ordinalMap: Record<string, string> = {
    ground: 'G',
    first: 'F1',
    second: 'F2',
    third: 'F3',
    fourth: 'F4',
    fifth: 'F5',
    sixth: 'F6',
    seventh: 'F7',
    eighth: 'F8',
    ninth: 'F9',
    tenth: 'F10',
  };

  for (const [token, label] of Object.entries(ordinalMap)) {
    if (normalized.includes(token)) return label;
  }

  return floor
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 3);
}
