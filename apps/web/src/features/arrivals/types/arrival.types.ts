import type { Booking, BookingFormValues, GuestOption, RoomTypeOption } from '../../reservations/types/booking.types';
import type { Guest, GuestFormValues } from '../../guests/types/guest.types';

export type ArrivalFlow = 'reservation' | 'returning' | 'walk-in';
export type ArrivalStep = 'select' | 'search' | 'guest' | 'booking' | 'room' | 'check-in' | 'complete';

export type ArrivalRoomOption = {
  id: string;
  label: string;
  roomType: string;
};

export type ArrivalState = {
  booking?: Booking;
  flow?: ArrivalFlow;
  guest?: Guest;
  guestOptions: GuestOption[];
  isLoading: boolean;
  propertyId?: string;
  roomOptions: ArrivalRoomOption[];
  roomTypes: RoomTypeOption[];
  selectedRoomId?: string;
  step: ArrivalStep;
};

export type ArrivalActions = {
  assignRoom: (roomId: string) => Promise<void>;
  checkIn: () => Promise<void>;
  createBooking: (values: BookingFormValues) => Promise<Booking>;
  createGuest: (values: GuestFormValues) => Promise<Guest>;
  loadRooms: () => Promise<void>;
  reset: () => void;
  searchBookings: (query: string) => Booking[];
  searchGuests: (query: string) => GuestOption[];
  selectBooking: (booking: Booking) => void;
  selectFlow: (flow: ArrivalFlow) => void;
  selectGuest: (guestId: string) => void;
  setStep: (step: ArrivalStep) => void;
};
