import type { GuestDto, GuestPayloadDto } from '../../../lib/guest-api';
import type { Guest, GuestFormValues, GuestStatus } from '../types/guest.types';
import { initialsFor } from './guest-formatters';

function getString(record: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function getBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', 'yes', '1', 'vip'].includes(value.toLowerCase());
  }

  return false;
}

function getArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function normalizeStatus(value: string, blacklistStatus: boolean): GuestStatus {
  if (blacklistStatus) return 'BLACKLISTED';
  const normalized = value.toUpperCase();
  if (normalized === 'BLACKLISTED') return 'BLACKLISTED';
  if (normalized === 'INACTIVE') return 'INACTIVE';
  return 'ACTIVE';
}

export function mapGuest(dto: GuestDto): Guest {
  const firstName = getString(dto, ['firstName', 'first_name']);
  const lastName = getString(dto, ['lastName', 'last_name']);
  const displayName = getString(dto, ['displayName', 'display_name', 'name', 'fullName']);
  const fullName = displayName || [firstName, lastName].filter(Boolean).join(' ') || 'Unnamed guest';
  const blacklistStatus = getBoolean(dto, ['blacklistStatus', 'blacklisted', 'isBlacklisted']);
  const status = normalizeStatus(getString(dto, ['status'], 'ACTIVE'), blacklistStatus);

  return {
    alternatePhone: getString(dto, ['alternatePhone', 'alternate_phone'], 'Not recorded'),
    blacklistStatus: status === 'BLACKLISTED',
    displayName: fullName,
    email: getString(dto, ['email'], 'Not recorded'),
    firstName: firstName || fullName.split(' ')[0] || '',
    fullName,
    id: getString(dto, ['id', '_id', 'uuid', 'guestId'], fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    initials: initialsFor(firstName, lastName, fullName),
    lastName: lastName || fullName.split(' ').slice(1).join(' '),
    lastStay: getString(dto, ['lastStay', 'lastStayDate', 'lastStayedAt'], 'Not connected'),
    nationality: getString(dto, ['nationality'], 'Not recorded'),
    notes: getString(dto, ['notes', 'note'], 'No notes added.'),
    phone: getString(dto, ['phone', 'mobile', 'phoneNumber'], 'Not recorded'),
    preferredLanguage: getString(dto, ['preferredLanguage', 'language'], 'Not recorded'),
    status,
    upcomingBooking: getString(dto, ['upcomingBooking', 'nextReservation'], 'Not connected'),
    vipStatus: getBoolean(dto, ['vipStatus', 'vip', 'isVip']),
    reservations: getArray(dto, ['reservations'])
      .map((item) => (item && typeof item === 'object' ? item as Record<string, unknown> : undefined))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        arrivalDate: getString(item, ['arrivalDate']),
        id: getString(item, ['id', 'reservationId']),
      }))
      .filter((item) => item.id),
  };
}

export function guestToFormValues(guest?: Guest): GuestFormValues {
  return {
    alternatePhone: guest?.alternatePhone === 'Not recorded' ? '' : guest?.alternatePhone ?? '',
    blacklistStatus: guest?.blacklistStatus ?? false,
    email: guest?.email === 'Not recorded' ? '' : guest?.email ?? '',
    firstName: guest?.firstName ?? '',
    lastName: guest?.lastName ?? '',
    nationality: guest?.nationality === 'Not recorded' ? '' : guest?.nationality ?? '',
    phone: guest?.phone === 'Not recorded' ? '' : guest?.phone ?? '',
    preferredLanguage: guest?.preferredLanguage === 'Not recorded' ? '' : guest?.preferredLanguage ?? 'English',
    status: guest?.status ?? 'ACTIVE',
    vipStatus: guest?.vipStatus ?? false,
  };
}

export function formValuesToPayload(values: GuestFormValues): GuestPayloadDto {
  return {
    alternatePhone: values.alternatePhone.trim() || undefined,
    blacklistStatus: values.blacklistStatus,
    displayName: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
    email: values.email.trim() || undefined,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    nationality: values.nationality.trim() || undefined,
    phone: values.phone.trim(),
    preferredLanguage: values.preferredLanguage.trim() || undefined,
    status: values.blacklistStatus ? 'BLACKLISTED' : values.status,
    vipStatus: values.vipStatus,
  };
}
