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

function iso(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function todayCode() {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

async function main() {
  const properties = await request('/properties');
  const property = properties.find((item) => item.code === 'HILLSTON_IND') ?? properties[0];

  if (!property?.id) throw new Error('No property found.');

  const propertyId = property.id;

  const [existingGuests, roomTypes, existingReservations] = await Promise.all([
    request(`/properties/${propertyId}/guests`),
    request(`/properties/${propertyId}/room-types`),
    request(`/properties/${propertyId}/reservations`),
  ]);

  const deluxe = roomTypes.find((item) => String(item.name).toLowerCase().includes('deluxe'));
  const suite = roomTypes.find((item) => String(item.name).toLowerCase().includes('suite'));

  if (!deluxe?.id) throw new Error('No Deluxe room type found.');
  if (!suite?.id) throw new Error('No Suite room type found.');

  async function ensureGuest(input) {
    const existing = existingGuests.find((guest) => guest.phone === input.phone);
    if (existing) return existing;

    const created = await request(`/properties/${propertyId}/guests`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    console.log(`Created guest ${input.firstName} ${input.lastName}`);
    existingGuests.push(created);
    return created;
  }

  async function ensureReservation(input) {
    const existing = existingReservations.find(
      (reservation) => reservation.reservationCode === input.reservationCode,
    );

    if (existing) {
      console.log(`Skipped existing booking ${input.reservationCode}`);
      return existing;
    }

    const created = await request(`/properties/${propertyId}/reservations`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    console.log(`Created booking ${input.reservationCode}`);
    existingReservations.push(created);
    return created;
  }

  const guests = [
    ['Rahul', 'Sharma', '+919999200001', 'rahul.sharma@example.com', false, 'Indian'],
    ['Rhea', 'Malhotra', '+919999200002', 'rhea.malhotra@example.com', false, 'Indian'],
    ['Arjun', 'Patel', '+919999200003', 'arjun.patel@example.com', false, 'Indian'],
    ['Priya', 'Nair', '+919999200004', 'priya.nair@example.com', false, 'Indian'],
    ['Neha', 'Gupta', '+919999200005', 'neha.gupta@example.com', true, 'Indian'],
    ['Vikram', 'Singh', '+919999200006', 'vikram.singh@example.com', false, 'Indian'],
    ['Amit', 'Verma', '+919999200007', 'amit.verma@example.com', false, 'Indian'],
    ['Karan', 'Mehta', '+919999200008', 'karan.mehta@example.com', false, 'Indian'],
    ['Sneha', 'Kapoor', '+919999200009', 'sneha.kapoor@example.com', false, 'Indian'],
    ['Aditya', 'Joshi', '+919999200010', 'aditya.joshi@example.com', false, 'Indian'],
    ['Emily', 'Johnson', '+919999200011', 'emily.johnson@example.com', false, 'Foreign'],
    ['Sarah', 'Wilson', '+919999200012', 'sarah.wilson@example.com', false, 'Foreign'],
    ['David', 'Miller', '+919999200013', 'david.miller@example.com', false, 'Foreign'],
    ['Michael', 'Brown', '+919999200014', 'michael.brown@example.com', false, 'Foreign'],
    ['Lisa', 'Anderson', '+919999200015', 'lisa.anderson@example.com', false, 'Foreign'],
    ['Aarav', 'Kapoor', '+919999200016', 'aarav.kapoor@example.com', false, 'Indian'],
    ['Pooja', 'Sharma', '+919999200017', 'pooja.sharma@example.com', false, 'Indian'],
    ['Manish', 'Jain', '+919999200018', 'manish.jain@example.com', false, 'Indian'],
    ['Nidhi', 'Agarwal', '+919999200019', 'nidhi.agarwal@example.com', false, 'Indian'],
    ['Daniel', 'Lee', '+919999200020', 'daniel.lee@example.com', false, 'Foreign'],
  ];

  const createdGuests = [];

  for (const [firstName, lastName, phone, email, vipStatus, nationality] of guests) {
    const guest = await ensureGuest({
      firstName,
      lastName,
      phone,
      email,
      nationality,
      preferredLanguage: 'English',
      vipStatus,
      blacklistStatus: false,
      status: 'ACTIVE',
    });

    createdGuests.push(guest);
  }

  const dateCode = todayCode();

  const bookings = [
    [1, 0, deluxe.id, 'DIRECT', 'CONFIRMED', 'PAID', 0, 1, 'Quiet room'],
    [2, 0, deluxe.id, 'CORPORATE', 'CONFIRMED', 'PAYMENT_DUE', 0, 2, 'Early check-in'],
    [1, 0, deluxe.id, 'WALK_IN', 'CONFIRMED', 'PAID', 0, 1, 'Near elevator'],
    [2, 0, deluxe.id, 'OTA', 'PENDING', 'PAYMENT_DUE', 1, 3, 'Late arrival'],
    [2, 1, suite.id, 'DIRECT', 'CONFIRMED', 'PAID', 0, 3, 'Baby crib'],
    [2, 2, suite.id, 'OTA', 'CONFIRMED', 'PAYMENT_DUE', 1, 4, 'High floor'],
    [2, 0, suite.id, 'DIRECT', 'CONFIRMED', 'PAID', 0, 2, 'VIP amenities'],
    [1, 1, deluxe.id, 'DIRECT', 'PENDING', 'PAYMENT_DUE', 2, 4, 'Extra pillow'],
    [2, 0, deluxe.id, 'CORPORATE', 'CONFIRMED', 'PAID', 2, 5, 'Twin beds'],
    [1, 0, deluxe.id, 'OTA', 'CONFIRMED', 'PAYMENT_DUE', 3, 5, 'Airport pickup'],
    [2, 1, suite.id, 'DIRECT', 'CONFIRMED', 'PAID', 3, 6, 'Vegetarian breakfast'],
    [2, 0, deluxe.id, 'WALK_IN', 'PENDING', 'PAYMENT_DUE', 0, 1, 'No special requests'],
    [1, 0, suite.id, 'DIRECT', 'CONFIRMED', 'PAID', 4, 7, 'Long stay guest'],
    [2, 0, deluxe.id, 'CORPORATE', 'CONFIRMED', 'PAID', 5, 7, 'Late checkout'],
    [2, 2, suite.id, 'OTA', 'PENDING', 'PAYMENT_DUE', 1, 4, 'Family booking'],
    [1, 0, deluxe.id, 'DIRECT', 'CONFIRMED', 'PAID', 0, 2, 'Returning guest'],
    [2, 1, suite.id, 'DIRECT', 'CONFIRMED', 'PAYMENT_DUE', 2, 5, 'Connecting preference'],
    [1, 1, deluxe.id, 'OTA', 'PENDING', 'PAYMENT_DUE', 3, 5, 'Quiet floor'],
    [2, 0, suite.id, 'CORPORATE', 'CONFIRMED', 'PAID', 0, 3, 'Business traveller'],
    [1, 0, deluxe.id, 'DIRECT', 'CONFIRMED', 'PAYMENT_DUE', 1, 2, 'Late arrival'],
  ];

  for (let index = 0; index < bookings.length; index += 1) {
    const [
      adults,
      children,
      roomTypeId,
      source,
      status,
      paymentStatus,
      arrivalOffset,
      departureOffset,
      specialRequests,
    ] = bookings[index];

    const guest = createdGuests[index];
    const sequence = String(index + 1).padStart(3, '0');

    await ensureReservation({
      guestId: guest.id,
      reservationCode: `HS${dateCode}${sequence}`,
      arrivalDate: iso(arrivalOffset),
      departureDate: iso(departureOffset),
      adults,
      children,
      roomTypeId,
      source,
      status,
      paymentStatus,
      notes: `${source} booking for ${guest.firstName} ${guest.lastName}.`,
      specialRequests,
    });
  }

  console.log('New realistic bookings bootstrap complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
