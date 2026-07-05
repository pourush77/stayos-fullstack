'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPropertyGuest, getProperties, getPropertyGuests, type GuestPropertyDto } from '../../../lib/guest-api';
import { getAvailableRooms } from '../../../lib/operations-api';
import {
  assignRoomToReservation,
  checkInReservation,
  createPropertyReservation,
  getPropertyReservations,
} from '../../../lib/reservation-api';
import { getPropertyRoomTypes } from '../../../lib/inventory-api';
import { mapGuest } from '../../guests/utils/guest-mappers';
import { formValuesToPayload as guestPayload } from '../../guests/utils/guest-mappers';
import type { Guest, GuestFormValues } from '../../guests/types/guest.types';
import { formValuesToPayload as bookingPayload, mapAvailableRoom, mapBooking, mapGuestOption, mapRoomTypeOption } from '../../reservations/utils/booking-mappers';
import type { Booking, BookingFormValues } from '../../reservations/types/booking.types';
import type { ArrivalActions, ArrivalFlow, ArrivalState, ArrivalStep } from '../types/arrival.types';
import { guestToGuestOption } from '../utils/arrival-mapper';

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
  const propertyId = activeProperty ? getString(activeProperty as GuestPropertyDto, ['id', '_id', 'uuid', 'propertyId']) : '';

  if (!activeProperty || !propertyId) throw new Error('No active property returned from properties API.');

  return {
    propertyId,
    propertyName: getString(activeProperty as GuestPropertyDto, ['name', 'title', 'displayName']),
  };
}

export function useArrival({ enabled }: { enabled: boolean }): ArrivalState & ArrivalActions {
  const [state, setState] = useState<ArrivalState>({
    guestOptions: [],
    isLoading: false,
    roomOptions: [],
    roomTypes: [],
    step: 'select',
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return;

    setState((current) => ({ ...current, isLoading: true }));

    const { propertyId } = await getCurrentProperty(signal);
    const [guestDtos, reservationDtos, roomTypeDtos] = await Promise.all([
      getPropertyGuests(propertyId, signal),
      getPropertyReservations(propertyId, signal),
      getPropertyRoomTypes(propertyId, signal),
    ]);
    const nextGuests = guestDtos.map(mapGuest);
    const nextGuestOptions = guestDtos.map(mapGuestOption);
    const nextBookings = reservationDtos.map(mapBooking);
    const nextRoomTypes = roomTypeDtos.map(mapRoomTypeOption);

    setGuests(nextGuests);
    setBookings(nextBookings);
    setState((current) => ({
      ...current,
      guestOptions: nextGuestOptions,
      isLoading: false,
      propertyId,
      roomTypes: nextRoomTypes,
    }));
  }, [enabled]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(() => {
      setState((current) => ({ ...current, isLoading: false }));
    });
    return () => controller.abort();
  }, [load]);

  const reset = useCallback(() => {
    setState((current) => ({
      guestOptions: current.guestOptions,
      isLoading: false,
      propertyId: current.propertyId,
      roomOptions: [],
      roomTypes: current.roomTypes,
      step: 'select',
    }));
  }, []);

  const setStep = useCallback((step: ArrivalStep) => {
    setState((current) => ({ ...current, step }));
  }, []);

  const selectFlow = useCallback((flow: ArrivalFlow) => {
    setState((current) => ({ ...current, flow, step: flow === 'walk-in' ? 'guest' : 'search' }));
  }, []);

  const selectBooking = useCallback((booking: Booking) => {
    setState((current) => ({ ...current, booking, step: booking.room === 'Unassigned' ? 'room' : 'check-in' }));
  }, []);

  const selectGuest = useCallback((guestId: string) => {
    const guest = guests.find((item) => item.id === guestId);
    setState((current) => ({ ...current, guest, step: 'booking' }));
  }, [guests]);

  const searchBookings = useCallback((query: string) => {
    const normalized = query.trim().toLowerCase();
    return bookings
      .filter((booking) => ['PENDING', 'CONFIRMED'].includes(booking.status))
      .filter((booking) =>
        normalized
          ? [booking.bookingId, booking.guestName, booking.phone, booking.email, booking.roomType]
              .join(' ')
              .toLowerCase()
              .includes(normalized)
          : true,
      )
      .slice(0, 8);
  }, [bookings]);

  const searchGuests = useCallback((query: string) => {
    const normalized = query.trim().toLowerCase();
    return state.guestOptions
      .filter((guest) =>
        normalized
          ? [guest.label, guest.phone, guest.email].join(' ').toLowerCase().includes(normalized)
          : true,
      )
      .slice(0, 8);
  }, [state.guestOptions]);

  const createGuest = useCallback(async (values: GuestFormValues) => {
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    const guest = mapGuest(await createPropertyGuest(propertyId, guestPayload(values)));
    const guestOption = guestToGuestOption(guest);

    setGuests((current) => [guest, ...current]);
    setState((current) => ({
      ...current,
      guest,
      guestOptions: [guestOption, ...current.guestOptions],
      step: 'booking',
    }));

    return guest;
  }, [state.propertyId]);

  const createBooking = useCallback(async (values: BookingFormValues) => {
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    const booking = mapBooking(await createPropertyReservation(propertyId, bookingPayload(values)));

    setBookings((current) => [booking, ...current]);
    setState((current) => ({ ...current, booking, step: 'room' }));
    return booking;
  }, [state.propertyId]);

  const loadRooms = useCallback(async () => {
    if (!state.booking) return;
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    const rooms = await getAvailableRooms(propertyId, {
      arrivalDate: state.booking.arrivalDate,
      departureDate: state.booking.departureDate,
      guestCount: state.booking.adults + state.booking.children,
      roomTypeId: state.booking.roomTypeId,
    });

    setState((current) => ({ ...current, roomOptions: rooms.map(mapAvailableRoom) }));
  }, [state.booking, state.propertyId]);

  const assignRoom = useCallback(async (roomId: string) => {
    if (!state.booking) throw new Error('Please select or create a booking before assigning a room.');
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    await assignRoomToReservation(propertyId, state.booking.backendId, roomId);
    const room = state.roomOptions.find((item) => item.id === roomId);

    setState((current) => ({
      ...current,
      booking: current.booking
        ? { ...current.booking, room: room?.label ?? 'Assigned room', roomId }
        : current.booking,
      selectedRoomId: roomId,
      step: 'check-in',
    }));
  }, [state.booking, state.propertyId, state.roomOptions]);

  const checkIn = useCallback(async () => {
    if (!state.booking) throw new Error('Please select or create a booking before check-in.');
    const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
    await checkInReservation(propertyId, state.booking.backendId);
    setState((current) => ({ ...current, step: 'complete' }));
  }, [state.booking, state.propertyId]);

  return useMemo(
    () => ({
      ...state,
      assignRoom,
      checkIn,
      createBooking,
      createGuest,
      loadRooms,
      reset,
      searchBookings,
      searchGuests,
      selectBooking,
      selectFlow,
      selectGuest,
      setStep,
    }),
    [assignRoom, checkIn, createBooking, createGuest, loadRooms, reset, searchBookings, searchGuests, selectBooking, selectFlow, selectGuest, setStep, state],
  );
}
