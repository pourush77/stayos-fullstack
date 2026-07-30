const API = process.env.API_URL ?? 'http://localhost:3002/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const json = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(json)}`);
  }

  return json?.data ?? json;
}

async function main() {
  const properties = await request('/properties');
  const property = properties.find((p) => p.code === 'HILLSTON_IND') ?? properties[0];

  if (!property?.id) throw new Error('No property found.');

  const propertyId = property.id;

  const guests = await request(`/properties/${propertyId}/guests`);
  const roomTypes = await request(`/properties/${propertyId}/room-types`);
  const reservations = await request(`/properties/${propertyId}/reservations`);

  const deluxe = roomTypes.find((r) => String(r.name).toLowerCase().includes('deluxe'));
  const suite = roomTypes.find((r) => String(r.name).toLowerCase().includes('suite'));

  if (!deluxe?.id) throw new Error('No Deluxe room type found.');
  if (!suite?.id) throw new Error('No Suite room type found.');

  async function ensureGuest(input) {
    const existing = guests.find((g) => g.phone === input.phone);
    if (existing) return existing;

    return request(`/properties/${propertyId}/guests`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async function ensureReservation(input) {
    const existing = reservations.find((r) => r.reservationCode === input.reservationCode);
    if (existing) {
      console.log(`Skipped existing reservation ${input.reservationCode}`);
      return existing;
    }

    const created = await request(`/properties/${propertyId}/reservations`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    console.log(`Created reservation ${input.reservationCode}`);
    return created;
  }

  const guestA = await ensureGuest({
    firstName: 'Test',
    lastName: 'Guest',
    phone: '+919999000111',
    email: 'test.guest@example.com',
    nationality: 'Indian',
    preferredLanguage: 'English',
    vipStatus: false,
    blacklistStatus: false,
    status: 'ACTIVE',
  });

  const guestB = await ensureGuest({
    firstName: 'Rhea',
    lastName: 'Demo',
    phone: '+919999000222',
    email: 'rhea.demo@example.com',
    nationality: 'Indian',
    preferredLanguage: 'English',
    vipStatus: false,
    blacklistStatus: false,
    status: 'ACTIVE',
  });

  const guestC = await ensureGuest({
    firstName: 'Aarav',
    lastName: 'Kapoor',
    phone: '+919999000333',
    email: 'aarav.kapoor@example.com',
    nationality: 'Indian',
    preferredLanguage: 'English',
    vipStatus: true,
    blacklistStatus: false,
    status: 'ACTIVE',
  });

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);

  const iso = (date) => date.toISOString().slice(0, 10);

  await ensureReservation({
    guestId: guestA.id,
    reservationCode: 'ST-DEMO-001',
    arrivalDate: iso(today),
    departureDate: iso(tomorrow),
    adults: 2,
    children: 0,
    roomTypeId: deluxe.id,
    source: 'DIRECT',
    status: 'CONFIRMED',
    paymentStatus: 'PAYMENT_DUE',
    notes: 'Demo unassigned Deluxe booking.',
    specialRequests: 'None',
  });

  await ensureReservation({
    guestId: guestB.id,
    reservationCode: 'ST-DEMO-002',
    arrivalDate: iso(today),
    departureDate: iso(dayAfter),
    adults: 1,
    children: 0,
    roomTypeId: deluxe.id,
    source: 'WALK_IN',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    notes: 'Demo compatible room assignment booking.',
    specialRequests: 'Quiet room',
  });

  await ensureReservation({
    guestId: guestC.id,
    reservationCode: 'ST-DEMO-003',
    arrivalDate: iso(today),
    departureDate: iso(dayAfter),
    adults: 2,
    children: 1,
    roomTypeId: suite.id,
    source: 'DIRECT',
    status: 'CONFIRMED',
    paymentStatus: 'PARTIALLY_PAID',
    notes: 'Demo VIP Suite booking.',
    specialRequests: 'High floor',
  });

  await ensureReservation({
    guestId: guestA.id,
    reservationCode: 'ST-DEMO-004',
    arrivalDate: iso(tomorrow),
    departureDate: iso(dayAfter),
    adults: 2,
    children: 1,
    roomTypeId: deluxe.id,
    source: 'OTA',
    status: 'PENDING',
    paymentStatus: 'PAYMENT_DUE',
    notes: 'Demo capacity validation booking.',
    specialRequests: 'None',
  });

  console.log('Demo reservations bootstrap complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
