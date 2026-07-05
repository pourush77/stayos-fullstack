import type { Booking, BookingFormValues, GuestOption, RoomTypeOption } from '../../reservations/types/booking.types';
import type { Guest } from '../../guests/types/guest.types';

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function todayKey() {
  return dateKey(new Date());
}

export function tomorrowKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateKey(tomorrow);
}

export function guestToGuestOption(guest: Guest): GuestOption {
  return {
    email: guest.email,
    id: guest.id,
    isVip: guest.vipStatus,
    label: guest.fullName,
    nationality: guest.nationality,
    phone: guest.phone,
  };
}

export function defaultWalkInBookingValues(guestId: string, roomTypes: RoomTypeOption[]): BookingFormValues {
  return {
    adults: 1,
    arrivalDate: todayKey(),
    children: 0,
    departureDate: tomorrowKey(),
    guestId,
    notes: '',
    paymentStatus: 'PAYMENT_DUE',
    roomTypeId: roomTypes[0]?.id ?? '',
    source: 'WALK_IN',
    specialRequests: '',
  };
}

export function bookingDefaultsForGuest(guestId: string, roomTypes: RoomTypeOption[]): Booking {
  const values = defaultWalkInBookingValues(guestId, roomTypes);

  return {
    adults: values.adults,
    arrivalDate: values.arrivalDate,
    backendId: 'new-arrival-booking',
    bookingId: 'New Booking',
    children: values.children,
    departureDate: values.departureDate,
    email: '',
    guestId,
    guestName: 'Selected Guest',
    isVip: false,
    nationality: '',
    nights: 1,
    notes: '',
    paymentStatus: values.paymentStatus,
    phone: '',
    room: 'Unassigned',
    roomType: roomTypes[0]?.label ?? '',
    roomTypeId: values.roomTypeId,
    source: values.source,
    specialRequests: '',
    status: 'CONFIRMED',
  };
}
