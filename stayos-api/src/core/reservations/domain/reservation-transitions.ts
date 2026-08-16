import { BadRequestException } from '@nestjs/common';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { ReservationStatus } from './reservation-status.enum';

/**
 * Canonical reservation lifecycle. This is the SINGLE source of truth for which
 * status transitions are allowed; controllers/UI must not invent transitions.
 *
 * Lifecycle: PENDING(hold) -> CONFIRMED -> CHECKED_IN -> CHECKED_OUT,
 * with CANCELLED and NO_SHOW as terminal exits from the pre-stay states.
 */
export const ALLOWED_RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.CHECKED_IN,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.CHECKED_IN]: [ReservationStatus.CHECKED_OUT],
  [ReservationStatus.CHECKED_OUT]: [],
  [ReservationStatus.CANCELLED]: [],
  [ReservationStatus.NO_SHOW]: [],
};

export function isTerminalReservationStatus(status: ReservationStatus): boolean {
  return ALLOWED_RESERVATION_TRANSITIONS[status].length === 0;
}

export function canTransitionReservation(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  return ALLOWED_RESERVATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertReservationTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): void {
  if (!canTransitionReservation(from, to)) {
    throw new BadRequestException({
      code: ApiErrorCode.INVALID_RESERVATION_STATE_TRANSITION,
      message: `Cannot transition reservation from ${from} to ${to}`,
    });
  }
}
