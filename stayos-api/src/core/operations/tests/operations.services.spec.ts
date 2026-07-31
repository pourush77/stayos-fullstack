import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationPaymentStatus } from '../../reservations/domain/reservation-payment-status.enum';
import { ReservationSource } from '../../reservations/domain/reservation-source.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../../rooms/domain/room-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { ActivityFeedService } from '../services/activity-feed.service';
import { NeedsAttentionService } from '../services/needs-attention.service';
import { RoomAvailabilityService } from '../services/room-availability.service';
import { RoomBoardService } from '../services/room-board.service';
import { RoomDetailsService } from '../services/room-details.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const roomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674';
const roomTypeId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';

const room = (overrides: Partial<RoomEntity> = {}): RoomEntity => ({
  id: roomId,
  propertyId,
  property: undefined as never,
  floorId: 'floor-id',
  floor: { name: 'Second', floorNumber: 2 } as never,
  roomTypeId,
  roomType: { code: 'DLX', name: 'Deluxe', maxOccupancy: 3, maxAdults: 2, maxChildren: 1 } as never,
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

const reservation = (overrides: Partial<ReservationEntity> = {}): ReservationEntity => ({
  id: '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675',
  propertyId,
  property: undefined as never,
  guestId: 'guest-id',
  guest: { displayName: 'Rahul Sharma', vipStatus: false } as never,
  reservationCode: 'RSV-001',
  arrivalDate: '2026-07-01',
  departureDate: '2026-07-03',
  adults: 2,
  children: 0,
  roomTypeId,
  roomType: undefined as never,
  roomId,
  room: undefined as never,
  source: ReservationSource.DIRECT,
  status: ReservationStatus.CHECKED_IN,
  paymentStatus: ReservationPaymentStatus.PAID,
  notes: null,
  specialRequests: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const asRepository = <T extends object>(repository: MockRepository<T>): Repository<T> =>
  repository as unknown as Repository<T>;

describe('Operations services', () => {
  let roomsRepository: MockRepository<RoomEntity>;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let activityRepository: MockRepository<ActivityEventEntity>;
  let auditRepository: MockRepository<AuditEventEntity>;
  const propertiesService = { findOne: jest.fn() } as unknown as jest.Mocked<PropertiesService>;

  beforeEach(() => {
    jest.clearAllMocks();
    roomsRepository = {
      find: jest.fn().mockResolvedValue([room()]),
      findOne: jest.fn().mockResolvedValue(room()),
    };
    reservationsRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    activityRepository = { find: jest.fn().mockResolvedValue([]) };
    auditRepository = { find: jest.fn().mockResolvedValue([]) };
    propertiesService.findOne.mockResolvedValue({ id: propertyId } as never);
  });

  it('returns room board data', async () => {
    reservationsRepository.find?.mockResolvedValue([reservation()]);
    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      propertiesService,
    );

    await expect(service.getRoomBoard(propertyId)).resolves.toHaveLength(1);
  });

  it('propagates property not found', async () => {
    propertiesService.findOne.mockRejectedValue(new NotFoundException());
    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      propertiesService,
    );

    await expect(service.getRoomBoard(propertyId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects missing room drawer room', async () => {
    roomsRepository.findOne?.mockResolvedValue(null);
    const service = new RoomDetailsService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(activityRepository),
      asRepository(auditRepository),
      propertiesService,
    );

    await expect(service.getRoomDetails(propertyId, roomId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns no available rooms when all rooms have date conflicts', async () => {
    reservationsRepository.find?.mockResolvedValue([reservation()]);
    const service = new RoomAvailabilityService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      propertiesService,
    );

    await expect(
      service.getAvailableRooms(propertyId, {
        arrivalDate: '2026-07-02',
        departureDate: '2026-07-04',
      }),
    ).resolves.toEqual([]);
  });

  it('allows Deluxe availability for two adults and one child', async () => {
    const service = new RoomAvailabilityService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      propertiesService,
    );

    await expect(
      service.getAvailableRooms(propertyId, {
        adults: 2,
        children: 1,
        guestCount: 3,
        roomTypeId,
      }),
    ).resolves.toHaveLength(1);
  });

  it('rejects Deluxe availability when child capacity is exceeded', async () => {
    const service = new RoomAvailabilityService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      propertiesService,
    );

    await expect(
      service.getAvailableRooms(propertyId, {
        adults: 1,
        children: 2,
        guestCount: 3,
        roomTypeId,
      }),
    ).resolves.toEqual([]);
  });

  it('rejects invalid availability date range', async () => {
    const service = new RoomAvailabilityService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      propertiesService,
    );

    await expect(
      service.getAvailableRooms(propertyId, {
        arrivalDate: '2026-07-04',
        departureDate: '2026-07-04',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an empty activity feed', async () => {
    const service = new ActivityFeedService(asRepository(activityRepository), propertiesService);

    await expect(service.getActivityFeed(propertyId, {})).resolves.toEqual([]);
  });

  it('returns an empty attention list', async () => {
    roomsRepository.find?.mockResolvedValue([]);
    reservationsRepository.find?.mockResolvedValue([]);
    const service = new NeedsAttentionService(
      asRepository(reservationsRepository),
      asRepository(roomsRepository),
      propertiesService,
    );

    await expect(service.getNeedsAttention(propertyId)).resolves.toEqual([]);
  });
});
