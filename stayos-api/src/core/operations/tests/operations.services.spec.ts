import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';
import { FolioPaymentMethod } from '../../billing/domain/folio-payment-method.enum';
import { PropertiesService } from '../../properties/properties.service';
import { ReservationPaymentStatus } from '../../reservations/domain/reservation-payment-status.enum';
import { ReservationSource } from '../../reservations/domain/reservation-source.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../../reservations/infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../../rooms/domain/room-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { GroupBookingRoomAssignmentEntity } from '../infrastructure/group-booking-room-assignment.entity';
import { GroupBookingRoomBlockEntity } from '../infrastructure/group-booking-room-block.entity';
import { GroupBookingEntity } from '../infrastructure/group-booking.entity';
import { GroupMasterFolioEntity } from '../infrastructure/group-master-folio.entity';
import { GroupStayEntity } from '../infrastructure/group-stay.entity';
import { GroupBookingService } from '../services/group-booking.service';
import { ActivityFeedService } from '../services/activity-feed.service';
import { GroupRoomMixService } from '../services/group-room-mix.service';
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
  let groupBlocksRepository: MockRepository<GroupBookingRoomBlockEntity>;
  let groupAssignmentsRepository: MockRepository<GroupBookingRoomAssignmentEntity>;
  let groupMasterFoliosRepository: MockRepository<GroupMasterFolioEntity>;
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
    groupBlocksRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    groupAssignmentsRepository = { find: jest.fn().mockResolvedValue([]) };
    groupMasterFoliosRepository = { find: jest.fn().mockResolvedValue([]) };
    activityRepository = { find: jest.fn().mockResolvedValue([]) };
    auditRepository = { find: jest.fn().mockResolvedValue([]) };
    propertiesService.findOne.mockResolvedValue({ id: propertyId } as never);
  });

  it('returns room board data', async () => {
    reservationsRepository.find?.mockResolvedValue([reservation()]);
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    reservationsRepository.createQueryBuilder?.mockReturnValue(queryBuilder);
    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      asRepository(groupMasterFoliosRepository),
      propertiesService,
    );

    await expect(service.getRoomBoard(propertyId)).resolves.toHaveLength(1);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('reservation.arrivalDate <= :today', {
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('reservation.departureDate > :today', {
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('drops group context for rooms whose group has already checked out', async () => {
    reservationsRepository.find?.mockResolvedValue([]);
    groupAssignmentsRepository.find = jest.fn().mockResolvedValue([
      {
        roomId,
        room: { propertyId },
        groupBooking: {
          id: 'group-booking-id',
          groupCode: 'GRP-00001',
          groupName: 'Hillston Family',
          status: 'CHECKED_OUT',
        },
      },
    ]);
    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      asRepository(groupMasterFoliosRepository),
      propertiesService,
    );

    const result = await service.getRoomBoard(propertyId);

    expect(result[0].groupContext).toBeNull();
  });

  it('propagates property not found', async () => {
    propertiesService.findOne.mockRejectedValue(new NotFoundException());
    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      asRepository(groupMasterFoliosRepository),
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
      asRepository(groupAssignmentsRepository),
      asRepository(groupMasterFoliosRepository),
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

  it('returns a structured master folio detail for a checked-in group', async () => {
    const groupBookingsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'group-booking-id',
        arrivalDate: '2026-07-01',
        departureDate: '2026-07-03',
        depositRequired: '300',
        estimatedTotal: '2400',
        groupCode: 'GRP-00001',
        groupName: 'Hillston Family',
      }),
    };
    const groupStaysRepository = { findOne: jest.fn().mockResolvedValue({ status: 'IN_HOUSE' }) };
    const groupMasterFoliosRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'folio-id',
        folioNumber: 'GFO-00001',
        currency: 'INR',
        status: 'OPEN',
        estimatedTotal: '2400',
      }),
    };
    const roomBlocksRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'block-1',
          rooms: 2,
          roomTypeId: roomTypeId,
          roomType: { name: 'Deluxe' },
          estimatedTotal: '1800',
        },
      ]),
    };
    const roomAssignmentsRepository = {
      find: jest
        .fn()
        .mockResolvedValue([
          { roomId: roomId, room: { roomNumber: '204', roomTypeId, roomType: { name: 'Deluxe' } } },
        ]),
    };

    const service = new GroupBookingService(
      groupBookingsRepository as never,
      roomBlocksRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      roomAssignmentsRepository as never,
      groupStaysRepository as never,
      groupMasterFoliosRepository as never,
      {} as never,
      propertiesService as never,
      {} as never,
    );

    await expect(
      service.getGroupMasterFolioDetail(propertyId, 'group-booking-id'),
    ).resolves.toMatchObject({
      folioNumber: 'GFO-00001',
      checkoutSummary: {
        balanceDue: 2100,
        occupiedRoomCount: 1,
        checkoutEligible: true,
        checkoutBlockers: [],
      },
    });
    expect(groupMasterFoliosRepository.findOne).toHaveBeenCalled();
  });

  it('posts a new charge to a group master folio', async () => {
    const groupBookingsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'group-booking-id',
        arrivalDate: '2026-07-01',
        departureDate: '2026-07-03',
        depositRequired: '300',
        estimatedTotal: '2400',
        groupCode: 'GRP-00001',
        groupName: 'Hillston Family',
        status: 'CHECKED_IN',
      }),
    };
    const groupMasterFoliosRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'folio-id',
        folioNumber: 'GFO-00001',
        currency: 'INR',
        status: 'OPEN',
        estimatedTotal: '2400',
        charges: [],
        payments: [],
      }),
      save: jest.fn().mockImplementation(async (folio) => folio),
    };

    const service = new GroupBookingService(
      groupBookingsRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { findOne: jest.fn().mockResolvedValue({}) } as never,
      groupMasterFoliosRepository as never,
      {} as never,
      propertiesService as never,
      {} as never,
    );

    const result = await service.postGroupMasterFolioCharge(propertyId, 'group-booking-id', {
      amount: 175,
      label: 'Mini bar',
      quantity: 1,
      type: FolioChargeType.MINIBAR,
    });

    expect(result.charges).toHaveLength(1);
    expect(result.charges[0]).toMatchObject({ label: 'Mini bar', amount: 175 });
    expect(groupMasterFoliosRepository.save).toHaveBeenCalled();
  });

  it('records a payment against a group master folio', async () => {
    const groupBookingsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'group-booking-id',
        arrivalDate: '2026-07-01',
        departureDate: '2026-07-03',
        depositRequired: '300',
        estimatedTotal: '2400',
        groupCode: 'GRP-00001',
        groupName: 'Hillston Family',
        status: 'CHECKED_IN',
      }),
    };
    const groupMasterFoliosRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'folio-id',
        folioNumber: 'GFO-00001',
        currency: 'INR',
        status: 'OPEN',
        estimatedTotal: '2400',
        charges: [],
        payments: [],
      }),
      save: jest.fn().mockImplementation(async (folio) => folio),
    };

    const service = new GroupBookingService(
      groupBookingsRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { findOne: jest.fn().mockResolvedValue({}) } as never,
      groupMasterFoliosRepository as never,
      {} as never,
      propertiesService as never,
      {} as never,
    );

    const result = await service.postGroupMasterFolioPayment(propertyId, 'group-booking-id', {
      amount: 500,
      method: FolioPaymentMethod.CARD,
      reference: 'TXN-001',
    });

    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]).toMatchObject({ amount: 500, method: FolioPaymentMethod.CARD });
    expect(groupMasterFoliosRepository.save).toHaveBeenCalled();
  });

  it('finalizes checkout for a settled group folio', async () => {
    const group = {
      id: 'group-booking-id',
      arrivalDate: '2026-07-01',
      departureDate: '2026-07-03',
      depositRequired: '0',
      estimatedTotal: '2400',
      groupCode: 'GRP-00001',
      groupName: 'Hillston Family',
      status: 'CHECKED_IN',
      save: jest.fn().mockResolvedValue({}),
    };
    const groupBookingsRepository = {
      findOne: jest.fn().mockResolvedValue(group),
      save: jest.fn().mockResolvedValue(group),
    };
    const groupMasterFoliosRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'folio-id',
        folioNumber: 'GFO-00001',
        currency: 'INR',
        status: 'OPEN',
        estimatedTotal: '2400',
        charges: [],
        payments: [{ amount: 2400, method: 'CARD', receivedAt: '2026-07-03T00:00:00.000Z' }],
      }),
      save: jest.fn().mockImplementation(async (folio) => folio),
    };
    const roomAssignmentsRepository = {
      find: jest.fn().mockResolvedValue([{ roomId: roomId, room: { roomNumber: '204' } }]),
    };
    const groupStaysRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'stay-id', status: 'IN_HOUSE' }),
      save: jest.fn().mockResolvedValue({ id: 'stay-id', status: 'CHECKED_OUT' }),
    };

    const service = new GroupBookingService(
      groupBookingsRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      { update: jest.fn().mockResolvedValue({}) } as never,
      {} as never,
      {} as never,
      roomAssignmentsRepository as never,
      groupStaysRepository as never,
      groupMasterFoliosRepository as never,
      {
        transaction: jest.fn().mockImplementation(async (callback) =>
          callback({
            getRepository: (entity: unknown) => {
              if (entity === GroupBookingEntity) return groupBookingsRepository;
              if (entity === GroupStayEntity) return groupStaysRepository;
              if (entity === GroupMasterFolioEntity) return groupMasterFoliosRepository;
              if (entity === RoomEntity) return { update: jest.fn().mockResolvedValue({}) };
              return {};
            },
          }),
        ),
      } as never,
      propertiesService as never,
      {} as never,
    );

    const result = await service.completeGroupCheckout(propertyId, 'group-booking-id');

    expect(result.status).toBe('SETTLED');
    expect(groupBookingsRepository.save).toHaveBeenCalled();
    expect(groupStaysRepository.save).toHaveBeenCalled();
  });

  it('suggests a feasible room mix for a family group', async () => {
    roomsRepository.find?.mockResolvedValue([
      room({ id: 'room-1', roomNumber: '301' }),
      room({ id: 'room-2', roomNumber: '302' }),
      room({
        id: 'room-3',
        roomNumber: '309',
        roomTypeId: 'suite-id',
        roomType: {
          code: 'STE',
          id: 'suite-id',
          maxAdults: 2,
          maxChildren: 2,
          maxOccupancy: 4,
          name: 'Suite',
        } as never,
      }),
    ]);
    reservationsRepository.find?.mockResolvedValue([]);
    const service = new GroupRoomMixService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupBlocksRepository),
      propertiesService,
    );

    const suggestion = await service.suggestRoomMix(propertyId, {
      adults: 4,
      arrivalDate: '2026-08-03',
      children: 4,
      departureDate: '2026-08-05',
    });

    expect(suggestion.options[0]).toMatchObject({
      adultCapacity: 6,
      childCapacity: 4,
      spareCapacity: 2,
      totalRooms: 3,
    });
    expect(suggestion.channelManagerSyncReady).toBe(true);
  });

  it('returns a warning when no group room mix can fit the request', async () => {
    reservationsRepository.find?.mockResolvedValue([]);
    const service = new GroupRoomMixService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupBlocksRepository),
      propertiesService,
    );

    const suggestion = await service.suggestRoomMix(propertyId, {
      adults: 20,
      arrivalDate: '2026-08-03',
      children: 10,
      departureDate: '2026-08-05',
    });

    expect(suggestion.options).toEqual([]);
    expect(suggestion.warnings).toContain(
      'No feasible room mix can fit this group with current room capacity rules.',
    );
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
