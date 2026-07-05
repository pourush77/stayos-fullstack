import type { GuestFormValues } from '../types/guest.types';

export type GuestFormErrors = Partial<Record<keyof GuestFormValues, string>>;

export function validateGuestForm(values: GuestFormValues) {
  const errors: GuestFormErrors = {};

  if (!values.firstName.trim()) errors.firstName = 'First name is required.';
  if (!values.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!values.phone.trim()) errors.phone = 'Phone is required.';
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  return errors;
}

export function hasGuestFormErrors(errors: GuestFormErrors) {
  return Object.values(errors).some(Boolean);
}
