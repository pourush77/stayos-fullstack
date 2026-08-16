import { BadRequestException } from '@nestjs/common';
import { ReservationStatus } from './reservation-status.enum';
import {
  assertReservationTransition,
  canTransitionReservation,
  isTerminalReservationStatus,
} from './reservation-transitions';

describe('reservation-transitions', () => {
  it('allows the canonical happy path', () => {
    expect(canTransitionReservation(ReservationStatus.PENDING, ReservationStatus.CONFIRMED)).toBe(true);
    expect(canTransitionReservation(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN)).toBe(true);
    expect(canTransitionReservation(ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT)).toBe(true);
  });

  it('allows cancel/no-show from PENDING and CONFIRMED only', () => {
    expect(canTransitionReservation(ReservationStatus.PENDING, ReservationStatus.CANCELLED)).toBe(true);
    expect(canTransitionReservation(ReservationStatus.CONFIRMED, ReservationStatus.NO_SHOW)).toBe(true);
    expect(canTransitionReservation(ReservationStatus.CHECKED_IN, ReservationStatus.CANCELLED)).toBe(false);
    expect(canTransitionReservation(ReservationStatus.CHECKED_IN, ReservationStatus.NO_SHOW)).toBe(false);
  });

  it('treats CHECKED_OUT/CANCELLED/NO_SHOW as terminal', () => {
    expect(isTerminalReservationStatus(ReservationStatus.CHECKED_OUT)).toBe(true);
    expect(isTerminalReservationStatus(ReservationStatus.CANCELLED)).toBe(true);
    expect(isTerminalReservationStatus(ReservationStatus.NO_SHOW)).toBe(true);
    expect(canTransitionReservation(ReservationStatus.CHECKED_OUT, ReservationStatus.CHECKED_IN)).toBe(false);
  });

  it('rejects skipping states and same-state transitions', () => {
    expect(canTransitionReservation(ReservationStatus.PENDING, ReservationStatus.CHECKED_IN)).toBe(false);
    expect(canTransitionReservation(ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_OUT)).toBe(false);
    expect(canTransitionReservation(ReservationStatus.CONFIRMED, ReservationStatus.CONFIRMED)).toBe(false);
  });

  it('assertReservationTransition throws on invalid transitions', () => {
    expect(() =>
      assertReservationTransition(ReservationStatus.CHECKED_OUT, ReservationStatus.CHECKED_IN),
    ).toThrow(BadRequestException);
    expect(() =>
      assertReservationTransition(ReservationStatus.PENDING, ReservationStatus.CONFIRMED),
    ).not.toThrow();
  });
});
