import { ReservationStatus } from './reservation-status.enum';
import {
  INVENTORY_CONSUMING_STATUSES,
  getReservationInventoryEntitlement,
  reservationConsumesInventory,
} from './reservation-inventory';

describe('reservation-inventory', () => {
  const base = {
    propertyId: 'prop-1',
    roomTypeId: 'rt-1',
    arrivalDate: '2026-08-01',
    departureDate: '2026-08-03',
  };

  it('treats PENDING (canonical HOLD), CONFIRMED and CHECKED_IN as inventory-consuming', () => {
    expect(reservationConsumesInventory(ReservationStatus.PENDING)).toBe(true);
    expect(reservationConsumesInventory(ReservationStatus.CONFIRMED)).toBe(true);
    expect(reservationConsumesInventory(ReservationStatus.CHECKED_IN)).toBe(true);
    // There is no separate HOLD status; PENDING is the hold.
    expect(INVENTORY_CONSUMING_STATUSES).toContain(ReservationStatus.PENDING);
  });

  it('does not consume inventory in terminal states', () => {
    expect(reservationConsumesInventory(ReservationStatus.CHECKED_OUT)).toBe(false);
    expect(reservationConsumesInventory(ReservationStatus.CANCELLED)).toBe(false);
    expect(reservationConsumesInventory(ReservationStatus.NO_SHOW)).toBe(false);
  });

  it('counts a CONFIRMED reservation with NO room assigned as consuming', () => {
    const entitlement = getReservationInventoryEntitlement({
      ...base,
      status: ReservationStatus.CONFIRMED,
    });
    expect(entitlement).toEqual({ ...base, consuming: true });
  });

  it('entitlement is keyed by roomType + dates + status and ignores physical roomId', () => {
    const withRoom = getReservationInventoryEntitlement({
      ...base,
      status: ReservationStatus.CONFIRMED,
      // a roomId is irrelevant to entitlement and is not part of the result
      ...({ roomId: 'room-9' } as Record<string, unknown>),
    } as never);
    const withoutRoom = getReservationInventoryEntitlement({
      ...base,
      status: ReservationStatus.CONFIRMED,
    });
    expect(withRoom).toEqual(withoutRoom);
    expect(withRoom).not.toHaveProperty('roomId');
  });
});
