import type { BookingPaymentStatus, BookingSource, BookingStatus } from '../types/booking.types';

export function bookingStatusLabel(status: BookingStatus) {
  if (status === 'CHECKED_IN') return 'Checked In';
  if (status === 'CHECKED_OUT') return 'Checked Out';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'PENDING') return 'Pending';
  return 'Confirmed';
}

export function paymentStatusLabel(status: BookingPaymentStatus) {
  return status === 'PAID' ? 'Paid' : 'Payment Due';
}

export function sourceLabel(source: BookingSource) {
  if (source === 'WALK_IN') return 'Walk In';
  if (source === 'OTA') return 'OTA';
  if (source === 'CORPORATE') return 'Corporate';
  return 'Direct';
}

export function formatStayDates(arrivalDate: string, departureDate: string) {
  const arrival = parseDate(arrivalDate);
  const departure = parseDate(departureDate);
  if (!arrival || !departure) return 'Dates not recorded';
  return `${arrival.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} to ${departure.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
}

export function parseDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calculateNights(arrivalDate: string, departureDate: string) {
  const arrival = parseDate(arrivalDate);
  const departure = parseDate(departureDate);
  if (!arrival || !departure) return 0;
  return Math.max(0, Math.round((departure.getTime() - arrival.getTime()) / 86_400_000));
}
