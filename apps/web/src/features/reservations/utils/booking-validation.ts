import type { BookingFormValues, RoomTypeOption } from '../types/booking.types';
import { calculateNights } from './booking-formatters';

export type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>;

export function validateBookingForm(values: BookingFormValues, roomTypes: RoomTypeOption[]) {
  const errors: BookingFormErrors = {};

  if (!values.guestId) errors.guestId = 'Please select a guest before creating the booking.';
  if (!values.arrivalDate) errors.arrivalDate = 'Arrival date is required.';
  if (!values.departureDate) errors.departureDate = 'Departure date is required.';
  if (values.arrivalDate && values.departureDate && calculateNights(values.arrivalDate, values.departureDate) < 1) {
    errors.departureDate = 'Departure date must be after arrival date.';
  }
  if (values.adults < 1) errors.adults = 'At least one adult is required.';
  if (values.children < 0) errors.children = 'Children cannot be negative.';
  if (!values.roomTypeId) errors.roomTypeId = 'Select a room type.';

  const roomType = roomTypes.find((item) => item.id === values.roomTypeId);
  if (roomType && values.adults + values.children > roomType.capacity) {
    errors.roomTypeId = 'This room type cannot fit all guests.';
  }

  return errors;
}

export function hasBookingFormErrors(errors: BookingFormErrors) {
  return Object.values(errors).some(Boolean);
}
