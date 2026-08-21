export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type BookingPaymentStatus = 'PAID' | 'PAYMENT_DUE' | 'PARTIALLY_PAID';
export type BookingSource = 'DIRECT' | 'WALK_IN' | 'OTA' | 'CORPORATE';
export type BookingFilter =
  | 'all'
  | 'arrivals-today'
  | 'departures-today'
  | 'pending'
  | 'confirmed'
  | 'checked-in'
  | 'unassigned'
  | 'payment-due'
  | 'vip'
  | 'cancelled';

export type Booking = {
  adults: number;
  arrivalDate: string;
  backendId: string;
  bookingId: string;
  children: number;
  childAges?: number[];
  departureDate: string;
  email: string;
  guestId?: string;
  guestName: string;
  isVip: boolean;
  nationality: string;
  nights: number;
  notes: string;
  paymentStatus: BookingPaymentStatus;
  phone: string;
  room: string;
  roomId?: string;
  roomType: string;
  roomTypeId?: string;
  ratePlan?: {
    id?: string | null;
    code?: string | null;
    name?: string | null;
    mealPlan?: string | null;
    refundable?: boolean | null;
    nightlyRate?: string | null;
  } | null;
  source: BookingSource;
  specialRequests: string;
  status: BookingStatus;
};

export type BookingFormValues = {
  adults: number;
  arrivalDate: string;
  children: number;
  childAges?: number[];
  departureDate: string;
  guestId: string;
  notes: string;
  paymentStatus: BookingPaymentStatus;
  roomTypeId: string;
  ratePlanId?: string;
  source: BookingSource;
  specialRequests: string;
  deposit?: {
    amount: number;
    method: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'WALLET' | 'OTHER';
  };
};

export type GuestOption = {
  email: string;
  id: string;
  isVip: boolean;
  label: string;
  nationality: string;
  phone: string;
};

export type RoomTypeOption = {
  baseRate: number;
  capacity: number;
  id: string;
  label: string;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
};

export type AvailableRoomOption = {
  id: string;
  label: string;
  roomType: string;
};
