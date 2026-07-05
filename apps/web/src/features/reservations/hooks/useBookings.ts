'use client';

import { useCallback, useEffect, useState } from 'react';
import { getPropertyGuests } from '../../../lib/guest-api';
import { getPropertyRoomTypes } from '../../../lib/inventory-api';
import { getAvailableRooms } from '../../../lib/operations-api';
import {
  assignRoomToReservation,
  cancelReservation,
  createPropertyReservation,
  getProperties,
  getPropertyReservation,
  getPropertyReservations,
  updatePropertyReservation,
  type ReservationPropertyDto,
} from '../../../lib/reservation-api';
import { mockBookings } from '../constants/booking.constants';
import type { AvailableRoomOption, Booking, BookingFormValues, GuestOption, RoomTypeOption } from '../types/booking.types';
import { formValuesToPayload, mapAvailableRoom, mapBooking, mapGuestOption, mapRoomTypeOption } from '../utils/booking-mappers';

type BookingState = {
  activePropertyName?: string;
  bookings: Booking[];
  error?: string;
  guests: GuestOption[];
  isFallback: boolean;
  isLoading: boolean;
  propertyId?: string;
  roomTypes: RoomTypeOption[];
};

type BookingDetailsState = Omit<BookingState, 'bookings'> & {
  booking?: Booking;
};

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function isActiveRecord(record: Record<string, unknown>) {
  return getString(record, ['status'], 'ACTIVE').toUpperCase() === 'ACTIVE';
}

async function getCurrentProperty(signal?: AbortSignal) {
  const properties = await getProperties(signal);
  const activeProperty = properties.find(isActiveRecord);
  const propertyId = activeProperty ? getString(activeProperty as ReservationPropertyDto, ['id', '_id', 'uuid', 'propertyId']) : '';

  if (!activeProperty || !propertyId) throw new Error('No active property returned from properties API.');

  return {
    propertyId,
    propertyName: getString(activeProperty as ReservationPropertyDto, ['name', 'title', 'displayName']),
  };
}

async function getLookups(propertyId: string, signal?: AbortSignal) {
  const [guests, roomTypes] = await Promise.all([
    getPropertyGuests(propertyId, signal),
    getPropertyRoomTypes(propertyId, signal),
  ]);

  return {
    guests: guests.map(mapGuestOption),
    roomTypes: roomTypes.map(mapRoomTypeOption),
  };
}

export function friendlyBookingError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('duplicate') || message.includes('already exists')) return 'A booking with this ID already exists.';
  if (message.includes('date')) return 'Departure date must be after arrival date.';
  if (message.includes('capacity')) return 'This room type cannot fit all guests.';
  if (message.includes('guest')) return 'Please select a guest before creating the booking.';
  return 'Bookings are temporarily unavailable.';
}

export function useBookings({ allowMockFallback, enabled }: { allowMockFallback: boolean; enabled: boolean }): BookingState & {
  createBooking: (values: BookingFormValues) => Promise<Booking>;
  refreshBookings: () => Promise<void>;
} {
  const [state, setState] = useState<BookingState>({
    bookings: [],
    guests: [],
    isFallback: false,
    isLoading: true,
    roomTypes: [],
  });

  const loadBookings = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) {
      setState((current) => ({ ...current, bookings: [], error: undefined, isFallback: false, isLoading: false }));
      return;
    }

    setState((current) => ({ ...current, error: undefined, isLoading: current.bookings.length === 0 }));

    try {
      const { propertyId, propertyName } = await getCurrentProperty(signal);
      const [reservationDtos, lookups] = await Promise.all([
        getPropertyReservations(propertyId, signal),
        getLookups(propertyId, signal),
      ]);

      setState({
        activePropertyName: propertyName,
        bookings: reservationDtos.map(mapBooking),
        guests: lookups.guests,
        isFallback: false,
        isLoading: false,
        propertyId,
        roomTypes: lookups.roomTypes,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (allowMockFallback) {
        setState({
          bookings: mockBookings,
          error: error instanceof Error ? error.message : 'Booking API is unavailable.',
          guests: [],
          isFallback: true,
          isLoading: false,
          roomTypes: [
            { capacity: 2, id: 'deluxe', label: 'Deluxe' },
            { capacity: 3, id: 'suite', label: 'Suite' },
          ],
        });
        return;
      }
      setState({ bookings: [], error: 'Bookings are temporarily unavailable.', guests: [], isFallback: false, isLoading: false, roomTypes: [] });
    }
  }, [allowMockFallback, enabled]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBookings(controller.signal);
    return () => controller.abort();
  }, [loadBookings]);

  const createBooking = useCallback(async (values: BookingFormValues) => {
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    const booking = mapBooking(await createPropertyReservation(propertyId, formValuesToPayload(values)));
    await loadBookings();
    return booking;
  }, [loadBookings, state.propertyId]);

  return { ...state, createBooking, refreshBookings: useCallback(() => loadBookings(), [loadBookings]) };
}

export function useBookingDetails({
  allowMockFallback,
  bookingId,
  enabled,
}: {
  allowMockFallback: boolean;
  bookingId?: string;
  enabled: boolean;
}): BookingDetailsState & {
  assignRoom: (roomId: string) => Promise<void>;
  cancelBooking: () => Promise<void>;
  getRooms: () => Promise<AvailableRoomOption[]>;
  refreshBooking: () => Promise<void>;
  updateBooking: (values: BookingFormValues) => Promise<Booking>;
} {
  const [state, setState] = useState<BookingDetailsState>({
    guests: [],
    isFallback: false,
    isLoading: true,
    roomTypes: [],
  });

  const loadBooking = useCallback(async (signal?: AbortSignal) => {
    if (!enabled || !bookingId) {
      setState((current) => ({ ...current, booking: undefined, error: undefined, isFallback: false, isLoading: false }));
      return;
    }

    setState((current) => ({ ...current, error: undefined, isLoading: !current.booking }));

    try {
      const { propertyId, propertyName } = await getCurrentProperty(signal);
      const [reservationDto, lookups] = await Promise.all([
        getPropertyReservation(propertyId, bookingId, signal),
        getLookups(propertyId, signal),
      ]);

      setState({
        activePropertyName: propertyName,
        booking: mapBooking(reservationDto),
        guests: lookups.guests,
        isFallback: false,
        isLoading: false,
        propertyId,
        roomTypes: lookups.roomTypes,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (allowMockFallback) {
        setState({
          booking: mockBookings.find((booking) => booking.backendId === bookingId || booking.bookingId === bookingId) ?? mockBookings[0],
          error: error instanceof Error ? error.message : 'Booking API is unavailable.',
          guests: [],
          isFallback: true,
          isLoading: false,
          roomTypes: [
            { capacity: 2, id: 'deluxe', label: 'Deluxe' },
            { capacity: 3, id: 'suite', label: 'Suite' },
          ],
        });
        return;
      }
      setState({ booking: undefined, error: 'Bookings are temporarily unavailable.', guests: [], isFallback: false, isLoading: false, roomTypes: [] });
    }
  }, [allowMockFallback, bookingId, enabled]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBooking(controller.signal);
    return () => controller.abort();
  }, [loadBooking]);

  const refreshBooking = useCallback(() => loadBooking(), [loadBooking]);

  const updateBooking = useCallback(async (values: BookingFormValues) => {
    if (!bookingId) throw new Error('Booking missing.');
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    const booking = mapBooking(await updatePropertyReservation(propertyId, bookingId, formValuesToPayload(values)));
    await loadBooking();
    return booking;
  }, [bookingId, loadBooking, state.propertyId]);

  const cancelBooking = useCallback(async () => {
    if (!bookingId) throw new Error('Booking missing.');
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    try {
      await cancelReservation(propertyId, bookingId);
    } catch {
      await updatePropertyReservation(propertyId, bookingId, { status: 'CANCELLED' });
    }
    await loadBooking();
  }, [bookingId, loadBooking, state.propertyId]);

  const assignRoom = useCallback(async (roomId: string) => {
    if (!bookingId) throw new Error('Booking missing.');
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    await assignRoomToReservation(propertyId, bookingId, roomId);
    await loadBooking();
  }, [bookingId, loadBooking, state.propertyId]);

  const getRooms = useCallback(async () => {
    const booking = state.booking;
    if (!booking) return [];
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    const rooms = await getAvailableRooms(propertyId, {
      arrivalDate: booking.arrivalDate,
      departureDate: booking.departureDate,
      guestCount: booking.adults + booking.children,
      roomTypeId: booking.roomTypeId,
    });
    return rooms.map(mapAvailableRoom);
  }, [state.booking, state.propertyId]);

  return { ...state, assignRoom, cancelBooking, getRooms, refreshBooking, updateBooking };
}
