import type { CSSProperties, ReactNode } from 'react';

export type RoomStatus =
  | 'ready'
  | 'occupied'
  | 'cleaning'
  | 'dirty'
  | 'inspection'
  | 'maintenance'
  | 'out-of-order'
  | 'out-of-service'
  | 'reserved'
  | 'vacant';

export type RoomAction =
  | 'mark-ready'
  | 'start-cleaning'
  | 'inspection'
  | 'maintenance'
  | 'out-of-order'
  | 'out-of-service';

export type Room = {
  accessible: boolean;
  amenities: string[];
  bedType: string;
  bookingId?: string;
  capacity: string;
  checkInTime?: string;
  connecting: boolean;
  departureDate?: string;
  floor: string;
  guest?: string;
  guestCount?: number;
  housekeeping: {
    assignedStaff: string;
    estimatedFinish: string;
    inspection: string;
    started: string;
    status: string;
  };
  id?: string;
  maintenance: {
    engineer: string;
    issue: string;
    priority: string;
    status: string;
  };
  number: string;
  paymentStatus?: string;
  reservation: string;
  reservationArrivalDate?: string;
  reservationDepartureDate?: string;
  reservationId?: string;
  roomType: string;
  roomTypeId?: string;
  stayDates: string;
  status: RoomStatus;
  stayHref?: string;
  timeline: Array<{ label: string; time: string }>;
  view: string;
  vip: boolean;
};

export type InventoryState = {
  activePropertyName?: string;
  error?: string;
  floors: string[];
  isFallback: boolean;
  isLoading: boolean;
  propertyId?: string;
  rooms: Room[];
};

export type FiltersState = {
  accessible: boolean;
  connecting: boolean;
  floor: string;
  housekeeping: string;
  maintenance: string;
  query: string;
  roomType: string;
  status: string;
  vip: boolean;
};

export type RoomSummary = {
  detail: string;
  icon: ReactNode;
  label: string;
  tone: string;
  value: number;
};

export type RoomTone = {
  background: string;
  border: string;
  color: string;
};

export type CardStyle = CSSProperties;
