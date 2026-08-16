import { ReservationStatus } from './reservation-status.enum';
import { InventoryDelta, inventoryDeltaForTransition } from './reservation-inventory-transition';

describe('inventoryDeltaForTransition', () => {
  it('RESERVEs when creating directly into a consuming status', () => {
    expect(inventoryDeltaForTransition(null, ReservationStatus.PENDING)).toBe(InventoryDelta.RESERVE);
    expect(inventoryDeltaForTransition(null, ReservationStatus.CONFIRMED)).toBe(InventoryDelta.RESERVE);
    expect(inventoryDeltaForTransition(null, ReservationStatus.CHECKED_IN)).toBe(InventoryDelta.RESERVE);
  });

  it('does NOTHING when creating into a non-consuming status', () => {
    expect(inventoryDeltaForTransition(null, ReservationStatus.CANCELLED)).toBe(InventoryDelta.NONE);
    expect(inventoryDeltaForTransition(null, ReservationStatus.NO_SHOW)).toBe(InventoryDelta.NONE);
    expect(inventoryDeltaForTransition(null, ReservationStatus.CHECKED_OUT)).toBe(InventoryDelta.NONE);
  });

  it('does NOTHING for consuming -> consuming transitions (no re-reserve)', () => {
    expect(inventoryDeltaForTransition(ReservationStatus.PENDING, ReservationStatus.CONFIRMED)).toBe(
      InventoryDelta.NONE,
    );
    expect(
      inventoryDeltaForTransition(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN),
    ).toBe(InventoryDelta.NONE);
  });

  it('RELEASEs when leaving a consuming status (wired in 1C-a3)', () => {
    expect(inventoryDeltaForTransition(ReservationStatus.PENDING, ReservationStatus.CANCELLED)).toBe(
      InventoryDelta.RELEASE,
    );
    expect(inventoryDeltaForTransition(ReservationStatus.CONFIRMED, ReservationStatus.NO_SHOW)).toBe(
      InventoryDelta.RELEASE,
    );
    expect(
      inventoryDeltaForTransition(ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT),
    ).toBe(InventoryDelta.RELEASE);
  });
});
