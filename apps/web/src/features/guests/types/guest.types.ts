export type GuestStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';

export type Guest = {
  alternatePhone: string;
  blacklistStatus: boolean;
  displayName: string;
  email: string;
  firstName: string;
  fullName: string;
  id: string;
  initials: string;
  lastName: string;
  lastStay: string;
  nationality: string;
  notes: string;
  phone: string;
  preferredLanguage: string;
  status: GuestStatus;
  upcomingBooking: string;
  vipStatus: boolean;
  reservations?: GuestReservationSummary[];
};

export type GuestReservationSummary = {
  arrivalDate: string;
  id: string;
};

export type GuestFormValues = {
  alternatePhone: string;
  blacklistStatus: boolean;
  email: string;
  firstName: string;
  lastName: string;
  nationality: string;
  phone: string;
  preferredLanguage: string;
  status: GuestStatus;
  vipStatus: boolean;
};

export type GuestFilter = 'all' | 'vip' | 'active' | 'blacklisted';
