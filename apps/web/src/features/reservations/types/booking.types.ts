export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
export type BookingPaymentStatus = 'PAID' | 'PAYMENT_DUE';
export type BookingSource = 'DIRECT' | 'WALK_IN' | 'OTA' | 'CORPORATE';
export type BookingFilter =
  | 'all'
  | 'arrivals-today'
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
  source: BookingSource;
  specialRequests: string;
  status: BookingStatus;
};

export type BookingFormValues = {
  adults: number;
  arrivalDate: string;
  children: number;
  departureDate: string;
  guestId: string;
  notes: string;
  paymentStatus: BookingPaymentStatus;
  roomTypeId: string;
  source: BookingSource;
  specialRequests: string;
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
};

export type AvailableRoomOption = {
  id: string;
  label: string;
  roomType: string;
};
