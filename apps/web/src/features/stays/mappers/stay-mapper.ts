import type { GuestDto } from '../../../lib/guest-api';
import type { OperationsActivityItemDto, OperationsRoomBoardItemDto } from '../../../lib/operations-api';
import type { ReservationDto } from '../../../lib/reservation-api';
import type { Stay, StayAllowedActions, StayAttentionItem, StayDocument, StayPaymentStatus, StayTimelineItem } from '../types/stay.types';
import type { StayWorkspaceDto } from '../api/stay-api';
import { calculateNights, calculateRemainingNights, dateKey } from '../utils/stay-formatters';

const documentLabels = ['Passport', 'Aadhaar', 'Driving Licence', 'Visa'];

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function getNumber(record: Record<string, unknown> | undefined, keys: string[], fallback = 0) {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return fallback;
}

function getBoolean(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return false;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', 'yes', '1', 'vip', 'blacklisted'].includes(value.toLowerCase());
  }
  return false;
}

function getRecord(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return undefined;
}

function getArray(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function fullGuestName(guest: GuestDto | Record<string, unknown> | undefined, reservation: ReservationDto) {
  return (
    getString(reservation, ['guestName']) ||
    getString(guest, ['displayName', 'fullName', 'name', 'guestName']) ||
    [getString(guest, ['firstName']), getString(guest, ['lastName'])].filter(Boolean).join(' ') ||
    'Guest details unavailable'
  );
}

function mapPaymentStatus(value: string): StayPaymentStatus {
  return value.toUpperCase().replace(/[\s-]/g, '_') === 'PAID' ? 'Paid' : 'Payment Due';
}

function normalizeStatus(value: string) {
  const normalized = value.replace(/_/g, ' ').replace(/-/g, ' ').trim();
  if (!normalized) return 'Checked In';
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function friendlyDocumentLabel(document: Record<string, unknown>) {
  const kind = getString(document, ['documentKind', 'type', 'label', 'name'], 'Document').replace(/_/g, ' ');
  const side = getString(document, ['side']).toUpperCase();
  if (side === 'ID_FRONT') return `${kind} - front`;
  if (side === 'ID_BACK') return `${kind} - back`;
  if (side === 'GUEST_FACE') return 'Guest photo';
  return kind;
}

function mapDocuments(dto: StayWorkspaceDto, guest: GuestDto | Record<string, unknown> | undefined): StayDocument[] {
  const capturedDocuments = getArray(dto as unknown as Record<string, unknown>, ['documents']);
  if (capturedDocuments.length > 0) {
    return capturedDocuments
      .filter((document): document is Record<string, unknown> => Boolean(document) && typeof document === 'object' && !Array.isArray(document))
      .map((document) => ({
        label: friendlyDocumentLabel(document),
        status: getString(document, ['status', 'verificationStatus'], 'Uploaded'),
      }));
  }

  const documents = getArray(guest, ['documents', 'identityDocuments']);

  return documentLabels.map((label) => {
    const existing = documents.find((item) => {
      if (typeof item === 'string') return item.toLowerCase() === label.toLowerCase();
      if (item && typeof item === 'object') {
        return getString(item as Record<string, unknown>, ['type', 'label', 'name']).toLowerCase() === label.toLowerCase();
      }
      return false;
    });

    if (existing && typeof existing === 'object') {
      return {
        label,
        status: getString(existing as Record<string, unknown>, ['verificationStatus', 'status'], 'Uploaded'),
      };
    }

    return { label, status: existing ? 'Uploaded' : 'Not uploaded' };
  });
}

function mapActivity(activity: OperationsActivityItemDto[]): StayTimelineItem[] {
  return activity
    .map((item) => ({
      detail: item.description || 'No detail recorded.',
      timestamp: item.timestamp || 'Time not recorded',
      title: item.title || 'Activity recorded',
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function mapAllowedActions(
  reservation: ReservationDto,
  allowedActions?: Record<string, unknown>,
): StayAllowedActions {
  const status = getString(reservation, ['status'], 'CHECKED_IN').toUpperCase().replace(/[\s-]/g, '_');
  const checkedIn = status === 'CHECKED_IN';

  return {
    canCheckOut: getBoolean(allowedActions, ['canCheckOut']) || checkedIn,
    canExtendStay: getBoolean(allowedActions, ['canExtendStay']) || checkedIn,
    canMoveRoom: getBoolean(allowedActions, ['canMoveRoom']) || checkedIn,
  };
}

function roomValue(room: Record<string, unknown> | OperationsRoomBoardItemDto | undefined, keys: string[], fallback = '') {
  if (!room) return fallback;
  for (const key of keys) {
    const value = (room as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function roomTypeName(room: Record<string, unknown> | OperationsRoomBoardItemDto | undefined, reservation: ReservationDto) {
  const roomType = getRecord(room as Record<string, unknown> | undefined, ['roomType']);
  const reservationRoomType = getRecord(reservation, ['roomType']);
  return (
    getString(reservation, ['roomTypeName']) ||
    getString(roomType, ['name', 'label', 'title']) ||
    getString(reservationRoomType, ['name', 'label', 'title']) ||
    'Room type not recorded'
  );
}

function roomTypeId(room: Record<string, unknown> | OperationsRoomBoardItemDto | undefined, reservation: ReservationDto) {
  const roomType = getRecord(room as Record<string, unknown> | undefined, ['roomType']);
  const reservationRoomType = getRecord(reservation, ['roomType']);
  return (
    getString(reservation, ['roomTypeId']) ||
    getString(roomType, ['id', '_id', 'uuid']) ||
    getString(reservationRoomType, ['id', '_id', 'uuid']) ||
    undefined
  );
}

function floorName(room: Record<string, unknown> | OperationsRoomBoardItemDto | undefined) {
  const floor = getRecord(room as Record<string, unknown> | undefined, ['floor']);
  return roomValue(room, ['floorName'], getString(floor, ['name', 'code'], 'Floor not recorded'));
}

function roomNumber(room: Record<string, unknown> | OperationsRoomBoardItemDto | undefined, reservation: ReservationDto) {
  return (
    roomValue(room, ['roomNumber', 'number', 'displayName']) ||
    getString(reservation, ['roomNumber']) ||
    'Room not assigned'
  );
}

function roomId(room: Record<string, unknown> | OperationsRoomBoardItemDto | undefined, reservation: ReservationDto) {
  return roomValue(room, ['roomId', 'id', '_id', 'uuid'], getString(reservation, ['roomId'])) || undefined;
}

function mapWarnings(dto: StayWorkspaceDto, stay: Omit<Stay, 'warnings'>): StayAttentionItem[] {
  const backendWarnings = (dto.warnings ?? [])
    .map((warning) => ({
      detail: getString(warning, ['detail', 'description', 'message'], 'Review this stay.'),
      title: getString(warning, ['title', 'label', 'type'], 'Needs attention'),
      tone: (getString(warning, ['tone', 'level'], 'warning').toLowerCase() === 'danger'
        ? 'danger'
        : getString(warning, ['tone', 'level'], 'warning').toLowerCase() === 'info'
          ? 'info'
          : 'warning') as StayAttentionItem['tone'],
    }))
    .filter((warning) => warning.title);

  if (backendWarnings.length > 0) return backendWarnings;

  const items: StayAttentionItem[] = [];
  const today = dateKey(new Date());

  if (stay.paymentStatus === 'Payment Due') {
    items.push({ title: 'Payment Due', detail: 'Payment is still pending.', tone: 'danger' });
  }

  const checkedIn = stay.status.toLowerCase() === 'checked in';
  const hasUploadedDocument = stay.documents.some((document) => !document.status.toLowerCase().includes('not uploaded'));
  if (!checkedIn && stay.documents.some((document) => document.status.toLowerCase().includes('not uploaded'))) {
    items.push({ title: 'Documents Missing', detail: 'One or more guest documents are not uploaded.', tone: 'warning' });
  } else if (checkedIn && !hasUploadedDocument) {
    items.push({ title: 'ID document missing', detail: 'No check-in ID document is attached to this stay.', tone: 'warning' });
  }

  if (stay.departureDate === today) {
    items.push({ title: 'Checkout Today', detail: 'This stay is scheduled to depart today.', tone: 'info' });
  }

  if (stay.isVip) {
    items.push({ title: 'VIP Guest', detail: 'High-touch handling applies.', tone: 'info' });
  }

  return items;
}

export function mapStayWorkspace(dto: StayWorkspaceDto): Stay {
  const reservation = dto.reservation;
  const embeddedGuest = getRecord(reservation, ['guest', 'guestProfile']);
  const guest = dto.guest ?? embeddedGuest;
  const room = dto.room ?? getRecord(reservation, ['room']);
  const payment = dto.payment;
  const arrivalDate = getString(reservation, ['arrivalDate', 'checkInDate', 'startDate']).slice(0, 10);
  const departureDate = getString(reservation, ['departureDate', 'checkOutDate', 'endDate']).slice(0, 10);
  const paymentStatus = mapPaymentStatus(
    getString(payment, ['status', 'paymentStatus'], getString(reservation, ['paymentStatus'], 'PAYMENT_DUE')),
  );
  const outstandingAmount =
    getString(payment, ['outstandingAmount', 'balance', 'balanceAmount']) ||
    (paymentStatus === 'Payment Due'
      ? getString(reservation, ['balanceAmount', 'amount', 'totalAmount'], 'Amount not recorded')
      : 'INR 0');
  const guestId = getString(reservation, ['guestId'], getString(guest, ['id', '_id', 'uuid'])) || undefined;
  const preferences = [
    ...getArray(guest, ['preferences', 'preferenceTags']).map((item) =>
      typeof item === 'string' ? item : getString(item as Record<string, unknown>, ['name', 'label', 'value']),
    ),
    ...splitList(getString(reservation, ['specialRequests', 'requests'])),
  ].filter(Boolean);
  const additionalGuests = getArray(reservation, ['additionalGuests', 'occupants', 'companions'])
    .map((item) => (typeof item === 'string' ? item : fullGuestName(item as Record<string, unknown>, reservation)))
    .filter(Boolean);

  const baseStay: Omit<Stay, 'warnings'> = {
    activity: mapActivity(dto.activity),
    additionalGuests,
    adults: getNumber(reservation, ['adults', 'numAdults', 'adultCount'], 1),
    allowedActions: mapAllowedActions(reservation, dto.allowedActions),
    arrivalDate,
    billing: {
      balance: getString(payment, ['balance', 'balanceAmount'], outstandingAmount),
      deposit: getString(payment, ['deposit', 'depositAmount'], 'Not recorded'),
      isConnected: Boolean(payment) || Boolean(getString(reservation, ['paymentStatus', 'amount', 'totalAmount', 'balanceAmount'])),
      outstandingAmount,
      paymentStatus,
      roomCharges: getString(payment, ['roomCharges', 'roomChargeAmount'], getString(reservation, ['amount', 'totalAmount'], 'Not recorded')),
    },
    blacklistStatus: getBoolean(guest, ['blacklistStatus', 'blacklisted', 'isBlacklisted']),
    bookingId: getString(reservation, ['reservationCode', 'bookingCode', 'code', 'id'], 'Booking ID not recorded'),
    children: getNumber(reservation, ['children', 'numChildren', 'childCount'], 0),
    departureDate,
    documents: mapDocuments(dto, guest),
    floor: floorName(room),
    guestEmail: getString(reservation, ['email'], getString(guest, ['email'], 'Email not recorded')),
    guestId,
    guestName: fullGuestName(guest, reservation),
    guestNotes: getString(guest, ['notes', 'note'], 'No guest notes recorded.'),
    guestPhone: getString(reservation, ['phone', 'mobile'], getString(guest, ['phone', 'mobile', 'phoneNumber'], 'Phone not recorded')),
    internalNotes: getString(reservation, ['notes', 'note'], 'No stay notes recorded.'),
    isVip: getBoolean(reservation, ['isVip', 'vip']) || getBoolean(guest, ['vipStatus', 'vip', 'isVip']),
    language: getString(guest, ['preferredLanguage', 'language'], 'Language not recorded'),
    nationality: getString(reservation, ['nationality'], getString(guest, ['nationality'], 'Nationality not recorded')),
    nights: calculateNights(arrivalDate, departureDate),
    outstandingAmount,
    paymentStatus,
    preferences,
    remainingNights: calculateRemainingNights(departureDate),
    requests: splitList(getString(reservation, ['specialRequests', 'requests'])),
    roomId: roomId(room, reservation),
    roomNumber: roomNumber(room, reservation),
    roomStatus: roomValue(room, ['operationalStatus', 'status', 'uiStatus'], 'Room status not recorded'),
    roomType: roomTypeName(room, reservation),
    roomTypeId: roomTypeId(room, reservation),
    status: normalizeStatus(getString(reservation, ['status'], 'CHECKED_IN')),
  };

  return {
    ...baseStay,
    warnings: mapWarnings(dto, baseStay),
  };
}

