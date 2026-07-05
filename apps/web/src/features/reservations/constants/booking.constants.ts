import type { Booking, BookingFilter } from '../types/booking.types';

export const bookingFilterOptions: { label: string; value: BookingFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Arrivals Today', value: 'arrivals-today' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Checked In', value: 'checked-in' },
  { label: 'Unassigned', value: 'unassigned' },
  { label: 'Payment Due', value: 'payment-due' },
  { label: 'VIP', value: 'vip' },
  { label: 'Cancelled', value: 'cancelled' },
];

export const paymentOptions = [
  { label: 'Paid', value: 'PAID' },
  { label: 'Payment Due', value: 'PAYMENT_DUE' },
];

export const sourceOptions = [
  { label: 'Direct', value: 'DIRECT' },
  { label: 'Walk In', value: 'WALK_IN' },
  { label: 'OTA', value: 'OTA' },
  { label: 'Corporate', value: 'CORPORATE' },
];

export const mockBookings: Booking[] = [
  {
    adults: 2,
    arrivalDate: '2026-07-04',
    backendId: 'booking-rahul-701',
    bookingId: 'BK-701',
    children: 0,
    departureDate: '2026-07-06',
    email: 'rahul.sharma@example.com',
    guestId: 'rahul-sharma',
    guestName: 'Rahul Sharma',
    isVip: true,
    nationality: 'Indian',
    nights: 2,
    notes: 'Prefers quiet floor.',
    paymentStatus: 'PAYMENT_DUE',
    phone: '9876543210',
    room: 'Unassigned',
    roomType: 'Deluxe',
    roomTypeId: 'deluxe',
    source: 'DIRECT',
    specialRequests: 'Quiet floor',
    status: 'CONFIRMED',
  },
  {
    adults: 1,
    arrivalDate: '2026-07-05',
    backendId: 'booking-emily-702',
    bookingId: 'BK-702',
    children: 0,
    departureDate: '2026-07-07',
    email: 'emily.johnson@example.com',
    guestId: 'emily-johnson',
    guestName: 'Emily Johnson',
    isVip: true,
    nationality: 'American',
    nights: 2,
    notes: 'Airport pickup requested.',
    paymentStatus: 'PAID',
    phone: '+1 415 555 0198',
    room: 'Suite 212',
    roomId: 'suite-212',
    roomType: 'Suite',
    roomTypeId: 'suite',
    source: 'OTA',
    specialRequests: 'Airport pickup',
    status: 'CHECKED_IN',
  },
];
