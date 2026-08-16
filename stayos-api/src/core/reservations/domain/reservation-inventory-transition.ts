import { ReservationStatus } from './reservation-status.enum';
import { reservationConsumesInventory } from './reservation-inventory';
import { InventoryKey } from '../../inventory/domain/inventory-nights';

/**
 * Direction of the inventory change implied by a reservation entitlement change.
 * The canonical rule: inventory moves ONLY when the reservation crosses the
 * consuming/non-consuming boundary (see INVENTORY_CONSUMING_STATUSES).
 *
 *  - RESERVE: entering a consuming status from nothing (creation) or from a
 *    non-consuming status.
 *  - RELEASE: leaving a consuming status for a non-consuming one (cancel /
 *    no-show / check-out) — wired in Phase 1C-a3.
 *  - NONE: consuming -> consuming (e.g. PENDING->CONFIRMED, CONFIRMED->CHECKED_IN)
 *    or non-consuming -> non-consuming. No inventory movement.
 *
 * `from = null` models reservation creation (there is no prior entitlement).
 */
export enum InventoryDelta {
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
  NONE = 'NONE',
}

export function inventoryDeltaForTransition(
  from: ReservationStatus | null,
  to: ReservationStatus,
): InventoryDelta {
  const fromConsumes = from === null ? false : reservationConsumesInventory(from);
  const toConsumes = reservationConsumesInventory(to);

  if (!fromConsumes && toConsumes) return InventoryDelta.RESERVE;
  if (fromConsumes && !toConsumes) return InventoryDelta.RELEASE;
  return InventoryDelta.NONE;
}

/**
 * The room-type inventory entitlement a reservation holds. When `consuming` is
 * false the reservation holds nothing (empty entitlement).
 */
export interface EntitlementSet {
  consuming: boolean;
  roomTypeId: string;
  nights: string[];
}

export interface EntitlementDiff {
  toRelease: InventoryKey[];
  toReserve: InventoryKey[];
}

function keyString(roomTypeId: string, date: string): string {
  return `${roomTypeId}|${date}`;
}

function entitlementKeys(set: EntitlementSet | null): Map<string, InventoryKey> {
  const keys = new Map<string, InventoryKey>();
  if (!set || !set.consuming) return keys;
  for (const date of set.nights) {
    keys.set(keyString(set.roomTypeId, date), { roomTypeId: set.roomTypeId, date });
  }
  return keys;
}

/**
 * Atomic diff between a reservation's entitlement before and after a mutation.
 *  - toRelease: (roomType, date) units present before but not after.
 *  - toReserve: (roomType, date) units present after but not before.
 *  - Unchanged (roomType, date) units appear in neither set and are never touched.
 *
 * A roomType change naturally releases every old-pool night and reserves every
 * new-pool night, even on overlapping dates, because the keys differ by roomType.
 */
export function diffEntitlements(
  before: EntitlementSet | null,
  after: EntitlementSet | null,
): EntitlementDiff {
  const beforeKeys = entitlementKeys(before);
  const afterKeys = entitlementKeys(after);

  const toRelease: InventoryKey[] = [];
  for (const [key, value] of beforeKeys) {
    if (!afterKeys.has(key)) toRelease.push(value);
  }

  const toReserve: InventoryKey[] = [];
  for (const [key, value] of afterKeys) {
    if (!beforeKeys.has(key)) toReserve.push(value);
  }

  return { toRelease, toReserve };
}
