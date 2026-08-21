import { OperationsPriority } from '../dto/operations.dto';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { PropertyEntity } from '../../properties/infrastructure/property.entity';
import { todayIsoDate } from './operations-query.helpers';

export enum CheckoutOperationalStatus {
  NORMAL = 'NORMAL',
  DEPARTURE_TODAY = 'DEPARTURE_TODAY',
  CHECKOUT_DUE_SOON = 'CHECKOUT_DUE_SOON',
  CHECKOUT_DUE_NOW = 'CHECKOUT_DUE_NOW',
  CHECKOUT_OVERDUE = 'OVERDUE_CHECKOUT',
  LATE_CHECKOUT_APPROVED = 'LATE_CHECKOUT_APPROVED',
  LATE_CHECKOUT_DUE_SOON = 'LATE_CHECKOUT_DUE_SOON',
  LATE_CHECKOUT_DUE_NOW = 'LATE_CHECKOUT_DUE_NOW',
  LATE_CHECKOUT_OVERDUE = 'LATE_CHECKOUT_OVERDUE',
}

export interface CheckoutOperationalResolution {
  status: CheckoutOperationalStatus;
  isOverdue: boolean;
  isLateCheckout: boolean;
  effectiveCheckoutTime: string;
  standardCheckOutTime: string;
  approvedLateCheckoutUntil: string | null;
  priority: OperationsPriority;
  checkoutLabel: string;
  signal: string;
  description: string;
  minutesRemaining?: number;
  minutesOverdue?: number;
}

export const propertyLocalDate = (timeZone = 'UTC', instant = new Date()): string => {
  return todayIsoDate(timeZone, instant);
};

export const propertyLocalTime = (timeZone = 'UTC', instant = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }

  const hour = parts.hour ? parts.hour.padStart(2, '0') : '00';
  const minute = parts.minute ? parts.minute.padStart(2, '0') : '00';
  const second = parts.second ? parts.second.padStart(2, '0') : '00';
  return `${hour}:${minute}:${second}`;
};

export const parseTimeToMinutes = (timeStr?: string | null): number => {
  if (!timeStr) return 0;
  const clean = timeStr.trim();
  const [h, m] = clean.split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
};

export const formatTimeDisplay = (timeStr?: string | null): string => {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  const [hStr, mStr] = clean.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMinute = m === 0 ? ':00' : `:${String(m).padStart(2, '0')}`;
  return `${displayHour}${displayMinute} ${period}`;
};

export const formatDurationMinutes = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  const unit = hours === 1 ? 'hr' : 'hrs';
  if (remMinutes === 0) {
    return `${hours} ${unit}`;
  }
  return `${hours} ${unit} ${remMinutes} min`;
};

export const resolveCheckoutOperationalState = (
  reservation: Partial<ReservationEntity> | null | undefined,
  property: Partial<PropertyEntity> | null | undefined,
  instant = new Date(),
): CheckoutOperationalResolution => {
  const timeZone = property?.timezone ?? 'UTC';
  const standardCheckOutTime = property?.checkOutTime ?? '11:00:00';
  const approvedLateCheckoutUntil = reservation?.lateCheckoutApprovedUntil ?? null;
  const isLateCheckout = Boolean(approvedLateCheckoutUntil);
  const effectiveCheckoutTime = isLateCheckout
    ? approvedLateCheckoutUntil!
    : standardCheckOutTime;

  const defaultResolution: CheckoutOperationalResolution = {
    status: CheckoutOperationalStatus.NORMAL,
    isOverdue: false,
    isLateCheckout,
    effectiveCheckoutTime,
    standardCheckOutTime,
    approvedLateCheckoutUntil,
    priority: OperationsPriority.LOW,
    checkoutLabel: 'Checkout',
    signal: 'In-house',
    description: 'Checked-in stay in progress.',
  };

  if (!reservation || reservation.status !== ReservationStatus.CHECKED_IN) {
    return defaultResolution;
  }

  const today = propertyLocalDate(timeZone, instant);
  const nowTime = propertyLocalTime(timeZone, instant);
  const nowMinutes = parseTimeToMinutes(nowTime);
  const deadlineMinutes = parseTimeToMinutes(effectiveCheckoutTime);
  const diffMinutes = deadlineMinutes - nowMinutes;

  const guestName =
    reservation.guest?.displayName ||
    (reservation as { guestName?: string }).guestName ||
    'Guest';

  // Case 1: Past departure date -> Always overdue
  if (reservation.departureDate && reservation.departureDate < today) {
    const status = isLateCheckout
      ? CheckoutOperationalStatus.LATE_CHECKOUT_OVERDUE
      : CheckoutOperationalStatus.CHECKOUT_OVERDUE;
    const checkoutLabel = isLateCheckout ? 'Late Checkout Overdue' : 'Overdue Checkout';

    return {
      status,
      isOverdue: true,
      isLateCheckout,
      effectiveCheckoutTime,
      standardCheckOutTime,
      approvedLateCheckoutUntil,
      priority: OperationsPriority.CRITICAL,
      checkoutLabel,
      signal: isLateCheckout ? 'Late checkout overdue' : 'Overdue checkout',
      description: `${guestName} is overdue for checkout (scheduled ${reservation.departureDate}).`,
    };
  }

  // Case 2: Future departure date
  if (reservation.departureDate && reservation.departureDate > today) {
    return {
      ...defaultResolution,
      checkoutLabel: `Checkout ${reservation.departureDate}`,
    };
  }

  // Case 3: Departing Today (reservation.departureDate === today)
  if (diffMinutes < 0) {
    // Past deadline
    const minutesOverdue = Math.abs(diffMinutes);
    const elapsed = formatDurationMinutes(minutesOverdue);
    const status = isLateCheckout
      ? CheckoutOperationalStatus.LATE_CHECKOUT_OVERDUE
      : CheckoutOperationalStatus.CHECKOUT_OVERDUE;
    const checkoutLabel = isLateCheckout ? 'Late Checkout Overdue' : 'Overdue Checkout';

    return {
      status,
      isOverdue: true,
      isLateCheckout,
      effectiveCheckoutTime,
      standardCheckOutTime,
      approvedLateCheckoutUntil,
      priority: OperationsPriority.CRITICAL,
      checkoutLabel,
      signal: isLateCheckout
        ? `Late checkout overdue · ${elapsed}`
        : `Checkout overdue · ${elapsed}`,
      description: isLateCheckout
        ? `Late checkout overdue for ${guestName} · ${elapsed}.`
        : `${guestName} is overdue for checkout · ${elapsed}.`,
      minutesOverdue,
    };
  }

  if (diffMinutes <= 15) {
    // Due now (within 15 minutes before deadline)
    const status = isLateCheckout
      ? CheckoutOperationalStatus.LATE_CHECKOUT_DUE_NOW
      : CheckoutOperationalStatus.CHECKOUT_DUE_NOW;
    const checkoutLabel = isLateCheckout ? 'Late Checkout Due Now' : 'Checkout Due Now';

    return {
      status,
      isOverdue: false,
      isLateCheckout,
      effectiveCheckoutTime,
      standardCheckOutTime,
      approvedLateCheckoutUntil,
      priority: OperationsPriority.HIGH,
      checkoutLabel,
      signal: isLateCheckout ? 'Late checkout due now' : 'Checkout due now',
      description: isLateCheckout
        ? `Late checkout due now for ${guestName}.`
        : `${guestName} checkout is due now.`,
      minutesRemaining: diffMinutes,
    };
  }

  if (diffMinutes <= 60) {
    // Due soon (within 1 hour before deadline)
    const status = isLateCheckout
      ? CheckoutOperationalStatus.LATE_CHECKOUT_DUE_SOON
      : CheckoutOperationalStatus.CHECKOUT_DUE_SOON;
    const checkoutLabel = isLateCheckout ? 'Late Checkout Due Soon' : 'Checkout Due Soon';
    const remainingStr = formatDurationMinutes(diffMinutes);

    return {
      status,
      isOverdue: false,
      isLateCheckout,
      effectiveCheckoutTime,
      standardCheckOutTime,
      approvedLateCheckoutUntil,
      priority: OperationsPriority.HIGH,
      checkoutLabel,
      signal: isLateCheckout ? `Late checkout due in ${remainingStr}` : `Due in ${remainingStr}`,
      description: isLateCheckout
        ? `Late checkout due in ${remainingStr} for ${guestName}.`
        : `${guestName} checkout is due in ${remainingStr}.`,
      minutesRemaining: diffMinutes,
    };
  }

  // Comfortably before deadline (> 60 minutes)
  const formattedTime = formatTimeDisplay(effectiveCheckoutTime);
  if (isLateCheckout) {
    return {
      status: CheckoutOperationalStatus.LATE_CHECKOUT_APPROVED,
      isOverdue: false,
      isLateCheckout: true,
      effectiveCheckoutTime,
      standardCheckOutTime,
      approvedLateCheckoutUntil,
      priority: OperationsPriority.MEDIUM,
      checkoutLabel: `Late Checkout · ${formattedTime}`,
      signal: `Approved until ${formattedTime}`,
      description: `Late checkout approved for ${guestName} until ${formattedTime}.`,
      minutesRemaining: diffMinutes,
    };
  }

  return {
    status: CheckoutOperationalStatus.DEPARTURE_TODAY,
    isOverdue: false,
    isLateCheckout: false,
    effectiveCheckoutTime,
    standardCheckOutTime,
    approvedLateCheckoutUntil: null,
    priority: OperationsPriority.MEDIUM,
    checkoutLabel: 'Checkout Today',
    signal: 'Departing today',
    description: `${guestName} is due to check out today.`,
    minutesRemaining: diffMinutes,
  };
};
