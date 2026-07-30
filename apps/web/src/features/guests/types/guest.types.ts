export type GuestStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';

export type Guest = {
  alternatePhone: string;
  blacklistStatus: boolean;
  bedPreference: string;
  dietaryNotes: string;
  displayName: string;
  email: string;
  firstName: string;
  floorPreference: string;
  fullName: string;
  id: string;
  initials: string;
  lastName: string;
  lastStay: string;
  nationality: string;
  notes: string;
  phone: string;
  preferredLanguage: string;
  roomPreference: string;
  smokingPreference: string;
  status: GuestStatus;
  upcomingBooking: string;
  vipStatus: boolean;
  reservations?: GuestReservationSummary[];
};

export type GuestReservationSummary = {
  arrivalDate: string;
  id: string;
  status: string;
};

export type GuestFormValues = {
  alternatePhone: string;
  bedPreference: string;
  blacklistStatus: boolean;
  dietaryNotes: string;
  displayName: string;
  email: string;
  firstName: string;
  floorPreference: string;
  lastName: string;
  nationality: string;
  notes: string;
  phone: string;
  preferredLanguage: string;
  roomPreference: string;
  smokingPreference: string;
  status: GuestStatus;
  vipStatus: boolean;
};

export type GuestFilter = 'all' | 'vip' | 'active' | 'blacklisted';
