export type StayPaymentStatus = 'Paid' | 'Payment Due';

export type StayTimelineItem = {
  detail: string;
  timestamp: string;
  title: string;
};

export type StayAttentionItem = {
  detail: string;
  tone: 'warning' | 'danger' | 'info';
  title: string;
};

export type StayAllowedActions = {
  canApproveLateCheckout: boolean;
  canCheckOut: boolean;
  canExtendStay: boolean;
  canMoveRoom: boolean;
};

export type StayDocument = {
  label: string;
  status: string;
};

export type StayLateCheckout = {
  approvedUntil: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  notes?: string | null;
  effectiveCheckoutTime?: string | null;
  operationalStatus?: string | null;
  standardCheckoutTime?: string | null;
  fee?: { chargeMode: string; chargeValue: number; amount: string } | null;
  feeAlreadyApplied?: boolean;
};

export type StayBilling = {
  balance: string;
  deposit: string;
  isConnected: boolean;
  outstandingAmount: string;
  paymentStatus: StayPaymentStatus;
  roomCharges: string;
};

export type Stay = {
  activity: StayTimelineItem[];
  additionalGuests: string[];
  adults: number;
  allowedActions: StayAllowedActions;
  arrivalDate: string;
  billing: StayBilling;
  blacklistStatus: boolean;
  bookingId: string;
  children: number;
  departureDate: string;
  documents: StayDocument[];
  floor: string;
  guestEmail: string;
  guestId?: string;
  guestName: string;
  guestNotes: string;
  guestPhone: string;
  internalNotes: string;
  isVip: boolean;
  language: string;
  lateCheckout?: StayLateCheckout;
  nationality: string;
  nights: number;
  outstandingAmount: string;
  paymentStatus: StayPaymentStatus;
  preferences: string[];
  remainingNights: number;
  requests: string[];
  roomId?: string;
  roomNumber: string;
  roomStatus: string;
  roomType: string;
  roomTypeId?: string;
  status: string;
  warnings: StayAttentionItem[];
};
