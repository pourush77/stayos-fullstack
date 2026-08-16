import { ReservationStatus } from './reservation-status.enum';
import {
  InventoryDelta,
  inventoryDeltaForTransition,
  diffEntitlements,
} from './reservation-inventory-transition';

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

describe('diffEntitlements', () => {
  const set = (roomTypeId: string, nights: string[], consuming = true) => ({
    consuming,
    roomTypeId,
    nights,
  });

  it('date extension reserves only the added nights', () => {
    const diff = diffEntitlements(
      set('rt-1', ['2026-07-15', '2026-07-16']),
      set('rt-1', ['2026-07-15', '2026-07-16', '2026-07-17']),
    );
    expect(diff.toRelease).toEqual([]);
    expect(diff.toReserve).toEqual([{ roomTypeId: 'rt-1', date: '2026-07-17' }]);
  });

  it('date shortening releases only the removed nights', () => {
    const diff = diffEntitlements(
      set('rt-1', ['2026-07-15', '2026-07-16', '2026-07-17']),
      set('rt-1', ['2026-07-15', '2026-07-16']),
    );
    expect(diff.toReserve).toEqual([]);
    expect(diff.toRelease).toEqual([{ roomTypeId: 'rt-1', date: '2026-07-17' }]);
  });

  it('date shift releases old-only nights and reserves new-only nights, leaving overlap untouched', () => {
    const diff = diffEntitlements(
      set('rt-1', ['2026-07-15', '2026-07-16']),
      set('rt-1', ['2026-07-16', '2026-07-17']),
    );
    expect(diff.toRelease).toEqual([{ roomTypeId: 'rt-1', date: '2026-07-15' }]);
    expect(diff.toReserve).toEqual([{ roomTypeId: 'rt-1', date: '2026-07-17' }]);
  });

  it('roomType change transfers the entire entitlement (all old released, all new reserved)', () => {
    const diff = diffEntitlements(
      set('rt-1', ['2026-07-15', '2026-07-16']),
      set('rt-2', ['2026-07-15', '2026-07-16']),
    );
    expect(diff.toRelease).toEqual([
      { roomTypeId: 'rt-1', date: '2026-07-15' },
      { roomTypeId: 'rt-1', date: '2026-07-16' },
    ]);
    expect(diff.toReserve).toEqual([
      { roomTypeId: 'rt-2', date: '2026-07-15' },
      { roomTypeId: 'rt-2', date: '2026-07-16' },
    ]);
  });

  it('non-consuming reservations hold nothing on either side', () => {
    const diff = diffEntitlements(
      set('rt-1', ['2026-07-15'], false),
      set('rt-2', ['2026-07-20'], false),
    );
    expect(diff).toEqual({ toRelease: [], toReserve: [] });
  });

  it('an unchanged entitlement produces an empty diff', () => {
    const diff = diffEntitlements(
      set('rt-1', ['2026-07-15', '2026-07-16']),
      set('rt-1', ['2026-07-15', '2026-07-16']),
    );
    expect(diff).toEqual({ toRelease: [], toReserve: [] });
  });
});
