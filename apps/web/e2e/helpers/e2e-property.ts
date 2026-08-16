import { type Page } from '@playwright/test';
import {
  assertE2EInventoryCounts,
  E2E_PROPERTY_CODE,
  E2E_ROOM_NUMBERS,
  E2E_ROOM_TYPE_CODES,
  ensureE2EPropertyFixture,
  resetE2ETransactionalData,
} from './e2e-db';

type ApiEnvelope<T> = T | { data?: T } | { items?: T } | { results?: T };
type LooseRecord = Record<string, unknown>;

export type E2ERoom = {
  floorId: string;
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomType?: { code?: string; id?: string; name?: string };
};

export type E2ERoomType = {
  code: string;
  id: string;
  name: string;
};

export type E2EPropertyFixture = {
  id: string;
  rooms: Record<(typeof E2E_ROOM_NUMBERS)[number], E2ERoom>;
  roomTypes: Record<(typeof E2E_ROOM_TYPE_CODES)[number], E2ERoomType>;
};

export function resetE2EPropertyState() {
  ensureE2EPropertyFixture();
  resetE2ETransactionalData();
  assertE2EInventoryCounts();
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload && typeof payload === 'object') {
    if ('data' in payload && payload.data !== undefined) return payload.data;
    if ('items' in payload && payload.items !== undefined) return payload.items;
    if ('results' in payload && payload.results !== undefined) return payload.results;
  }
  return payload as T;
}

async function accessToken(page: Page) {
  const token = await page.evaluate(
    () =>
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken'),
  );
  if (!token) throw new Error('No StayOS access token found after login.');
  return token;
}

export async function e2eApi<T>(
  page: Page,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const apiBase = process.env.E2E_API_BASE_URL ?? 'http://localhost:3002/api/v1';
  const response = await page.request.fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${await accessToken(page)}`,
      'Content-Type': 'application/json',
    },
    data: body,
  });
  const raw = await response.text();
  const parsed = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : undefined;
  if (!response.ok()) throw new Error(`${method} ${path} failed (${response.status()}): ${raw}`);
  return parsed === undefined ? (undefined as T) : unwrap(parsed);
}

export async function ensureE2EProperty(page: Page): Promise<E2EPropertyFixture> {
  ensureE2EPropertyFixture();
  assertE2EInventoryCounts();

  const properties = await e2eApi<LooseRecord[]>(page, 'GET', '/properties');
  const property = properties.find((item) => String(item.code ?? '') === E2E_PROPERTY_CODE);
  const propertyId = String(property?.id ?? '');
  if (!propertyId) throw new Error(`Property ${E2E_PROPERTY_CODE} was not found.`);

  const roomTypes = await e2eApi<E2ERoomType[]>(page, 'GET', `/properties/${propertyId}/room-types`);
  const rooms = await e2eApi<E2ERoom[]>(page, 'GET', `/properties/${propertyId}/rooms`);

  const fixedRoomTypes = Object.fromEntries(
    E2E_ROOM_TYPE_CODES.map((code) => {
      const roomType = roomTypes.find((item) => item.code === code);
      if (!roomType) throw new Error(`Missing E2E room type ${code}.`);
      return [code, roomType];
    }),
  ) as E2EPropertyFixture['roomTypes'];

  const fixedRooms = Object.fromEntries(
    E2E_ROOM_NUMBERS.map((roomNumber) => {
      const room = rooms.find((item) => item.roomNumber === roomNumber);
      if (!room) throw new Error(`Missing E2E room ${roomNumber}.`);
      return [roomNumber, room];
    }),
  ) as E2EPropertyFixture['rooms'];

  if (roomTypes.length !== E2E_ROOM_TYPE_CODES.length || rooms.length !== E2E_ROOM_NUMBERS.length) {
    throw new Error(
      `${E2E_PROPERTY_CODE} inventory drift: ${rooms.length} rooms and ${roomTypes.length} room types.`,
    );
  }

  return { id: propertyId, rooms: fixedRooms, roomTypes: fixedRoomTypes };
}
