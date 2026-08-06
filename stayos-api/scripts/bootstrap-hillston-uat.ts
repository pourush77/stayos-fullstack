import dataSource from '../src/database/data-source';
import { HILLSTON_PROPERTY_CODE, bootstrapHillston } from './bootstrap-hillston';
import { PropertyEntity } from '../src/core/properties/infrastructure/property.entity';
import { GuestEntity } from '../src/core/guests/infrastructure/guest.entity';
import { GuestStatus } from '../src/core/guests/domain/guest-status.enum';
import { ReservationEntity } from '../src/core/reservations/infrastructure/reservation.entity';
import { ReservationStatus } from '../src/core/reservations/domain/reservation-status.enum';
import { ReservationSource } from '../src/core/reservations/domain/reservation-source.enum';
import { ReservationPaymentStatus } from '../src/core/reservations/domain/reservation-payment-status.enum';
import { RoomEntity } from '../src/core/rooms/infrastructure/room.entity';
import { RoomOperationalStatus } from '../src/core/rooms/domain/room-operational-status.enum';
import { RoomTypeEntity } from '../src/core/room-types/infrastructure/room-type.entity';
import { FolioEntity } from '../src/core/billing/infrastructure/folio.entity';
import { FolioStatus } from '../src/core/billing/domain/folio-status.enum';
import { FolioChargeEntity } from '../src/core/billing/infrastructure/folio-charge.entity';
import { FolioChargeType } from '../src/core/billing/domain/folio-charge-type.enum';
import { FolioPaymentEntity } from '../src/core/billing/infrastructure/folio-payment.entity';
import { FolioPaymentMethod } from '../src/core/billing/domain/folio-payment-method.enum';
import { GroupBookingEntity } from '../src/core/operations/infrastructure/group-booking.entity';
import { GroupBookingStatus } from '../src/core/operations/domain/group-booking-status.enum';
import { GroupBookingSource } from '../src/core/operations/domain/group-booking-source.enum';
import type { EntityManager } from 'typeorm';

const UAT_PREFIX = 'UAT26';
const ALLOW_PRODUCTION_FLAG = 'ALLOW_HILLSTON_UAT_SEED';

function dateOnly(offsetDays: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function atLocalTime(offsetDays: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function isProduction(): boolean {
  return String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
}

function assertSafeEnvironment(): void {
  if (isProduction() && process.env[ALLOW_PRODUCTION_FLAG] !== 'YES') {
    throw new Error(
      `Production seed blocked. Set ${ALLOW_PRODUCTION_FLAG}=YES only for the dedicated UAT/demo property database.`,
    );
  }
}

type GuestSeed = {
  key: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  companyName?: string;
  vip?: boolean;
  nationality?: string;
};

const guestSeeds: GuestSeed[] = [
  {
    key: 'RAHUL',
    firstName: 'Rahul',
    lastName: 'Sharma',
    phone: '+919100000101',
    email: 'rahul.sharma.uat@stayos.local',
  },
  {
    key: 'SARAH',
    firstName: 'Sarah',
    lastName: 'Wilson',
    phone: '+919100000102',
    email: 'sarah.wilson.uat@stayos.local',
    nationality: 'United Kingdom',
  },
  {
    key: 'AKASH',
    firstName: 'Akash',
    lastName: 'Jain',
    phone: '+919100000103',
    email: 'akash.jain.uat@stayos.local',
  },
  {
    key: 'NEHA',
    firstName: 'Neha',
    lastName: 'Gupta',
    phone: '+919100000104',
    email: 'neha.gupta.uat@stayos.local',
  },
  {
    key: 'RHEA',
    firstName: 'Rhea',
    lastName: 'Malhotra',
    phone: '+919100000105',
    email: 'rhea.malhotra.uat@stayos.local',
    vip: true,
  },
  {
    key: 'DAVID',
    firstName: 'David',
    lastName: 'Brown',
    phone: '+919100000106',
    email: 'david.brown.uat@stayos.local',
    nationality: 'United States',
  },
  {
    key: 'AARAV',
    firstName: 'Aarav',
    lastName: 'Kapoor',
    phone: '+919100000107',
    email: 'aarav.kapoor.uat@stayos.local',
  },
  {
    key: 'EMILY',
    firstName: 'Emily',
    lastName: 'Johnson',
    phone: '+919100000108',
    email: 'emily.johnson.uat@stayos.local',
    nationality: 'Canada',
  },
  {
    key: 'RAJAT',
    firstName: 'Rajat',
    lastName: 'Jain',
    phone: '+919100000109',
    email: 'rajat.jain.uat@stayos.local',
  },
  {
    key: 'PRIYA',
    firstName: 'Priya',
    lastName: 'Verma',
    phone: '+919100000110',
    email: 'priya.verma.uat@stayos.local',
  },
  {
    key: 'VIKRAM',
    firstName: 'Vikram',
    lastName: 'Singh',
    phone: '+919100000111',
    email: 'vikram.singh.uat@stayos.local',
    companyName: 'Deloitte India',
  },
  {
    key: 'DEV',
    firstName: 'Dev',
    lastName: 'Sharma',
    phone: '+919100000112',
    email: 'dev.sharma.uat@stayos.local',
    companyName: 'Infosys Ltd.',
  },
  {
    key: 'KAVYA',
    firstName: 'Kavya',
    lastName: 'Mehta',
    phone: '+919100000113',
    email: 'kavya.mehta.uat@stayos.local',
  },
  {
    key: 'ARJUN',
    firstName: 'Arjun',
    lastName: 'Nair',
    phone: '+919100000114',
    email: 'arjun.nair.uat@stayos.local',
    companyName: 'TCS',
  },
  {
    key: 'MEERA',
    firstName: 'Meera',
    lastName: 'Iyer',
    phone: '+919100000115',
    email: 'meera.iyer.uat@stayos.local',
  },
  {
    key: 'ROHAN',
    firstName: 'Rohan',
    lastName: 'Desai',
    phone: '+919100000116',
    email: 'rohan.desai.uat@stayos.local',
  },
  {
    key: 'ANANYA',
    firstName: 'Ananya',
    lastName: 'Rao',
    phone: '+919100000117',
    email: 'ananya.rao.uat@stayos.local',
    vip: true,
  },
  {
    key: 'KARAN',
    firstName: 'Karan',
    lastName: 'Bhatia',
    phone: '+919100000118',
    email: 'karan.bhatia.uat@stayos.local',
  },
];

type ReservationSeed = {
  code: string;
  guestKey: string;
  roomNumber?: string;
  roomTypeCode: 'DLX' | 'STE';
  arrivalOffset: number;
  departureOffset: number;
  status: ReservationStatus;
  source: ReservationSource;
  paymentStatus: ReservationPaymentStatus;
  paymentMethod?: string;
  adults?: number;
  children?: number;
  notes?: string;
  specialRequests?: string;
  folio?: {
    status: FolioStatus;
    roomAmount: number;
    extraCharges?: Array<{
      type: FolioChargeType;
      description: string;
      amount: number;
      tax?: number;
    }>;
    payment?: { method: FolioPaymentMethod; amount: number; reference: string };
  };
};

const reservationSeeds: ReservationSeed[] = [
  // Arrivals today: staff can perform check-in.
  {
    code: `${UAT_PREFIX}-ARR-01`,
    guestKey: 'RAHUL',
    roomNumber: '201',
    roomTypeCode: 'DLX',
    arrivalOffset: 0,
    departureOffset: 2,
    status: ReservationStatus.CONFIRMED,
    source: ReservationSource.WEBSITE,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    adults: 2,
    specialRequests: 'Early check-in requested; ID verification pending.',
  },
  {
    code: `${UAT_PREFIX}-ARR-02`,
    guestKey: 'SARAH',
    roomNumber: '203',
    roomTypeCode: 'DLX',
    arrivalOffset: 0,
    departureOffset: 3,
    status: ReservationStatus.CONFIRMED,
    source: ReservationSource.OTA,
    paymentStatus: ReservationPaymentStatus.PAID,
    paymentMethod: 'OTA Prepaid',
    specialRequests: 'Quiet room; airport pickup.',
  },
  {
    code: `${UAT_PREFIX}-ARR-03`,
    guestKey: 'AKASH',
    roomNumber: '208',
    roomTypeCode: 'DLX',
    arrivalOffset: 0,
    departureOffset: 1,
    status: ReservationStatus.CONFIRMED,
    source: ReservationSource.DIRECT,
    paymentStatus: ReservationPaymentStatus.PARTIALLY_PAID,
    paymentMethod: 'UPI',
    notes: 'Business traveller.',
  },
  {
    code: `${UAT_PREFIX}-ARR-04`,
    guestKey: 'NEHA',
    roomNumber: '303',
    roomTypeCode: 'STE',
    arrivalOffset: 0,
    departureOffset: 2,
    status: ReservationStatus.CONFIRMED,
    source: ReservationSource.OTA,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    adults: 2,
    children: 1,
    specialRequests: 'Extra bed required.',
  },

  // Tomorrow/future arrivals.
  {
    code: `${UAT_PREFIX}-FUT-01`,
    guestKey: 'RAJAT',
    roomNumber: '205',
    roomTypeCode: 'DLX',
    arrivalOffset: 1,
    departureOffset: 3,
    status: ReservationStatus.CONFIRMED,
    source: ReservationSource.DIRECT,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
  },
  {
    code: `${UAT_PREFIX}-FUT-02`,
    guestKey: 'PRIYA',
    roomNumber: '210',
    roomTypeCode: 'DLX',
    arrivalOffset: 1,
    departureOffset: 2,
    status: ReservationStatus.CONFIRMED,
    source: ReservationSource.WALK_IN,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    notes: 'Test future walk-in reservation.',
  },
  {
    code: `${UAT_PREFIX}-FUT-03`,
    guestKey: 'VIKRAM',
    roomNumber: '304',
    roomTypeCode: 'DLX',
    arrivalOffset: 2,
    departureOffset: 5,
    status: ReservationStatus.CONFIRMED,
    source: ReservationSource.CORPORATE,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    paymentMethod: 'Corporate Credit',
  },
  {
    code: `${UAT_PREFIX}-FUT-04`,
    guestKey: 'KAVYA',
    roomNumber: '309',
    roomTypeCode: 'STE',
    arrivalOffset: 3,
    departureOffset: 5,
    status: ReservationStatus.PENDING,
    source: ReservationSource.OTA,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
  },

  // In-house stays: reservation is checked in and has an open folio.
  {
    code: `${UAT_PREFIX}-INH-01`,
    guestKey: 'RHEA',
    roomNumber: '202',
    roomTypeCode: 'DLX',
    arrivalOffset: -2,
    departureOffset: 1,
    status: ReservationStatus.CHECKED_IN,
    source: ReservationSource.DIRECT,
    paymentStatus: ReservationPaymentStatus.PARTIALLY_PAID,
    paymentMethod: 'CARD',
    specialRequests: 'VIP; late checkout requested.',
    folio: {
      status: FolioStatus.OPEN,
      roomAmount: 7200,
      extraCharges: [
        {
          type: FolioChargeType.FOOD_AND_BEVERAGE,
          description: 'Dinner - Restaurant',
          amount: 1800,
          tax: 90,
        },
        { type: FolioChargeType.LAUNDRY, description: 'Laundry service', amount: 450, tax: 22.5 },
      ],
      payment: { method: FolioPaymentMethod.CARD, amount: 5000, reference: 'UAT-CARD-001' },
    },
  },
  {
    code: `${UAT_PREFIX}-INH-02`,
    guestKey: 'DAVID',
    roomNumber: '206',
    roomTypeCode: 'DLX',
    arrivalOffset: -1,
    departureOffset: 0,
    status: ReservationStatus.CHECKED_IN,
    source: ReservationSource.OTA,
    paymentStatus: ReservationPaymentStatus.PAID,
    paymentMethod: 'OTA Prepaid',
    folio: {
      status: FolioStatus.OPEN,
      roomAmount: 4800,
      extraCharges: [
        {
          type: FolioChargeType.MINIBAR,
          description: 'Minibar consumption',
          amount: 650,
          tax: 32.5,
        },
      ],
      payment: { method: FolioPaymentMethod.OTHER, amount: 5482.5, reference: 'OTA-UAT-002' },
    },
  },
  {
    code: `${UAT_PREFIX}-INH-03`,
    guestKey: 'AARAV',
    roomNumber: '301',
    roomTypeCode: 'DLX',
    arrivalOffset: -3,
    departureOffset: 1,
    status: ReservationStatus.CHECKED_IN,
    source: ReservationSource.CORPORATE,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    paymentMethod: 'Corporate Credit',
    folio: {
      status: FolioStatus.OPEN,
      roomAmount: 14400,
      extraCharges: [
        { type: FolioChargeType.MISC, description: 'Airport pickup', amount: 1500, tax: 75 },
      ],
    },
  },
  {
    code: `${UAT_PREFIX}-INH-04`,
    guestKey: 'ANANYA',
    roomNumber: '303',
    roomTypeCode: 'STE',
    arrivalOffset: -1,
    departureOffset: 2,
    status: ReservationStatus.CHECKED_IN,
    source: ReservationSource.DIRECT,
    paymentStatus: ReservationPaymentStatus.PARTIALLY_PAID,
    paymentMethod: 'UPI',
    specialRequests: 'VIP; high floor; extra pillows.',
    folio: {
      status: FolioStatus.OPEN,
      roomAmount: 11000,
      extraCharges: [
        {
          type: FolioChargeType.FOOD_AND_BEVERAGE,
          description: 'Breakfast buffet',
          amount: 1200,
          tax: 60,
        },
      ],
      payment: { method: FolioPaymentMethod.UPI, amount: 6000, reference: 'UAT-UPI-004' },
    },
  },
  {
    code: `${UAT_PREFIX}-INH-05`,
    guestKey: 'ARJUN',
    roomNumber: '307',
    roomTypeCode: 'DLX',
    arrivalOffset: -2,
    departureOffset: 2,
    status: ReservationStatus.CHECKED_IN,
    source: ReservationSource.CORPORATE,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    paymentMethod: 'Corporate Credit',
    folio: { status: FolioStatus.OPEN, roomAmount: 9600 },
  },

  // Checked-out history.
  {
    code: `${UAT_PREFIX}-OUT-01`,
    guestKey: 'EMILY',
    roomNumber: '305',
    roomTypeCode: 'DLX',
    arrivalOffset: -5,
    departureOffset: -2,
    status: ReservationStatus.CHECKED_OUT,
    source: ReservationSource.OTA,
    paymentStatus: ReservationPaymentStatus.PAID,
    paymentMethod: 'CARD',
    folio: {
      status: FolioStatus.SETTLED,
      roomAmount: 10800,
      extraCharges: [
        {
          type: FolioChargeType.FOOD_AND_BEVERAGE,
          description: 'Restaurant charges',
          amount: 2200,
          tax: 110,
        },
      ],
      payment: { method: FolioPaymentMethod.CARD, amount: 13110, reference: 'UAT-CARD-OUT-01' },
    },
  },
  {
    code: `${UAT_PREFIX}-OUT-02`,
    guestKey: 'MEERA',
    roomNumber: '308',
    roomTypeCode: 'DLX',
    arrivalOffset: -4,
    departureOffset: -1,
    status: ReservationStatus.CHECKED_OUT,
    source: ReservationSource.WEBSITE,
    paymentStatus: ReservationPaymentStatus.PAID,
    paymentMethod: 'UPI',
    folio: {
      status: FolioStatus.SETTLED,
      roomAmount: 10800,
      payment: { method: FolioPaymentMethod.UPI, amount: 10800, reference: 'UAT-UPI-OUT-02' },
    },
  },

  // Negative scenarios.
  {
    code: `${UAT_PREFIX}-CAN-01`,
    guestKey: 'ROHAN',
    roomTypeCode: 'DLX',
    arrivalOffset: 1,
    departureOffset: 3,
    status: ReservationStatus.CANCELLED,
    source: ReservationSource.OTA,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    notes: 'Cancelled booking test scenario.',
  },
  {
    code: `${UAT_PREFIX}-NOS-01`,
    guestKey: 'KARAN',
    roomTypeCode: 'DLX',
    arrivalOffset: -1,
    departureOffset: 1,
    status: ReservationStatus.NO_SHOW,
    source: ReservationSource.WEBSITE,
    paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
    notes: 'No-show test scenario.',
  },
];

async function upsertGuests(
  manager: EntityManager,
  propertyId: string,
): Promise<Map<string, GuestEntity>> {
  const repository = manager.getRepository(GuestEntity);
  const result = new Map<string, GuestEntity>();

  for (const seed of guestSeeds) {
    const existing = await repository.findOne({ where: { propertyId, phone: seed.phone } });
    const entity = repository.create({
      ...(existing ?? {}),
      propertyId,
      firstName: seed.firstName,
      lastName: seed.lastName,
      displayName: `${seed.firstName} ${seed.lastName}`,
      phone: seed.phone,
      alternatePhone: null,
      email: seed.email,
      gender: null,
      dateOfBirth: null,
      anniversaryDate: null,
      nationality: seed.nationality ?? 'Indian',
      preferredLanguage: 'English',
      companyName: seed.companyName ?? null,
      gstNumber: null,
      vipStatus: seed.vip ?? false,
      blacklistStatus: false,
      notes: `StayOS UAT guest (${seed.key})`,
      status: GuestStatus.ACTIVE,
      city: 'Indore',
      state: 'Madhya Pradesh',
      country: 'India',
      postalCode: '452001',
      purposeOfVisit: seed.companyName ? 'Business' : 'Leisure',
      roomPreference: seed.vip ? 'High floor' : null,
      bedPreference: 'King',
      smokingPreference: 'Non Smoking',
    });
    result.set(seed.key, await repository.save(entity));
  }

  return result;
}

async function upsertFolio(
  manager: EntityManager,
  propertyId: string,
  reservation: ReservationEntity,
  seed: NonNullable<ReservationSeed['folio']>,
): Promise<void> {
  const folioRepository = manager.getRepository(FolioEntity);
  const chargeRepository = manager.getRepository(FolioChargeEntity);
  const paymentRepository = manager.getRepository(FolioPaymentEntity);

  const folioNumber = `FO-${reservation.reservationCode}`.slice(0, 32);
  let folio = await folioRepository.findOne({ where: { reservationId: reservation.id } });
  folio = await folioRepository.save(
    folioRepository.create({
      ...(folio ?? {}),
      propertyId,
      reservationId: reservation.id,
      guestId: reservation.guestId,
      folioNumber,
      status: seed.status,
      currency: 'INR',
      settledAt: seed.status === FolioStatus.SETTLED ? atLocalTime(-1, 11) : null,
      notes: 'StayOS Hillston UAT folio',
    }),
  );

  await chargeRepository.delete({ folioId: folio.id });
  await paymentRepository.delete({ folioId: folio.id });

  const roomTax = Number((seed.roomAmount * 0.05).toFixed(2));
  await chargeRepository.save(
    chargeRepository.create({
      folioId: folio.id,
      type: FolioChargeType.ROOM,
      description: 'Room charges',
      quantity: 1,
      unitAmount: seed.roomAmount.toFixed(2),
      amount: seed.roomAmount.toFixed(2),
      taxAmount: roomTax.toFixed(2),
      chargedAt: atLocalTime(-1, 9),
      createdByUserId: null,
    }),
  );

  for (const extra of seed.extraCharges ?? []) {
    await chargeRepository.save(
      chargeRepository.create({
        folioId: folio.id,
        type: extra.type,
        description: extra.description,
        quantity: 1,
        unitAmount: extra.amount.toFixed(2),
        amount: extra.amount.toFixed(2),
        taxAmount: (extra.tax ?? 0).toFixed(2),
        chargedAt: atLocalTime(0, 10),
        createdByUserId: null,
      }),
    );
  }

  if (seed.payment) {
    await paymentRepository.save(
      paymentRepository.create({
        folioId: folio.id,
        method: seed.payment.method,
        amount: seed.payment.amount.toFixed(2),
        reference: seed.payment.reference,
        notes: 'UAT payment',
        receivedAt: atLocalTime(0, 10),
        receivedByUserId: null,
      }),
    );
  }
}

async function seedOperationalData(manager: EntityManager): Promise<void> {
  await bootstrapHillston(manager);

  const property = await manager.getRepository(PropertyEntity).findOne({
    where: { code: HILLSTON_PROPERTY_CODE },
  });
  if (!property) throw new Error('Hillston property bootstrap failed.');

  const roomRepository = manager.getRepository(RoomEntity);
  const roomTypeRepository = manager.getRepository(RoomTypeEntity);
  const reservationRepository = manager.getRepository(ReservationEntity);
  const groupRepository = manager.getRepository(GroupBookingEntity);

  const rooms = await roomRepository.find({ where: { propertyId: property.id } });
  const roomTypes = await roomTypeRepository.find({ where: { propertyId: property.id } });
  const roomByNumber = new Map(rooms.map((room) => [room.roomNumber, room]));
  const roomTypeByCode = new Map(roomTypes.map((roomType) => [roomType.code, roomType]));
  const guests = await upsertGuests(manager, property.id);

  // Reset only the room operational fields used by this UAT scenario.
  for (const room of rooms) {
    room.operationalStatus = RoomOperationalStatus.READY;
    room.operationalStatusReason = null;
    room.operationalStatusNote = null;
    room.startedAt = null;
    room.completedAt = null;
    room.inspectedAt = null;
    await roomRepository.save(room);
  }

  for (const seed of reservationSeeds) {
    const guest = guests.get(seed.guestKey);
    const roomType = roomTypeByCode.get(seed.roomTypeCode);
    const room = seed.roomNumber ? roomByNumber.get(seed.roomNumber) : undefined;
    if (!guest || !roomType) throw new Error(`Invalid UAT reservation seed ${seed.code}`);

    const existing = await reservationRepository.findOne({
      where: { propertyId: property.id, reservationCode: seed.code },
    });
    const reservation = await reservationRepository.save(
      reservationRepository.create({
        ...(existing ?? {}),
        propertyId: property.id,
        guestId: guest.id,
        reservationCode: seed.code,
        arrivalDate: dateOnly(seed.arrivalOffset),
        departureDate: dateOnly(seed.departureOffset),
        adults: seed.adults ?? 1,
        children: seed.children ?? 0,
        roomTypeId: roomType.id,
        roomId: room?.id ?? null,
        source: seed.source,
        status: seed.status,
        paymentStatus: seed.paymentStatus,
        paymentMethod: seed.paymentMethod ?? null,
        notes: seed.notes ?? 'StayOS Hillston UAT reservation',
        specialRequests: seed.specialRequests ?? null,
        paymentReviewed: false,
        paymentReviewNotes: null,
        isForeignNational: (guest.nationality ?? 'Indian') !== 'Indian',
      }),
    );

    if (room && seed.status === ReservationStatus.CHECKED_IN) {
      room.operationalStatus = RoomOperationalStatus.OCCUPIED;
      room.operationalStatusReason = 'Occupied by UAT checked-in reservation';
      room.operationalStatusNote = reservation.reservationCode;
      await roomRepository.save(room);
    }

    if (seed.folio) {
      await upsertFolio(manager, property.id, reservation, seed.folio);
    }
  }

  // Operational room scenarios not tied to an occupied reservation.
  const dirtyRoom = roomByNumber.get('214');
  if (dirtyRoom) {
    dirtyRoom.operationalStatus = RoomOperationalStatus.NEEDS_CLEANING;
    dirtyRoom.operationalStatusReason = 'Checkout cleaning required';
    dirtyRoom.operationalStatusNote = 'Priority cleaning for next arrival';
    dirtyRoom.startedAt = atLocalTime(0, 10);
    await roomRepository.save(dirtyRoom);
  }

  const inspectionRoom = roomByNumber.get('310');
  if (inspectionRoom) {
    inspectionRoom.operationalStatus = RoomOperationalStatus.INSPECTION;
    inspectionRoom.operationalStatusReason = 'Housekeeping inspection pending';
    inspectionRoom.operationalStatusNote = 'Supervisor inspection test scenario';
    await roomRepository.save(inspectionRoom);
  }

  const maintenanceRoom = roomByNumber.get('311');
  if (maintenanceRoom) {
    maintenanceRoom.operationalStatus = RoomOperationalStatus.MAINTENANCE;
    maintenanceRoom.operationalStatusReason = 'AC not cooling';
    maintenanceRoom.operationalStatusNote = 'UAT maintenance scenario';
    maintenanceRoom.startedAt = atLocalTime(0, 9);
    await roomRepository.save(maintenanceRoom);
  }

  const existingGroup = await groupRepository.findOne({
    where: { propertyId: property.id, groupCode: `${UAT_PREFIX}-GRP-01` },
  });
  await groupRepository.save(
    groupRepository.create({
      ...(existingGroup ?? {}),
      propertyId: property.id,
      groupCode: `${UAT_PREFIX}-GRP-01`,
      groupName: 'Infosys Leadership Workshop',
      leadName: 'Dev Sharma',
      leadPhone: '+919100000112',
      leadEmail: 'dev.sharma.uat@stayos.local',
      arrivalDate: dateOnly(1),
      departureDate: dateOnly(3),
      adults: 8,
      children: 0,
      source: GroupBookingSource.CORPORATE,
      status: GroupBookingStatus.CONFIRMED,
      releaseAt: null,
      depositRequired: '20000.00',
      estimatedTotal: '72000.00',
      externalChannelId: null,
      syncStatus: 'PMS_ONLY',
      notes: 'UAT group booking. Suggested room block: 208, 209, 210, 211.',
    }),
  );

  console.log('Hillston UAT seed completed');
  console.log(`Property: ${property.name} (${property.code})`);
  console.log(`Guests: ${guestSeeds.length}`);
  console.log(`Reservations: ${reservationSeeds.length}`);
  console.log(
    'Scenarios: arrivals today, future arrivals, checked-in, checked-out, cancelled, no-show',
  );
  console.log('Group booking: Infosys Leadership Workshop');
  console.log('Room scenarios: 214 needs cleaning, 310 inspection, 311 maintenance');
}

async function run(): Promise<void> {
  assertSafeEnvironment();
  await dataSource.initialize();
  try {
    await dataSource.transaction(seedOperationalData);
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    process.exitCode = 1;
  });
}

export { run as runHillstonUatSeed, seedOperationalData };
