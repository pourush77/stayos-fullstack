import type { Guest } from '../types/guest.types';

export const guestStatusOptions = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Blacklisted', value: 'BLACKLISTED' },
];

export const guestFilterOptions = [
  { label: 'All', value: 'all' },
  { label: 'VIP', value: 'vip' },
  { label: 'Active', value: 'active' },
  { label: 'Blacklisted', value: 'blacklisted' },
];

export const documentPlaceholders = ['Aadhaar', 'Passport', 'Driving Licence', 'Visa'];

export const preferencePlaceholders = [
  ['Room preference', 'Not recorded'],
  ['Bed preference', 'Not recorded'],
  ['Smoking preference', 'Not recorded'],
  ['Floor preference', 'Not recorded'],
  ['Dietary notes', 'Not recorded'],
  ['Special notes', 'Not recorded'],
] as const;

export const mockGuests: Guest[] = [
  createMockGuest('rahul-sharma', 'Rahul', 'Sharma', '9876543210', 'rahul.sharma@example.com', 'Indian', true, 'Last stayed 12 Jun 2026', '12 Jul 2026'),
  createMockGuest('rhea-malhotra', 'Rhea', 'Malhotra', '9988776655', 'rhea.malhotra@example.com', 'Indian', false, 'Last stayed 02 May 2026', 'No upcoming booking'),
  createMockGuest('neha-gupta', 'Neha', 'Gupta', '9123456780', 'neha.gupta@example.com', 'Indian', false, 'No past stays', '18 Jul 2026'),
  createMockGuest('emily-johnson', 'Emily', 'Johnson', '+1 415 555 0198', 'emily.johnson@example.com', 'American', true, 'Last stayed 22 Mar 2026', 'No upcoming booking'),
  createMockGuest('david-miller', 'David', 'Miller', '+44 7700 900123', 'david.miller@example.com', 'British', false, 'Last stayed 19 Jan 2026', '29 Jul 2026'),
];

function createMockGuest(
  id: string,
  firstName: string,
  lastName: string,
  phone: string,
  email: string,
  nationality: string,
  vipStatus: boolean,
  lastStay: string,
  upcomingBooking: string,
): Guest {
  const fullName = `${firstName} ${lastName}`;

  return {
    alternatePhone: 'Not recorded',
    blacklistStatus: false,
    displayName: fullName,
    email,
    firstName,
    fullName,
    id,
    initials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
    lastName,
    lastStay,
    nationality,
    notes: vipStatus ? 'Prefers quiet rooms and a high-touch arrival experience.' : 'No notes added.',
    phone,
    preferredLanguage: 'English',
    status: 'ACTIVE',
    upcomingBooking,
    vipStatus,
  };
}
