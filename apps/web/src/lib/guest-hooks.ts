'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getProperties,
  getPropertyGuest,
  getPropertyGuests,
  type GuestDto,
  type GuestPropertyDto,
} from './guest-api';

export type Guest = {
  badges: string[];
  companyName?: string;
  email: string;
  id: string;
  initials: string;
  insights: string[];
  isFallback?: boolean;
  isVip: boolean;
  lastStay: string;
  lifetimeSpend: string;
  mobile: string;
  name: string;
  note: string;
  preferredRoom: string;
  preferences: string[];
  profileUrl: string;
  snapshot: [string, string][];
  totalStays: string;
};

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

const mockGuests: Guest[] = [
  createMockGuest('ananya-rao', 'Ananya Rao', true, 'Jaipur Textiles Pvt Ltd'),
  createMockGuest('jaipur-textiles-group', 'Jaipur Textiles Group', false, 'Jaipur Textiles Group'),
  createMockGuest('mr-kapoor', 'Mr Kapoor', true),
  createMockGuest('rhea-malhotra', 'Rhea Malhotra', false),
  createMockGuest('dev-sharma', 'Dev Sharma', false),
];

function createMockGuest(id: string, name: string, isVip: boolean, companyName?: string): Guest {
  const preferences = isVip ? ['VIP handling', 'High floor'] : ['Standard preferences pending'];

  return {
    badges: [isVip ? 'VIP' : 'Guest', companyName ? 'Corporate' : 'Individual'].filter(Boolean),
    companyName,
    email: 'Not connected',
    id,
    initials: initialsFor(name),
    insights: ['Demo fallback guest. Live backend data is unavailable.'],
    isFallback: true,
    isVip,
    lastStay: 'Not connected',
    lifetimeSpend: 'Not connected',
    mobile: 'Not connected',
    name,
    note: companyName ? `${name} is linked to ${companyName}.` : `${name} guest profile.`,
    preferredRoom: 'Not connected',
    preferences,
    profileUrl: `/guests/${id}`,
    snapshot: [
      ['Contact details', 'Not connected'],
      ['Company', companyName ?? 'Not recorded'],
      ['Profile source', 'Demo fallback'],
    ],
    totalStays: 'Not connected',
  };
}

function getString(record: Record<string, unknown> | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function getNumber(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }

  return undefined;
}

function getBoolean(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return false;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', 'yes', '1', 'vip'].includes(value.toLowerCase());
  }

  return false;
}

function getRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  }

  return undefined;
}

function getStringArray(record: Record<string, unknown>, keys: string[], fallback: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item : getString(item as Record<string, unknown>, ['name', 'label', 'title', 'value'])))
        .filter(Boolean);
    }
  }

  return fallback;
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
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

function getActiveProperty(properties: GuestPropertyDto[]) {
  return properties.find(isActiveRecord);
}

function formatMoney(value: string) {
  return value || 'Not connected';
}

export function mapGuest(dto: GuestDto): Guest {
  const profile = getRecord(dto, ['profile', 'guestProfile']) ?? {};
  const contact = getRecord(dto, ['contact', 'contactDetails']) ?? {};
  const company = getRecord(dto, ['company', 'organization', 'corporateAccount']) ?? {};
  const name =
    getString(dto, ['name', 'fullName', 'displayName', 'guestName']) ||
    [getString(dto, ['firstName']), getString(dto, ['lastName'])].filter(Boolean).join(' ') ||
    'Unnamed guest';
  const id = getString(dto, ['id', '_id', 'uuid', 'guestId', 'slug'], name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const companyName = getString(dto, ['companyName', 'company_name', 'organizationName'], getString(company, ['name', 'displayName']));
  const isVip =
    getBoolean(dto, ['isVip', 'vip', 'vipStatus']) ||
    getBoolean(profile, ['isVip', 'vip', 'vipStatus']) ||
    getString(dto, ['segment', 'tier', 'guestType']).toLowerCase() === 'vip';
  const totalStays = getNumber(dto, ['totalStays', 'stayCount', 'visits']);
  const lifetimeSpend = getString(dto, ['lifetimeSpend', 'totalSpend', 'lifetimeValue']);
  const preferences = getStringArray(dto, ['preferences', 'preferenceTags'], getStringArray(profile, ['preferences', 'preferenceTags'], []));
  const badges = [
    isVip ? 'VIP' : '',
    totalStays && totalStays > 1 ? 'Returning Guest' : '',
    companyName ? 'Corporate' : '',
    ...getStringArray(dto, ['badges', 'tags'], []),
  ].filter(Boolean);
  const mobile = getString(dto, ['mobile', 'phone', 'phoneNumber'], getString(contact, ['mobile', 'phone', 'phoneNumber']));
  const email = getString(dto, ['email'], getString(contact, ['email']));
  const note = getString(dto, ['notes', 'note', 'summary'], 'No notes added for this guest.');

  return {
    badges: Array.from(new Set(badges.length > 0 ? badges : ['Guest'])),
    companyName: companyName || undefined,
    email: email || 'Not recorded',
    id,
    initials: initialsFor(name),
    insights: [
      isVip ? 'VIP guest. High-touch handling applies.' : '',
      companyName ? `Company account: ${companyName}.` : '',
      preferences.length > 0 ? `Preferences: ${preferences.slice(0, 3).join(', ')}.` : '',
      'Stay history, billing, documents, and service activity are not wired yet.',
    ].filter(Boolean),
    isVip,
    lastStay: getString(dto, ['lastStay', 'lastStayDate', 'lastStayedAt'], 'Not connected'),
    lifetimeSpend: formatMoney(lifetimeSpend),
    mobile: mobile || 'Not recorded',
    name,
    note,
    preferredRoom: getString(dto, ['preferredRoom', 'preferredRoomType'], getString(profile, ['preferredRoom', 'preferredRoomType'], 'Not connected')),
    preferences: preferences.length > 0 ? preferences : ['No backend preferences recorded'],
    profileUrl: `/guests/${id}`,
    snapshot: [
      ['Contact details', [mobile, email].filter(Boolean).join(' - ') || 'Not recorded'],
      ['Company', companyName || 'Not recorded'],
      ['Guest type', isVip ? 'VIP' : 'Standard'],
      ['Preferred room', getString(dto, ['preferredRoom', 'preferredRoomType'], 'Not connected')],
      ['Nationality', getString(dto, ['nationality'], 'Not recorded')],
      ['Preferred language', getString(dto, ['preferredLanguage', 'language'], 'Not recorded')],
      ['GST details', getString(dto, ['gstNumber', 'gstDetails'], 'Not connected')],
    ],
    totalStays: totalStays === undefined ? 'Not connected' : `${totalStays} ${totalStays === 1 ? 'stay' : 'stays'}`,
  };
}

async function getCurrentProperty(signal?: AbortSignal) {
  const properties = await getProperties(signal);
  const activeProperty = getActiveProperty(properties);
  const propertyId = activeProperty ? getPropertyId(activeProperty) : '';

  if (!activeProperty || !propertyId) {
    throw new Error('No active property returned from properties API.');
  }

  return {
    propertyId,
    propertyName: getPropertyName(activeProperty),
  };
}

export function useGuests({ allowMockFallback, enabled }: GuestHookOptions): GuestState & { refreshGuests: () => Promise<void> } {
  const [state, setState] = useState<GuestState>({
    guests: [],
    isFallback: false,
    isLoading: true,
  });

  const loadGuests = useCallback(async (signal?: AbortSignal) => {
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
      const guests = (await getPropertyGuests(propertyId, signal)).filter(isActiveRecord).map(mapGuest);

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
        error: 'Guest profiles are temporarily unavailable.',
        guests: [],
        isFallback: false,
        isLoading: false,
      });
    }
  }, [allowMockFallback, enabled]);

  useEffect(() => {
    const controller = new AbortController();

    void loadGuests(controller.signal);

    return () => controller.abort();
  }, [loadGuests]);

  const refreshGuests = useCallback(() => loadGuests(), [loadGuests]);

  return { ...state, refreshGuests };
}

export function useGuestDetails({
  allowMockFallback,
  enabled,
  guestId,
}: GuestHookOptions & { guestId: string }): GuestDetailState & { refreshGuest: () => Promise<void> } {
  const [state, setState] = useState<GuestDetailState>({
    isFallback: false,
    isLoading: true,
  });

  const loadGuest = useCallback(async (signal?: AbortSignal) => {
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
        error: 'Guest profile is temporarily unavailable.',
        guest: undefined,
        isFallback: false,
        isLoading: false,
      });
    }
  }, [allowMockFallback, enabled, guestId]);

  useEffect(() => {
    const controller = new AbortController();

    void loadGuest(controller.signal);

    return () => controller.abort();
  }, [loadGuest]);

  const refreshGuest = useCallback(() => loadGuest(), [loadGuest]);

  return { ...state, refreshGuest };
}
