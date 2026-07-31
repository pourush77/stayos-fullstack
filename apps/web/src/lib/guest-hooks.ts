'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createPropertyGuest,
  getProperties,
  getPropertyGuest,
  getPropertyGuests,
  updatePropertyGuest,
  type GuestPropertyDto,
} from './guest-api';
import { mockGuests } from '../features/guests/constants/guest.constants';
import type { Guest, GuestFormValues } from '../features/guests/types/guest.types';
import { formValuesToPayload, mapGuest } from '../features/guests/utils/guest-mappers';

type GuestState = {
  activePropertyName?: string;
  error?: string;
  guests: Guest[];
  isFallback: boolean;
  isLoading: boolean;
  propertyId?: string;
};

type GuestDetailState = Omit<GuestState, 'guests'> & {
  guest?: Guest;
};

type GuestHookOptions = {
  allowMockFallback: boolean;
  enabled: boolean;
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

function getPropertyId(property: GuestPropertyDto) {
  return getString(property, ['id', '_id', 'uuid', 'propertyId']);
}

function getPropertyName(property: GuestPropertyDto) {
  return getString(property, ['name', 'title', 'displayName']);
}

async function getCurrentProperty(signal?: AbortSignal) {
  const properties = await getProperties(signal);
  const activeProperty = properties.find(isActiveRecord);
  const propertyId = activeProperty ? getPropertyId(activeProperty) : '';

  if (!activeProperty || !propertyId) {
    throw new Error('No active property returned from properties API.');
  }

  return {
    propertyId,
    propertyName: getPropertyName(activeProperty),
  };
}

export function friendlyGuestError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('phone') && (message.includes('exists') || message.includes('duplicate'))) {
    return 'Phone already exists.';
  }

  if (message.includes('email') && (message.includes('exists') || message.includes('duplicate'))) {
    return 'Email already exists.';
  }

  return 'Unable to save guest.';
}

export function useGuests({ allowMockFallback, enabled }: GuestHookOptions): GuestState & {
  createGuest: (values: GuestFormValues) => Promise<Guest>;
  refreshGuests: () => Promise<void>;
  searchGuests: (search: string, signal?: AbortSignal) => Promise<Guest[]>;
} {
  const [state, setState] = useState<GuestState>({
    guests: [],
    isFallback: false,
    isLoading: true,
  });

  const loadGuests = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) {
        setState((currentState) => ({
          ...currentState,
          error: undefined,
          guests: [],
          isFallback: false,
          isLoading: false,
        }));
        return;
      }

      setState((currentState) => ({
        ...currentState,
        error: undefined,
        isLoading: currentState.guests.length === 0,
      }));

      try {
        const { propertyId, propertyName } = await getCurrentProperty(signal);
        const guests = (await getPropertyGuests(propertyId, signal)).map(mapGuest);

        setState({
          activePropertyName: propertyName,
          guests,
          isFallback: false,
          isLoading: false,
          propertyId,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        if (allowMockFallback) {
          setState({
            error: error instanceof Error ? error.message : 'Guest API is unavailable.',
            guests: mockGuests,
            isFallback: true,
            isLoading: false,
          });
          return;
        }

        setState({
          error: 'Unable to load guests.',
          guests: [],
          isFallback: false,
          isLoading: false,
        });
      }
    },
    [allowMockFallback, enabled],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadGuests(controller.signal);
    return () => controller.abort();
  }, [loadGuests]);

  const refreshGuests = useCallback(() => loadGuests(), [loadGuests]);

  const createGuest = useCallback(
    async (values: GuestFormValues) => {
      const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
      const guest = mapGuest(await createPropertyGuest(propertyId, formValuesToPayload(values)));
      setState((current) => ({
        ...current,
        guests: [guest, ...current.guests.filter((item) => item.id !== guest.id)],
      }));
      await loadGuests();
      return guest;
    },
    [loadGuests, state.propertyId],
  );

  const searchGuests = useCallback(
    async (search: string, signal?: AbortSignal) => {
      const propertyId = state.propertyId || (await getCurrentProperty(signal)).propertyId;
      return (await getPropertyGuests(propertyId, signal, search)).map(mapGuest);
    },
    [state.propertyId],
  );

  return { ...state, createGuest, refreshGuests, searchGuests };
}

export function useGuestDetails({
  allowMockFallback,
  enabled,
  guestId,
}: GuestHookOptions & { guestId: string }): GuestDetailState & {
  refreshGuest: () => Promise<void>;
  updateGuest: (values: GuestFormValues) => Promise<Guest>;
} {
  const [state, setState] = useState<GuestDetailState>({
    isFallback: false,
    isLoading: true,
  });

  const loadGuest = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled || !guestId) {
        setState((currentState) => ({
          ...currentState,
          error: undefined,
          guest: undefined,
          isFallback: false,
          isLoading: false,
        }));
        return;
      }

      setState((currentState) => ({
        ...currentState,
        error: undefined,
        isLoading: !currentState.guest,
      }));

      try {
        const { propertyId, propertyName } = await getCurrentProperty(signal);
        const guest = mapGuest(await getPropertyGuest(propertyId, guestId, signal));

        setState({
          activePropertyName: propertyName,
          guest,
          isFallback: false,
          isLoading: false,
          propertyId,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;

        if (allowMockFallback) {
          setState({
            error: error instanceof Error ? error.message : 'Guest API is unavailable.',
            guest: mockGuests.find((guest) => guest.id === guestId) ?? mockGuests[0],
            isFallback: true,
            isLoading: false,
          });
          return;
        }

        setState({
          error: 'Unable to load guest.',
          guest: undefined,
          isFallback: false,
          isLoading: false,
        });
      }
    },
    [allowMockFallback, enabled, guestId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadGuest(controller.signal);
    return () => controller.abort();
  }, [loadGuest]);

  const refreshGuest = useCallback(() => loadGuest(), [loadGuest]);

  const updateGuest = useCallback(
    async (values: GuestFormValues) => {
      const propertyId = state.propertyId || (await getCurrentProperty()).propertyId;
      const guest = mapGuest(
        await updatePropertyGuest(propertyId, guestId, formValuesToPayload(values)),
      );
      await loadGuest();
      return guest;
    },
    [guestId, loadGuest, state.propertyId],
  );

  return { ...state, refreshGuest, updateGuest };
}

export type { Guest, GuestFormValues };
