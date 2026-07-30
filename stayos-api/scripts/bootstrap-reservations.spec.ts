import { ReservationPaymentStatus } from '../src/core/reservations/domain/reservation-payment-status.enum';
import { ReservationStatus } from '../src/core/reservations/domain/reservation-status.enum';
import {
  assertHillstonReservationCounts,
  createHillstonReservationSimulationState,
  expectedHillstonReservations,
  hillstonReservationBootstrapData,
  simulateHillstonReservationBootstrap,
} from './bootstrap-reservations';

describe('Hillston reservation bootstrap plan', () => {
  it('has the expected reservation seed data', () => {
    expect(hillstonReservationBootstrapData).toHaveLength(5);
    expect(
      hillstonReservationBootstrapData.filter(
        (reservation) => reservation.status === ReservationStatus.CONFIRMED,
      ),
    ).toHaveLength(3);
    expect(
      hillstonReservationBootstrapData.filter(
        (reservation) => reservation.status === ReservationStatus.PENDING,
      ),
    ).toHaveLength(1);
    expect(
      hillstonReservationBootstrapData.filter(
        (reservation) => reservation.status === ReservationStatus.CHECKED_IN,
      ),
    ).toHaveLength(1);
    expect(
      hillstonReservationBootstrapData.filter(
        (reservation) => reservation.paymentStatus === ReservationPaymentStatus.PAYMENT_DUE,
      ),
    ).toHaveLength(2);
    expect(
      hillstonReservationBootstrapData.filter((reservation) => reservation.roomNumber),
    ).toHaveLength(3);
    expect(
      new Set(hillstonReservationBootstrapData.map((reservation) => reservation.reservationCode))
        .size,
    ).toBe(5);
  });

  it('is idempotent when applied twice', () => {
    const state = createHillstonReservationSimulationState();
    const firstRun = simulateHillstonReservationBootstrap(state);
    const secondRun = simulateHillstonReservationBootstrap(state);

    expect(firstRun).toEqual(expectedHillstonReservations);
    expect(secondRun).toEqual(expectedHillstonReservations);
    expect(state.reservations).toHaveLength(5);
  });

  it('generates arrival dates relative to today and tomorrow', () => {
    const today = new Date();
    const padDateValue = (value: number): string => String(value).padStart(2, '0');
    const formatLocalDate = (date: Date): string =>
      `${date.getFullYear()}-${padDateValue(date.getMonth() + 1)}-${padDateValue(date.getDate())}`;
    const addDays = (date: Date, days: number): Date =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

    const expectedToday = formatLocalDate(today);
    const expectedTomorrow = formatLocalDate(addDays(today, 1));
    const expectedTodayPlusThree = formatLocalDate(addDays(today, 3));
    const expectedTomorrowPlusThree = formatLocalDate(addDays(today, 4));

    const reservationMap = new Map(
      hillstonReservationBootstrapData.map((reservation) => [
        reservation.reservationCode,
        reservation,
      ]),
    );

    expect(reservationMap.get('ST1842')?.arrivalDate).toBe(expectedToday);
    expect(reservationMap.get('ST1842')?.departureDate).toBe(expectedTodayPlusThree);
    expect(reservationMap.get('ST1849')?.arrivalDate).toBe(expectedToday);
    expect(reservationMap.get('ST1849')?.departureDate).toBe(expectedTomorrow);
    expect(reservationMap.get('ST1851')?.arrivalDate).toBe(expectedToday);
    expect(reservationMap.get('ST1851')?.departureDate).toBe(expectedTodayPlusThree);
    expect(reservationMap.get('ST1856')?.arrivalDate).toBe(expectedTomorrow);
    expect(reservationMap.get('ST1856')?.departureDate).toBe(expectedTomorrowPlusThree);
    expect(reservationMap.get('ST1838')?.arrivalDate).toBe(expectedToday);
    expect(reservationMap.get('ST1838')?.departureDate).toBe(expectedTomorrow);
  });

  it('rejects incorrect reservation counts', () => {
    expect(() =>
      assertHillstonReservationCounts({
        ...expectedHillstonReservations,
        totalReservations: 6,
      }),
    ).toThrow(/Expected totalReservations to be 5/);
  });
});
