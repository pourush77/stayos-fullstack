import { ReservationStatus } from './reservation-status.enum';
import { reservationConsumesInventory } from './reservation-inventory';

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
