import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { ensureE2EProperty, resetE2EPropertyState } from './helpers/e2e-property';

const frontDeskEmail = 'frontdesk@stayos.local';
const apiBaseUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:3002/api/v1';

test.use({
  baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
});

type RoomCandidate = {
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  arrivalDate: string;
  departureDate: string;
  rooms: Array<{
    roomId: string;
    roomNumber: string;
  }>;
};

async function discoverTwoAvailableRooms(page: Page): Promise<RoomCandidate> {
  const fixture = await ensureE2EProperty(page);
  const candidate = await page.evaluate(async ({ baseUrl, propertyId }) => {
    type ApiEnvelope<T> = T | { data?: T } | { items?: T } | { results?: T };

    type LooseRecord = Record<string, unknown>;

    const unwrap = <T>(payload: ApiEnvelope<T>): T => {
      if (payload && typeof payload === 'object') {
        if ('data' in payload && payload.data !== undefined) {
          return payload.data;
        }
        if ('items' in payload && payload.items !== undefined) {
          return payload.items;
        }
        if ('results' in payload && payload.results !== undefined) {
          return payload.results;
        }
      }
      return payload as T;
    };

    const token =
      window.localStorage.getItem('stayos.accessToken') ??
      window.sessionStorage.getItem('stayos.accessToken');

    if (!token) {
      throw new Error('No auth token available for reservation lifecycle discovery.');
    }

    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

    if (!propertyId) {
      throw new Error('No E2E property found.');
    }

    const toDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Try several future date windows so the test does not depend
    // on today's seed occupancy.
    for (let offset = 1; offset <= 21; offset += 1) {
      const arrival = new Date();
      arrival.setHours(12, 0, 0, 0);
      arrival.setDate(arrival.getDate() + offset);

      const departure = new Date(arrival);
      departure.setDate(departure.getDate() + 2);

      const arrivalDate = toDate(arrival);
      const departureDate = toDate(departure);

      const url = new URL(`${baseUrl}/properties/${propertyId}/operations/available-rooms`);

      url.searchParams.set('arrivalDate', arrivalDate);
      url.searchParams.set('departureDate', departureDate);
      url.searchParams.set('guestCount', '1');
      url.searchParams.set('adults', '1');
      url.searchParams.set('children', '0');

      const roomsResponse = await fetch(url.toString(), { headers });

      if (!roomsResponse.ok) {
        continue;
      }

      const rooms = unwrap<LooseRecord[]>(await roomsResponse.json());

      const byRoomType = new Map<
        string,
        {
          roomTypeId: string;
          roomTypeName: string;
          rooms: Array<{
            roomId: string;
            roomNumber: string;
          }>;
        }
      >();

      for (const room of rooms) {
        const roomType = (room.roomType ?? {}) as LooseRecord;

        const roomTypeId = String(roomType.id ?? '');
        const roomTypeName = String(roomType.name ?? roomType.code ?? 'Room');
        const roomId = String(room.roomId ?? room.id ?? '');
        const roomNumber = String(room.roomNumber ?? '');

        if (!roomTypeId || !roomId || !roomNumber) {
          continue;
        }

        const existing = byRoomType.get(roomTypeId) ?? {
          roomTypeId,
          roomTypeName,
          rooms: [],
        };

        existing.rooms.push({
          roomId,
          roomNumber,
        });

        byRoomType.set(roomTypeId, existing);
      }

      const usable = [...byRoomType.values()].find((group) => group.rooms.length >= 2);

      if (usable) {
        return {
          propertyId,
          roomTypeId: usable.roomTypeId,
          roomTypeName: usable.roomTypeName,
          arrivalDate,
          departureDate,
          rooms: usable.rooms.slice(0, 2),
        };
      }
    }

    throw new Error(
      'Could not find two ready rooms of the same room type in the next 21 days. ' +
        'Make at least two rooms Ready and rerun the test.',
    );
  }, { baseUrl: apiBaseUrl, propertyId: fixture.id });

  expect(candidate.rooms).toHaveLength(2);
  expect(candidate.rooms[0].roomId).not.toBe(candidate.rooms[1].roomId);

  return candidate;
}

async function createUniqueBooking(page: Page, candidate: RoomCandidate) {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const firstName = 'E2E';
  const lastName = `Lifecycle${unique.slice(-6)}`;
  const guestName = `${firstName} ${lastName}`;

  const phone = `9${unique.slice(-9)}`.slice(0, 10);

  const email = `e2e.lifecycle.${unique}@example.com`;

  const params = new URLSearchParams({
    arrivalDate: candidate.arrivalDate,
    departureDate: candidate.departureDate,
    roomTypeId: candidate.roomTypeId,
    adults: '1',
    children: '0',
  });

  await page.goto(`/reservations/new?${params.toString()}`);

  await expect(
    page.getByRole('heading', {
      name: 'New Booking',
      exact: true,
    }),
  ).toBeVisible({
    timeout: 20000,
  });

  // Wait until active property + room types are ready.
  // This prevents "Property is still loading" during inline guest creation.
  const roomTypeOption = page.getByTestId(`room-type-option-${candidate.roomTypeId}`);

  await expect(roomTypeOption).toBeVisible({
    timeout: 20000,
  });

  await page.getByTestId('booking-guest-add-toggle').click();

  await page.getByTestId('booking-new-guest-first-name').fill(firstName);

  await page.getByTestId('booking-new-guest-last-name').fill(lastName);

  await page.getByTestId('booking-new-guest-email').fill(email);

  await page.getByTestId('booking-new-guest-phone').fill(phone);

  const guestResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/properties\/[^/]+\/guests(?:\?|$)/.test(response.url()),
    {
      timeout: 20000,
    },
  );

  await page.getByTestId('booking-new-guest-submit').click();

  const guestResponse = await guestResponsePromise;

  if (!guestResponse.ok()) {
    const body = await guestResponse.text();

    throw new Error(
      `Guest creation failed: ${guestResponse.status()} ${guestResponse.statusText()}\n${body}`,
    );
  }

  await expect(page.getByTestId('booking-new-guest-submit')).toBeHidden({
    timeout: 10000,
  });

  const createButton = page.getByRole('button', {
    name: 'Create Booking →',
  });

  if (await createButton.isDisabled()) {
    await roomTypeOption.click();
  }

  await expect(createButton).toBeEnabled({
    timeout: 15000,
  });

  const createBookingResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/properties\/[^/]+\/reservations(?:\?|$)/.test(response.url()),
    {
      timeout: 20000,
    },
  );

  await createButton.click();

  const createBookingResponse = await createBookingResponsePromise;

  if (!createBookingResponse.ok()) {
    const body = await createBookingResponse.text();

    throw new Error(
      `Booking creation failed: ${createBookingResponse.status()} ${createBookingResponse.statusText()}\n${body}`,
    );
  }

  await expect(page).toHaveURL(/\/reservations\/[^/?#]+$/, {
    timeout: 20000,
  });

  // Wait for Booking Detail page to finish loading.
  await expect(
    page
      .getByRole('button', {
        name: 'Assign Room',
        exact: true,
      })
      .first(),
  ).toBeVisible({
    timeout: 20000,
  });

  const reservationId = page.url().split('/reservations/')[1]?.split(/[?#]/)[0] ?? '';

  expect(reservationId).toBeTruthy();

  return {
    guestName,
    reservationId,
  };
}

async function chooseRoomFromMantineSelect(
  page: Page,
  label: 'Room' | 'New room',
  roomNumber: string,
) {
  // Scope the combobox to the currently-open modal.
  // The Booking Detail page can contain another element labelled "Room"
  // behind the modal, which causes Playwright strict-mode violations.
  const dialog = page.getByRole('dialog').last();

  await expect(dialog).toBeVisible({
    timeout: 10000,
  });

  const select = dialog.getByRole('combobox', {
    name: label,
    exact: true,
  });

  await expect(select).toBeVisible({
    timeout: 10000,
  });

  await select.click();

  // Mantine renders Select dropdown options in a portal outside the dialog,
  // therefore the option itself must be located from the page.
  const option = page.getByRole('option', {
    name: new RegExp(`^Room ${roomNumber}\\b`),
  });

  await expect(option).toBeVisible({
    timeout: 10000,
  });

  await option.click();
}

async function expectRoomAvailableAgain(page: Page, candidate: RoomCandidate, roomId: string) {
  const availableRoomIds = await page.evaluate(
    async ({ baseUrl, propertyId, arrivalDate, departureDate, roomTypeId }) => {
      type ApiEnvelope<T> = T | { data?: T } | { items?: T } | { results?: T };

      type LooseRecord = Record<string, unknown>;

      const unwrap = <T>(payload: ApiEnvelope<T>): T => {
        if (payload && typeof payload === 'object') {
          if ('data' in payload && payload.data !== undefined) return payload.data;
          if ('items' in payload && payload.items !== undefined) return payload.items;
          if ('results' in payload && payload.results !== undefined) return payload.results;
        }
        return payload as T;
      };

      const token =
        window.localStorage.getItem('stayos.accessToken') ??
        window.sessionStorage.getItem('stayos.accessToken');

      if (!token) {
        throw new Error('No auth token available while verifying released inventory.');
      }

      const url = new URL(`${baseUrl}/properties/${propertyId}/operations/available-rooms`);

      url.searchParams.set('arrivalDate', arrivalDate);
      url.searchParams.set('departureDate', departureDate);
      url.searchParams.set('roomTypeId', roomTypeId);
      url.searchParams.set('guestCount', '1');
      url.searchParams.set('adults', '1');
      url.searchParams.set('children', '0');

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Unable to verify released inventory: ${response.status}`);
      }

      const rooms = unwrap<LooseRecord[]>(await response.json());

      return rooms.map((room) => String(room.roomId ?? room.id ?? '')).filter(Boolean);
    },
    {
      baseUrl: apiBaseUrl,
      propertyId: candidate.propertyId,
      arrivalDate: candidate.arrivalDate,
      departureDate: candidate.departureDate,
      roomTypeId: candidate.roomTypeId,
    },
  );

  expect(availableRoomIds).toContain(roomId);
}

test.describe('reservation lifecycle - pre Channel Manager readiness', () => {
  test.setTimeout(90000);

  test.beforeEach(() => {
    resetE2EPropertyState();
  });

  test('create booking, assign room, then change to another room of the same type', async ({
    page,
  }) => {
    await loginAs(page, frontDeskEmail);

    const candidate = await discoverTwoAvailableRooms(page);

    const [roomA, roomB] = candidate.rooms;

    const { guestName, reservationId } = await createUniqueBooking(page, candidate);

    await test.step('booking is confirmed and initially unassigned', async () => {
      await expect(page.getByText(/CONFIRMED/i).first()).toBeVisible();

      await expect(
        page.getByText('Room unassigned', {
          exact: true,
        }),
      ).toBeVisible();

      await expect(
        page
          .getByRole('button', {
            name: 'Assign Room',
            exact: true,
          })
          .first(),
      ).toBeVisible();
    });

    await test.step(`assign Room ${roomA.roomNumber}`, async () => {
      await page
        .getByRole('button', {
          name: 'Assign Room',
          exact: true,
        })
        .first()
        .click();

      const dialog = page.getByRole('dialog');

      await expect(dialog).toBeVisible({
        timeout: 10000,
      });

      await chooseRoomFromMantineSelect(page, 'Room', roomA.roomNumber);

      const assignResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/reservations/${reservationId}/assign-room`) &&
          response.request().method() === 'PATCH',
        {
          timeout: 20000,
        },
      );

      await dialog
        .getByRole('button', {
          name: 'Assign Room',
          exact: true,
        })
        .click();

      const assignResponse = await assignResponsePromise;

      if (!assignResponse.ok()) {
        const body = await assignResponse.text();

        throw new Error(
          `Assign room failed: ${assignResponse.status()} ${assignResponse.statusText()}\n${body}`,
        );
      }

      await expect(
        page
          .getByText(`Room ${roomA.roomNumber} · ${candidate.roomTypeName}`, {
            exact: true,
          })
          .first(),
      ).toBeVisible({
        timeout: 15000,
      });

      await expect(page.getByTestId('change-room-open')).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step(`change Room ${roomA.roomNumber} → Room ${roomB.roomNumber}`, async () => {
      await page.getByTestId('change-room-open').click();

      const dialog = page.getByRole('dialog');

      await expect(
        dialog.getByRole('heading', {
          name: 'Change Room',
          exact: true,
        }),
      ).toBeVisible({
        timeout: 10000,
      });

      await expect(
        dialog.getByText(`Room ${roomA.roomNumber} · ${candidate.roomTypeName}`, {
          exact: true,
        }),
      ).toBeVisible({
        timeout: 10000,
      });

      await chooseRoomFromMantineSelect(page, 'New room', roomB.roomNumber);

      const changeResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/reservations/${reservationId}/assign-room`) &&
          response.request().method() === 'PATCH',
        {
          timeout: 20000,
        },
      );

      await dialog
        .getByRole('button', {
          name: 'Change Room',
          exact: true,
        })
        .click();

      const changeResponse = await changeResponsePromise;

      if (!changeResponse.ok()) {
        const body = await changeResponse.text();

        throw new Error(
          `Change room failed: ${changeResponse.status()} ${changeResponse.statusText()}\n${body}`,
        );
      }

      await expect(
        page
          .getByText(`Room ${roomB.roomNumber} · ${candidate.roomTypeName}`, {
            exact: true,
          })
          .first(),
      ).toBeVisible({
        timeout: 15000,
      });

      await expect(page.getByTestId('change-room-open')).toBeVisible();
    });

    await test.step('booking remains usable after room change', async () => {
      await expect(
        page
          .getByText(guestName, {
            exact: true,
          })
          .first(),
      ).toBeVisible({
        timeout: 10000,
      });

      // Booking Detail renders more than one Start Check-In link.
      // Use the dedicated stable test id for the primary next-action CTA.
      const nextAction = page.getByTestId('booking-next-action-cta');

      await expect(nextAction).toBeVisible({
        timeout: 10000,
      });

      await expect(nextAction).toHaveAttribute(
        'href',
        new RegExp(`/reservations/${reservationId}/check-in$`),
      );

      await expect(
        page.getByRole('link', {
          name: 'Edit Booking',
          exact: true,
        }),
      ).toBeVisible();
    });
  });

  test('assigned room is released when a confirmed booking is cancelled', async ({ page }) => {
    await loginAs(page, frontDeskEmail);

    const candidate = await discoverTwoAvailableRooms(page);
    const [roomA] = candidate.rooms;

    const { reservationId } = await createUniqueBooking(page, candidate);

    await test.step(`assign Room ${roomA.roomNumber}`, async () => {
      await page
        .getByRole('button', {
          name: 'Assign Room',
          exact: true,
        })
        .first()
        .click();

      const dialog = page.getByRole('dialog').last();

      await expect(dialog).toBeVisible({
        timeout: 10000,
      });

      await chooseRoomFromMantineSelect(page, 'Room', roomA.roomNumber);

      const assignResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/reservations/${reservationId}/assign-room`) &&
          response.request().method() === 'PATCH',
        {
          timeout: 20000,
        },
      );

      await dialog
        .getByRole('button', {
          name: 'Assign Room',
          exact: true,
        })
        .click();

      const assignResponse = await assignResponsePromise;

      if (!assignResponse.ok()) {
        const body = await assignResponse.text();
        throw new Error(
          `Assign room failed: ${assignResponse.status()} ${assignResponse.statusText()}\n${body}`,
        );
      }

      await expect(
        page
          .getByText(`Room ${roomA.roomNumber} · ${candidate.roomTypeName}`, {
            exact: true,
          })
          .first(),
      ).toBeVisible({
        timeout: 15000,
      });

      await expect(page.getByTestId('change-room-open')).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step('cancel the confirmed booking', async () => {
      await page
        .getByRole('button', {
          name: 'Cancel Booking',
          exact: true,
        })
        .click();

      const dialog = page.getByRole('dialog').last();

      await expect(
        dialog.getByText('Cancel booking?', {
          exact: true,
        }),
      ).toBeVisible({
        timeout: 10000,
      });

      await expect(dialog.getByText(/release any assigned room/i)).toBeVisible();

      const cancelResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/reservations/${reservationId}`) &&
          !response.url().includes('/assign-room') &&
          response.request().method() === 'PATCH',
        {
          timeout: 20000,
        },
      );

      await dialog
        .getByRole('button', {
          name: 'Cancel Booking',
          exact: true,
        })
        .click();

      const cancelResponse = await cancelResponsePromise;

      if (!cancelResponse.ok()) {
        const body = await cancelResponse.text();
        throw new Error(
          `Cancel booking failed: ${cancelResponse.status()} ${cancelResponse.statusText()}\n${body}`,
        );
      }
    });

    await test.step('cancelled booking becomes read-only', async () => {
      await expect(
        page.getByText('Cancelled booking', {
          exact: true,
        }),
      ).toBeVisible({
        timeout: 15000,
      });

      await expect(
        page.getByText(
          'This booking is cancelled. Room assignment, check-in, editing and stay actions are no longer available.',
          {
            exact: true,
          },
        ),
      ).toBeVisible();

      await expect(page.getByTestId('change-room-open')).toHaveCount(0);

      await expect(page.getByTestId('booking-next-action-cta')).toHaveCount(0);

      await expect(
        page.getByRole('link', {
          name: 'Edit Booking',
          exact: true,
        }),
      ).toHaveCount(0);

      await expect(
        page.getByRole('button', {
          name: 'Assign Room',
          exact: true,
        }),
      ).toHaveCount(0);
    });

    await test.step(`Room ${roomA.roomNumber} is released back to inventory`, async () => {
      await expectRoomAvailableAgain(page, candidate, roomA.roomId);
    });
  });
});
