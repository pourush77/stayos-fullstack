import type { GuestStatus } from '../types/guest.types';

export function statusLabel(status: GuestStatus) {
  if (status === 'BLACKLISTED') return 'Blacklisted';
  if (status === 'INACTIVE') return 'Inactive';
  return 'Active';
}

export function initialsFor(firstName: string, lastName: string, displayName: string) {
  const source = [firstName, lastName].filter(Boolean).join(' ') || displayName;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
