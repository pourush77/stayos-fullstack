import { ReservationStatus } from './reservation-status.enum';

/**
 * Room-TYPE inventory entitlement, decoupled from physical room assignment.
 *
 * Lifecycle note: PENDING is the canonical HOLD for StayOS. There is no separate
 * HOLD status — a held reservation is PENDING and already consumes room-type
 * inventory. CONFIRMED and CHECKED_IN also consume. Terminal states
 * (CHECKED_OUT / CANCELLED / NO_SHOW) do not.
 *
 * Inventory consumption depends ONLY on property + roomType + stay dates +
 * status. The physical `roomId` is an assignment detail and never affects
 * entitlement (assigning/unassigning a room must not change what a reservation
 * consumes).
 */
export const INVENTORY_CONSUMING_STATUSES: readonly ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

export function reservationConsumesInventory(status: ReservationStatus): boolean {
  return INVENTORY_CONSUMING_STATUSES.includes(status);
}

export type ReservationInventoryEntitlement = {
  propertyId: string;
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
  consuming: boolean;
};

export function getReservationInventoryEntitlement(reservation: {
  propertyId: string;
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
  status: ReservationStatus;
}): ReservationInventoryEntitlement {
  return {
    propertyId: reservation.propertyId,
    roomTypeId: reservation.roomTypeId,
    arrivalDate: reservation.arrivalDate,
    departureDate: reservation.departureDate,
    consuming: reservationConsumesInventory(reservation.status),
  };
}
