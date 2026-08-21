import {
  CheckoutOperationalStatus,
  formatDurationMinutes,
  formatTimeDisplay,
  parseTimeToMinutes,
  propertyLocalDate,
  propertyLocalTime,
  resolveCheckoutOperationalState,
} from '../services/checkout-operational-state.resolver';
import { OperationsPriority } from '../dto/operations.dto';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';

describe('checkout-operational-state.resolver', () => {
  const mockProperty: Partial<PropertyEntity> = {
    id: 'prop-1',
    timezone: 'Asia/Kolkata',
    checkInTime: '14:00:00',
    checkOutTime: '11:00:00',
  };

  describe('helper functions', () => {
    it('parses time strings to minutes', () => {
      expect(parseTimeToMinutes('00:00:00')).toBe(0);
      expect(parseTimeToMinutes('11:00:00')).toBe(660);
      expect(parseTimeToMinutes('14:30')).toBe(870);
      expect(parseTimeToMinutes(null)).toBe(0);
      expect(parseTimeToMinutes('')).toBe(0);
    });

    it('formats time string for display (12-hour AM/PM)', () => {
      expect(formatTimeDisplay('00:00:00')).toBe('12:00 AM');
      expect(formatTimeDisplay('11:00:00')).toBe('11:00 AM');
      expect(formatTimeDisplay('12:00:00')).toBe('12:00 PM');
      expect(formatTimeDisplay('14:30')).toBe('2:30 PM');
      expect(formatTimeDisplay('23:45:00')).toBe('11:45 PM');
      expect(formatTimeDisplay(null)).toBe('');
    });

    it('formats duration in minutes into friendly strings', () => {
      expect(formatDurationMinutes(15)).toBe('15 min');
      expect(formatDurationMinutes(45)).toBe('45 min');
      expect(formatDurationMinutes(60)).toBe('1 hr');
      expect(formatDurationMinutes(90)).toBe('1 hr 30 min');
      expect(formatDurationMinutes(120)).toBe('2 hrs');
      expect(formatDurationMinutes(150)).toBe('2 hrs 30 min');
    });

    it('gets property local date and time in property timezone', () => {
      // 2026-08-21 05:00:00 UTC = 2026-08-21 10:30:00 IST (+05:30)
      const instant = new Date('2026-08-21T05:00:00.000Z');
      expect(propertyLocalDate('Asia/Kolkata', instant)).toBe('2026-08-21');
      expect(propertyLocalTime('Asia/Kolkata', instant)).toBe('10:30:00');
    });
  });

  describe('resolveCheckoutOperationalState', () => {
    it('returns default NORMAL resolution for non-checked-in reservations', () => {
      const reservation: Partial<ReservationEntity> = {
        id: 'res-1',
        status: ReservationStatus.CONFIRMED,
        departureDate: '2026-08-21',
      };
      const instant = new Date('2026-08-21T05:00:00.000Z'); // 10:30 IST

      const result = resolveCheckoutOperationalState(reservation, mockProperty, instant);
      expect(result.status).toBe(CheckoutOperationalStatus.NORMAL);
      expect(result.isOverdue).toBe(false);
      expect(result.priority).toBe(OperationsPriority.LOW);
    });

    it('flags past departure date as OVERDUE_CHECKOUT with CRITICAL priority', () => {
      const reservation: Partial<ReservationEntity> = {
        id: 'res-1',
        status: ReservationStatus.CHECKED_IN,
        departureDate: '2026-08-20', // Yesterday
      };
      const instant = new Date('2026-08-21T03:30:00.000Z'); // 09:00 IST

      const result = resolveCheckoutOperationalState(reservation, mockProperty, instant);
      expect(result.status).toBe(CheckoutOperationalStatus.CHECKOUT_OVERDUE);
      expect(result.isOverdue).toBe(true);
      expect(result.priority).toBe(OperationsPriority.CRITICAL);
      expect(result.checkoutLabel).toBe('Overdue Checkout');
      expect(result.description).toContain('is overdue for checkout (scheduled 2026-08-20)');
    });

    it('keeps future departure date as normal in-house stay', () => {
      const reservation: Partial<ReservationEntity> = {
        id: 'res-1',
        status: ReservationStatus.CHECKED_IN,
        departureDate: '2026-08-25', // 4 days later
      };
      const instant = new Date('2026-08-21T03:30:00.000Z'); // 09:00 IST

      const result = resolveCheckoutOperationalState(reservation, mockProperty, instant);
      expect(result.status).toBe(CheckoutOperationalStatus.NORMAL);
      expect(result.isOverdue).toBe(false);
      expect(result.checkoutLabel).toBe('Checkout 2026-08-25');
    });

    describe('departure today with standard checkout time (11:00 AM)', () => {
      const reservation: Partial<ReservationEntity> = {
        id: 'res-1',
        status: ReservationStatus.CHECKED_IN,
        departureDate: '2026-08-21',
      };

      it('returns DEPARTURE_TODAY with MEDIUM priority > 60 min before checkout (e.g. 09:00 AM)', () => {
        // 09:00 IST = 03:30 UTC
        const instant = new Date('2026-08-21T03:30:00.000Z');
        const result = resolveCheckoutOperationalState(reservation, mockProperty, instant);

        expect(result.status).toBe(CheckoutOperationalStatus.DEPARTURE_TODAY);
        expect(result.isOverdue).toBe(false);
        expect(result.priority).toBe(OperationsPriority.MEDIUM);
        expect(result.checkoutLabel).toBe('Checkout Today');
        expect(result.signal).toBe('Departing today');
      });

      it('returns CHECKOUT_DUE_SOON with HIGH priority between 16 and 60 min before checkout (e.g. 10:20 AM, 40 min left)', () => {
        // 10:20 IST = 04:50 UTC
        const instant = new Date('2026-08-21T04:50:00.000Z');
        const result = resolveCheckoutOperationalState(reservation, mockProperty, instant);

        expect(result.status).toBe(CheckoutOperationalStatus.CHECKOUT_DUE_SOON);
        expect(result.isOverdue).toBe(false);
        expect(result.priority).toBe(OperationsPriority.HIGH);
        expect(result.checkoutLabel).toBe('Checkout Due Soon');
        expect(result.signal).toBe('Due in 40 min');
        expect(result.minutesRemaining).toBe(40);
      });

      it('returns CHECKOUT_DUE_NOW with HIGH priority within 15 min before checkout (e.g. 10:50 AM, 10 min left)', () => {
        // 10:50 IST = 05:20 UTC
        const instant = new Date('2026-08-21T05:20:00.000Z');
        const result = resolveCheckoutOperationalState(reservation, mockProperty, instant);

        expect(result.status).toBe(CheckoutOperationalStatus.CHECKOUT_DUE_NOW);
        expect(result.isOverdue).toBe(false);
        expect(result.priority).toBe(OperationsPriority.HIGH);
        expect(result.checkoutLabel).toBe('Checkout Due Now');
        expect(result.signal).toBe('Checkout due now');
      });

      it('returns CHECKOUT_OVERDUE with CRITICAL priority when past checkout time (e.g. 11:30 AM, 30 min overdue)', () => {
        // 11:30 IST = 06:00 UTC
        const instant = new Date('2026-08-21T06:00:00.000Z');
        const result = resolveCheckoutOperationalState(reservation, mockProperty, instant);

        expect(result.status).toBe(CheckoutOperationalStatus.CHECKOUT_OVERDUE);
        expect(result.isOverdue).toBe(true);
        expect(result.priority).toBe(OperationsPriority.CRITICAL);
        expect(result.checkoutLabel).toBe('Overdue Checkout');
        expect(result.signal).toBe('Checkout overdue · 30 min');
        expect(result.minutesOverdue).toBe(30);
      });
    });

    describe('departure today with approved late checkout (e.g. 14:00 / 2:00 PM)', () => {
      const reservationWithLateCheckout: Partial<ReservationEntity> = {
        id: 'res-1',
        status: ReservationStatus.CHECKED_IN,
        departureDate: '2026-08-21',
        lateCheckoutApprovedUntil: '14:00:00',
      };

      it('overrides standard checkout time: at 12:00 PM (past 11:00 AM) it is LATE_CHECKOUT_APPROVED and NOT overdue', () => {
        // 12:00 IST = 06:30 UTC
        const instant = new Date('2026-08-21T06:30:00.000Z');
        const result = resolveCheckoutOperationalState(
          reservationWithLateCheckout,
          mockProperty,
          instant,
        );

        expect(result.status).toBe(CheckoutOperationalStatus.LATE_CHECKOUT_APPROVED);
        expect(result.isOverdue).toBe(false);
        expect(result.isLateCheckout).toBe(true);
        expect(result.effectiveCheckoutTime).toBe('14:00:00');
        expect(result.standardCheckOutTime).toBe('11:00:00');
        expect(result.approvedLateCheckoutUntil).toBe('14:00:00');
        expect(result.priority).toBe(OperationsPriority.MEDIUM);
        expect(result.checkoutLabel).toBe('Late Checkout · 2:00 PM');
        expect(result.signal).toBe('Approved until 2:00 PM');
      });

      it('returns LATE_CHECKOUT_DUE_SOON at 13:15 (45 min before 14:00)', () => {
        // 13:15 IST = 07:45 UTC
        const instant = new Date('2026-08-21T07:45:00.000Z');
        const result = resolveCheckoutOperationalState(
          reservationWithLateCheckout,
          mockProperty,
          instant,
        );

        expect(result.status).toBe(CheckoutOperationalStatus.LATE_CHECKOUT_DUE_SOON);
        expect(result.isOverdue).toBe(false);
        expect(result.priority).toBe(OperationsPriority.HIGH);
        expect(result.checkoutLabel).toBe('Late Checkout Due Soon');
        expect(result.signal).toBe('Late checkout due in 45 min');
      });

      it('returns LATE_CHECKOUT_DUE_NOW at 13:50 (10 min before 14:00)', () => {
        // 13:50 IST = 08:20 UTC
        const instant = new Date('2026-08-21T08:20:00.000Z');
        const result = resolveCheckoutOperationalState(
          reservationWithLateCheckout,
          mockProperty,
          instant,
        );

        expect(result.status).toBe(CheckoutOperationalStatus.LATE_CHECKOUT_DUE_NOW);
        expect(result.isOverdue).toBe(false);
        expect(result.priority).toBe(OperationsPriority.HIGH);
        expect(result.checkoutLabel).toBe('Late Checkout Due Now');
        expect(result.signal).toBe('Late checkout due now');
      });

      it('returns LATE_CHECKOUT_OVERDUE with CRITICAL priority when past approved late checkout time (e.g. 14:25, 25 min overdue)', () => {
        // 14:25 IST = 08:55 UTC
        const instant = new Date('2026-08-21T08:55:00.000Z');
        const result = resolveCheckoutOperationalState(
          reservationWithLateCheckout,
          mockProperty,
          instant,
        );

        expect(result.status).toBe(CheckoutOperationalStatus.LATE_CHECKOUT_OVERDUE);
        expect(result.isOverdue).toBe(true);
        expect(result.isLateCheckout).toBe(true);
        expect(result.priority).toBe(OperationsPriority.CRITICAL);
        expect(result.checkoutLabel).toBe('Late Checkout Overdue');
        expect(result.signal).toBe('Late checkout overdue · 25 min');
        expect(result.minutesOverdue).toBe(25);
      });
    });
  });
});
