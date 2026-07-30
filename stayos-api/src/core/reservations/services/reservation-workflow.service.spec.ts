import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { GuestStatus } from '../../guests/domain/guest-status.enum';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { RoomTypeStatus } from '../../room-types/domain/room-type-status.enum';
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../../rooms/domain/room-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationSource } from '../domain/reservation-source.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';
import { ReservationEntity } from '../infrastructure/reservation.entity';
import { CheckInService } from './check-in.service';
import { ReservationWorkflowService } from './reservation-workflow.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const otherPropertyId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';
const guestId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const roomTypeId = '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673';
const otherRoomTypeId = '7175c8fa-f36e-4f40-a3ef-2e9dbb1f0673';
const roomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674';
const targetRoomId = '8175c8fa-f36e-4f40-a3ef-2e9dbb1f0674';
const reservationId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';

const guestEntity = (): GuestEntity => ({
  id: guestId,
  propertyId,
  property: undefined as never,
  firstName: 'Rahul',
  lastName: 'Sharma',
  displayName: 'Rahul Sharma',
  phone: '9876500001',
  alternatePhone: null,
  email: null,
  gender: null,
  dateOfBirth: null,
  anniversaryDate: null,
  nationality: null,
  preferredLanguage: null,
  companyName: null,
  gstNumber: null,
  vipStatus: false,
  blacklistStatus: false,
  notes: null,
  status: GuestStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
});

const roomTypeEntity = (overrides: Partial<RoomTypeEntity> = {}): RoomTypeEntity => ({
  id: roomTypeId,
  propertyId,
  property: undefined as never,
  code: 'DLX',
  name: 'Deluxe',
  description: null,
  baseOccupancy: 2,
  maxOccupancy: 3,
  maxAdults: 2,
  maxChildren: 1,
  bedType: 'King',
  sizeSqFt: 251,
  status: RoomTypeStatus.ACTIVE,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const roomEntity = (overrides: Partial<RoomEntity> = {}): RoomEntity => ({
  id: roomId,
  propertyId,
  property: undefined as never,
  floorId: 'a075c8fa-f36e-4f40-a3ef-2e9dbb1f0676',
  floor: undefined as never,
  roomTypeId,
  roomType: undefined as never,
  roomNumber: '204',
  displayName: '204',
  description: null,
  status: RoomStatus.ACTIVE,
  operationalStatus: RoomOperationalStatus.READY,
  operationalStatusReason: null,
  operationalStatusNote: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const reservationEntity = (overrides: Partial<ReservationEntity> = {}): ReservationEntity => ({
  id: reservationId,
  propertyId,
  property: undefined as never,
  guestId,
  guest: undefined as never,
  reservationCode: 'RSV-001',
  arrivalDate: '2026-07-15',
  departureDate: '2026-07-17',
  adults: 2,
  children: 0,
  roomTypeId,
  roomType: undefined as never,
  roomId: null,
  room: null,
  source: ReservationSource.DIRECT,
  status: ReservationStatus.CONFIRMED,
  paymentStatus: ReservationPaymentStatus.PAYMENT_DUE,
  notes: null,
  specialRequests: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

describe('ReservationWorkflowService', () => {
  let service: ReservationWorkflowService;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let roomsRepository: MockRepository<RoomEntity>;
  let roomTypesRepository: MockRepository<RoomTypeEntity>;
  let guestsRepository: MockRepository<GuestEntity>;
  let auditRepository: MockRepository<AuditEventEntity>;
  let activityRepository: MockRepository<ActivityEventEntity>;
  let checkInService: Pick<CheckInService, 'loadWorkspaceParts' | 'validateFinalChecklist'>;

  beforeEach(() => {
    reservationsRepository = {
      findOne: jest.fn().mockResolvedValue(reservationEntity()),
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn().mockImplementation(async (entity: ReservationEntity) => entity),
    };
    roomsRepository = {
      findOne: jest.fn().mockResolvedValue(roomEntity()),
      save: jest.fn().mockImplementation(async (entity: RoomEntity) => entity),
    };
    roomTypesRepository = {
      findOne: jest.fn().mockResolvedValue(roomTypeEntity()),
    };
    guestsRepository = {
      findOne: jest.fn().mockResolvedValue(guestEntity()),
    };
    auditRepository = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    activityRepository = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === ReservationEntity) return reservationsRepository;
        if (entity === RoomEntity) return roomsRepository;
        if (entity === RoomTypeEntity) return roomTypesRepository;
        if (entity === GuestEntity) return guestsRepository;
        if (entity === AuditEventEntity) return auditRepository;
        if (entity === ActivityEventEntity) return activityRepository;
        throw new Error('Unexpected repository');
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource;

    checkInService = {
      loadWorkspaceParts: jest.fn(async () => ({
        reservation: await reservationsRepository.findOne?.(),
        guest: await guestsRepository.findOne?.(),
        room: await roomsRepository.findOne?.(),
        identity: { verified: true } as never,
      })),
      validateFinalChecklist: jest.fn((parts) => {
        if (parts.room?.operationalStatus !== RoomOperationalStatus.READY) {
          throw new BadRequestException();
        }
      }),
    };

    service = new ReservationWorkflowService(dataSource, checkInService as CheckInService);
  });

  describe('assignRoom', () => {
    it('assigns ready matching room successfully', async () => {
      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).resolves.toMatchObject({
        reservation: { id: reservationId, roomId },
        room: { id: roomId, operationalStatus: RoomOperationalStatus.READY },
      });
      expect(auditRepository.save).toHaveBeenCalled();
      expect(activityRepository.save).toHaveBeenCalled();
    });

    it('rejects missing reservation', async () => {
      reservationsRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects missing room', async () => {
      roomsRepository.findOne?.mockResolvedValue(null);

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects room from another property', async () => {
      roomsRepository.findOne?.mockResolvedValue(roomEntity({ propertyId: otherPropertyId }));

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects room type mismatch', async () => {
      roomsRepository.findOne?.mockResolvedValue(roomEntity({ roomTypeId: otherRoomTypeId }));

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects capacity mismatch', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ adults: 4 }));

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unavailable room', async () => {
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.NEEDS_CLEANING }),
      );

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects occupied room', async () => {
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects overlapping active assignment', async () => {
      reservationsRepository.count?.mockResolvedValue(1);

      await expect(
        service.assignRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('checkIn', () => {
    it('checks in confirmed reservation with ready assigned room', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));

      await expect(service.checkIn(propertyId, reservationId)).resolves.toMatchObject({
        reservation: { id: reservationId, status: ReservationStatus.CHECKED_IN },
        room: { id: roomId, operationalStatus: RoomOperationalStatus.OCCUPIED },
      });
    });

    it('rejects pending reservation', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.PENDING }),
      );

      await expect(service.checkIn(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects cancelled reservation', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CANCELLED }),
      );

      await expect(service.checkIn(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects missing room assignment', async () => {
      await expect(service.checkIn(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects non-ready room', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));
      roomsRepository.findOne?.mockResolvedValue(
        roomEntity({ operationalStatus: RoomOperationalStatus.NEEDS_CLEANING }),
      );

      await expect(service.checkIn(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('updates room to occupied', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));

      await service.checkIn(propertyId, reservationId);

      expect(roomsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );
    });
  });

  describe('checkOut', () => {
    it('checks out checked-in reservation', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await expect(service.checkOut(propertyId, reservationId)).resolves.toMatchObject({
        reservation: { id: reservationId, status: ReservationStatus.CHECKED_OUT },
      });
    });

    it('rejects reservation not checked in', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));

      await expect(service.checkOut(propertyId, reservationId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('updates room to needs cleaning', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await service.checkOut(propertyId, reservationId);

      expect(roomsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ operationalStatus: RoomOperationalStatus.NEEDS_CLEANING }),
      );
    });

    it('creates audit event', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await service.checkOut(propertyId, reservationId);

      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RESERVATION_CHECKED_OUT' }),
      );
    });

    it('creates activity event', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );

      await service.checkOut(propertyId, reservationId);

      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GUEST_CHECKED_OUT' }),
      );
    });
  });

  describe('moveRoom', () => {
    beforeEach(() => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ roomId, status: ReservationStatus.CHECKED_IN }),
      );
      roomsRepository.findOne?.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === targetRoomId
          ? roomEntity({ id: targetRoomId, roomNumber: '305' })
          : roomEntity({ id: roomId, operationalStatus: RoomOperationalStatus.OCCUPIED }),
      );
    });

    it('moves checked-in reservation to ready target room', async () => {
      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId, reason: 'Guest requested quieter room' }),
      ).resolves.toMatchObject({
        reservation: { id: reservationId, roomId: targetRoomId },
        room: { id: targetRoomId, operationalStatus: RoomOperationalStatus.OCCUPIED },
      });
    });

    it('marks old room for cleaning', async () => {
      await service.moveRoom(propertyId, reservationId, { roomId: targetRoomId });

      expect(roomsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: roomId,
          operationalStatus: RoomOperationalStatus.NEEDS_CLEANING,
          operationalStatusReason: 'ROOM_MOVE',
        }),
      );
    });

    it('creates audit and activity events', async () => {
      await service.moveRoom(propertyId, reservationId, { roomId: targetRoomId });

      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RESERVATION_ROOM_MOVED' }),
      );
      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ROOM_MOVED' }),
      );
    });

    it('rejects reservation that is not checked in', async () => {
      reservationsRepository.findOne?.mockResolvedValue(reservationEntity({ roomId }));

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects missing room assignment', async () => {
      reservationsRepository.findOne?.mockResolvedValue(
        reservationEntity({ status: ReservationStatus.CHECKED_IN }),
      );

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects same target room', async () => {
      await expect(
        service.moveRoom(propertyId, reservationId, { roomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects missing target room', async () => {
      roomsRepository.findOne?.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === targetRoomId ? null : roomEntity({ id: roomId }),
      );

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects target room from another property', async () => {
      roomsRepository.findOne?.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === targetRoomId
          ? roomEntity({ id: targetRoomId, propertyId: otherPropertyId })
          : roomEntity({ id: roomId }),
      );

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unavailable target room', async () => {
      roomsRepository.findOne?.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === targetRoomId
          ? roomEntity({ id: targetRoomId, operationalStatus: RoomOperationalStatus.NEEDS_CLEANING })
          : roomEntity({ id: roomId }),
      );

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects overlapping target room assignment', async () => {
      reservationsRepository.count?.mockResolvedValue(1);

      await expect(
        service.moveRoom(propertyId, reservationId, { roomId: targetRoomId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
