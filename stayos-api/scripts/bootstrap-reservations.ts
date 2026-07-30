import { EntityManager, Repository } from 'typeorm';
import { GuestEntity } from '../src/core/guests/infrastructure/guest.entity';
import { PropertyEntity } from '../src/core/properties/infrastructure/property.entity';
import { ReservationPaymentStatus } from '../src/core/reservations/domain/reservation-payment-status.enum';
import { ReservationSource } from '../src/core/reservations/domain/reservation-source.enum';
import { ReservationStatus } from '../src/core/reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../src/core/reservations/infrastructure/reservation.entity';
import { RoomTypeEntity } from '../src/core/room-types/infrastructure/room-type.entity';
import { RoomEntity } from '../src/core/rooms/infrastructure/room.entity';
import dataSource from '../src/database/data-source';
import { HILLSTON_PROPERTY_CODE } from './bootstrap-hillston';

type MutationAction = 'created' | 'updated';

interface MutationSummary {
  created: number;
  updated: number;
}

interface ReservationBootstrapSummary {
  reservations: MutationSummary;
}

interface ReservationVerificationSummary {
  totalReservations: number;
  confirmed: number;
  pending: number;
  checkedIn: number;
  paymentDue: number;
  assignedRooms: number;
  unassignedRooms: number;
}

interface HillstonReservationSeed {
  reservationCode: string;
  guestPhone: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  roomTypeCode: string;
  roomNumber?: string;
  source: ReservationSource;
  status: ReservationStatus;
  paymentStatus: ReservationPaymentStatus;
  notes: string;
  specialRequests: string;
}

interface ReservationSimulationState {
  reservations: Array<{
    propertyCode: string;
    reservationCode: string;
    status: ReservationStatus;
    paymentStatus: ReservationPaymentStatus;
    roomNumber?: string;
  }>;
}

const padDateValue = (value: number): string => String(value).padStart(2, '0');

const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${padDateValue(date.getMonth() + 1)}-${padDateValue(date.getDate())}`;

const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const today = new Date();
const todayDate = formatLocalDate(today);
const tomorrowDate = formatLocalDate(addDays(today, 1));
const todayPlusThreeDate = formatLocalDate(addDays(today, 3));
const tomorrowPlusThreeDate = formatLocalDate(addDays(today, 4));

export const hillstonReservationBootstrapData: HillstonReservationSeed[] = [
  {
    reservationCode: 'ST1842',
    guestPhone: '9876522110',
    arrivalDate: todayDate,
    departureDate: todayPlusThreeDate,
    adults: 2,
    children: 1,
    roomTypeCode: 'STE',
    roomNumber: '212',
    source: ReservationSource.DIRECT,
    status: ReservationStatus.CONFIRMED,
    paymentStatus: ReservationPaymentStatus.PARTIALLY_PAID,
    notes: 'Prefers quiet floor and early tea service.',
    specialRequests: 'Quiet floor, Early check-in, Airport pickup',
  },
  {
    reservationCode: 'ST1849',
    guestPhone: '9988743000',
    arrivalDate: todayDate,
    departureDate: tomorrowDate,
    adults: 5,
    children: 0,
    roomTypeCode: 'DLX',
    source: ReservationSource.CORPORATE,
    status: ReservationStatus.PENDING,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    notes: 'Group checkout expected around 10:00 AM.',
    specialRequests: 'GST invoice, Luggage assistance',
  },
  {
    reservationCode: 'ST1851',
    guestPhone: '9000088221',
    arrivalDate: todayDate,
    departureDate: todayPlusThreeDate,
    adults: 2,
    children: 0,
    roomTypeCode: 'STE',
    roomNumber: '303',
    source: ReservationSource.WEBSITE,
    status: ReservationStatus.CONFIRMED,
    paymentStatus: ReservationPaymentStatus.PAID,
    notes: 'VIP guest. Airport pickup required.',
    specialRequests: 'Airport pickup, Fruit platter, Late checkout',
  },
  {
    reservationCode: 'ST1856',
    guestPhone: '9822044551',
    arrivalDate: tomorrowDate,
    departureDate: tomorrowPlusThreeDate,
    adults: 2,
    children: 0,
    roomTypeCode: 'DLX',
    source: ReservationSource.OTA,
    status: ReservationStatus.CONFIRMED,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    notes: 'Arrives tomorrow evening.',
    specialRequests: 'High floor',
  },
  {
    reservationCode: 'ST1838',
    guestPhone: '9811130444',
    arrivalDate: todayDate,
    departureDate: tomorrowDate,
    adults: 1,
    children: 0,
    roomTypeCode: 'DLX',
    roomNumber: '201',
    source: ReservationSource.WALK_IN,
    status: ReservationStatus.CHECKED_IN,
    paymentStatus: ReservationPaymentStatus.PAID,
    notes: 'Checked in at 08:40 AM.',
    specialRequests: 'Extra towel',
  },
];

export const expectedHillstonReservations: ReservationVerificationSummary = {
  totalReservations: 5,
  confirmed: 3,
  pending: 1,
  checkedIn: 1,
  paymentDue: 2,
  assignedRooms: 3,
  unassignedRooms: 2,
};

export const createHillstonReservationSimulationState = (): ReservationSimulationState => ({
  reservations: [],
});

export const simulateHillstonReservationBootstrap = (
  state: ReservationSimulationState,
): ReservationVerificationSummary => {
  hillstonReservationBootstrapData.forEach((reservation) => {
    const existing = state.reservations.find(
      (candidate) =>
        candidate.propertyCode === HILLSTON_PROPERTY_CODE &&
        candidate.reservationCode === reservation.reservationCode,
    );

    if (existing) {
      existing.status = reservation.status;
      existing.paymentStatus = reservation.paymentStatus;
      existing.roomNumber = reservation.roomNumber;
      return;
    }

    state.reservations.push({
      propertyCode: HILLSTON_PROPERTY_CODE,
      reservationCode: reservation.reservationCode,
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
      roomNumber: reservation.roomNumber,
    });
  });

  return summarizeReservations(state.reservations);
};

export const runHillstonReservationBootstrap = async (): Promise<{
  summary: ReservationBootstrapSummary;
  verification: ReservationVerificationSummary;
}> => {
  await dataSource.initialize();

  try {
    return await dataSource.transaction(async (manager) => bootstrapHillstonReservations(manager));
  } finally {
    await dataSource.destroy();
  }
};

export const bootstrapHillstonReservations = async (
  manager: EntityManager,
): Promise<{
  summary: ReservationBootstrapSummary;
  verification: ReservationVerificationSummary;
}> => {
  const propertyRepository = manager.getRepository(PropertyEntity);
  const guestRepository = manager.getRepository(GuestEntity);
  const roomTypeRepository = manager.getRepository(RoomTypeEntity);
  const roomRepository = manager.getRepository(RoomEntity);
  const reservationRepository = manager.getRepository(ReservationEntity);
  const property = await propertyRepository.findOne({
    where: { code: HILLSTON_PROPERTY_CODE },
  });

  if (!property) {
    throw new Error(
      `Property ${HILLSTON_PROPERTY_CODE} was not found. Run bootstrap:hillston first.`,
    );
  }

  const guests = await guestRepository.find({ where: { propertyId: property.id } });
  const roomTypes = await roomTypeRepository.find({ where: { propertyId: property.id } });
  const rooms = await roomRepository.find({ where: { propertyId: property.id } });
  const guestByPhone = new Map(guests.map((guest) => [guest.phone, guest]));
  const roomTypeByCode = new Map(roomTypes.map((roomType) => [roomType.code, roomType]));
  const roomByNumber = new Map(rooms.map((room) => [room.roomNumber, room]));
  const summary: ReservationBootstrapSummary = {
    reservations: { created: 0, updated: 0 },
  };

  for (const reservationSeed of hillstonReservationBootstrapData) {
    const guest = guestByPhone.get(reservationSeed.guestPhone);
    const roomType = roomTypeByCode.get(reservationSeed.roomTypeCode);
    const room = reservationSeed.roomNumber
      ? roomByNumber.get(reservationSeed.roomNumber)
      : undefined;

    if (!guest) {
      throw new Error(
        `Guest with phone ${reservationSeed.guestPhone} was not found. Run bootstrap:guests first.`,
      );
    }

    if (!roomType) {
      throw new Error(`Room type ${reservationSeed.roomTypeCode} was not found.`);
    }

    if (reservationSeed.roomNumber && !room) {
      throw new Error(`Room ${reservationSeed.roomNumber} was not found.`);
    }

    if (room && room.roomTypeId !== roomType.id) {
      throw new Error(
        `Room ${room.roomNumber} does not belong to room type ${reservationSeed.roomTypeCode}.`,
      );
    }

    const result = await upsertReservation(
      reservationRepository,
      property.id,
      guest,
      roomType,
      room,
      reservationSeed,
    );
    summary.reservations[result.action] += 1;
  }

  const verification = await verifyHillstonReservations(property.id, reservationRepository);

  return { summary, verification };
};

const upsertReservation = async (
  repository: Repository<ReservationEntity>,
  propertyId: string,
  guest: GuestEntity,
  roomType: RoomTypeEntity,
  room: RoomEntity | undefined,
  seed: HillstonReservationSeed,
): Promise<{ action: MutationAction; entity: ReservationEntity }> => {
  const existing = await repository.findOne({
    where: { propertyId, reservationCode: seed.reservationCode },
  });
  const entity = repository.create({
    ...(existing ?? {}),
    propertyId,
    guestId: guest.id,
    reservationCode: seed.reservationCode,
    arrivalDate: seed.arrivalDate,
    departureDate: seed.departureDate,
    adults: seed.adults,
    children: seed.children,
    roomTypeId: roomType.id,
    roomId: room?.id ?? null,
    source: seed.source,
    status: seed.status,
    paymentStatus: seed.paymentStatus,
    notes: seed.notes,
    specialRequests: seed.specialRequests,
  });

  return {
    action: existing ? 'updated' : 'created',
    entity: await repository.save(entity),
  };
};

const verifyHillstonReservations = async (
  propertyId: string,
  repository: Repository<ReservationEntity>,
): Promise<ReservationVerificationSummary> => {
  const reservations = await repository.find({
    where: { propertyId },
  });
  const verification = summarizeReservations(
    reservations.map((reservation) => ({
      propertyCode: HILLSTON_PROPERTY_CODE,
      reservationCode: reservation.reservationCode,
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
      roomNumber: reservation.roomId ?? undefined,
    })),
  );

  assertHillstonReservationCounts(verification);

  return verification;
};

const summarizeReservations = (
  reservations: ReservationSimulationState['reservations'],
): ReservationVerificationSummary => ({
  totalReservations: reservations.filter(
    (reservation) => reservation.propertyCode === HILLSTON_PROPERTY_CODE,
  ).length,
  confirmed: reservations.filter(
    (reservation) =>
      reservation.propertyCode === HILLSTON_PROPERTY_CODE &&
      reservation.status === ReservationStatus.CONFIRMED,
  ).length,
  pending: reservations.filter(
    (reservation) =>
      reservation.propertyCode === HILLSTON_PROPERTY_CODE &&
      reservation.status === ReservationStatus.PENDING,
  ).length,
  checkedIn: reservations.filter(
    (reservation) =>
      reservation.propertyCode === HILLSTON_PROPERTY_CODE &&
      reservation.status === ReservationStatus.CHECKED_IN,
  ).length,
  paymentDue: reservations.filter(
    (reservation) =>
      reservation.propertyCode === HILLSTON_PROPERTY_CODE &&
      reservation.paymentStatus === ReservationPaymentStatus.PAYMENT_DUE,
  ).length,
  assignedRooms: reservations.filter(
    (reservation) => reservation.propertyCode === HILLSTON_PROPERTY_CODE && reservation.roomNumber,
  ).length,
  unassignedRooms: reservations.filter(
    (reservation) => reservation.propertyCode === HILLSTON_PROPERTY_CODE && !reservation.roomNumber,
  ).length,
});

export const assertHillstonReservationCounts = (
  verification: ReservationVerificationSummary,
): void => {
  Object.entries(expectedHillstonReservations).forEach(([key, expectedValue]) => {
    const actualValue = verification[key as keyof ReservationVerificationSummary];

    if (actualValue !== expectedValue) {
      throw new Error(`Expected ${key} to be ${expectedValue}, received ${actualValue}`);
    }
  });
};

const printSummary = ({
  summary,
  verification,
}: {
  summary: ReservationBootstrapSummary;
  verification: ReservationVerificationSummary;
}): void => {
  console.log('Hillston reservation bootstrap completed');
  console.log(
    `Reservations Created/Updated: ${summary.reservations.created}/${summary.reservations.updated}`,
  );
  console.log('Reservation Verification Summary');
  console.log(`Total Reservations: ${verification.totalReservations}`);
  console.log(`Confirmed: ${verification.confirmed}`);
  console.log(`Pending: ${verification.pending}`);
  console.log(`Checked In: ${verification.checkedIn}`);
  console.log(`Payment Due: ${verification.paymentDue}`);
  console.log(`Assigned Rooms: ${verification.assignedRooms}`);
  console.log(`Unassigned Rooms: ${verification.unassignedRooms}`);
};

if (require.main === module) {
  runHillstonReservationBootstrap()
    .then(printSummary)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
