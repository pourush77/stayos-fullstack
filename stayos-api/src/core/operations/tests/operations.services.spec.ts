import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
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
import { GroupBookingStatus } from '../domain/group-booking-status.enum';
import { GroupRoomMixPreference } from '../dto/operations.dto';
import { GroupBookingRoomAssignmentEntity } from '../infrastructure/group-booking-room-assignment.entity';
import { GroupBookingRoomBlockEntity } from '../infrastructure/group-booking-room-block.entity';
import { GroupBookingEntity } from '../infrastructure/group-booking.entity';
import { GroupMasterFolioEntity } from '../infrastructure/group-master-folio.entity';
import { GroupStayEntity } from '../infrastructure/group-stay.entity';
import { GroupBookingService } from '../services/group-booking.service';
import { ActivityFeedService } from '../services/activity-feed.service';
import { AssignableReservationsService } from '../services/assignable-reservations.service';
import { GroupRoomMixService } from '../services/group-room-mix.service';
import { NeedsAttentionService } from '../services/needs-attention.service';
import { RoomAvailabilityService } from '../services/room-availability.service';
import { RoomBoardService } from '../services/room-board.service';
import { RoomDetailsService } from '../services/room-details.service';
import { todayIsoDate } from '../services/operations-query.helpers';

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
  inventoryReserved: true,
  ratePlanId: null,
  rateSnapshot: null,
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

const dateKey = (offsetDays = 0) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return todayIsoDate('UTC', value);
};

const createGroupRoomMixService = (
  roomsRepository: MockRepository<RoomEntity>,
  reservationsRepository: MockRepository<ReservationEntity>,
  groupBlocksRepository: MockRepository<GroupBookingRoomBlockEntity>,
  propertiesService: PropertiesService,
) =>
  new GroupRoomMixService(
    asRepository(roomsRepository),
    asRepository(reservationsRepository),
    asRepository(groupBlocksRepository),
    asRepository({ findOne: jest.fn().mockResolvedValue(null) }),
    asRepository({ find: jest.fn().mockResolvedValue([]) }),
    asRepository({ find: jest.fn().mockResolvedValue([]) }),
    propertiesService,
    {
      calculateForProperty: jest.fn(async (_propertyId: string, taxableAmount: number) => ({
        taxableSubtotal: taxableAmount.toFixed(2),
        taxAmount: '0.00',
        total: taxableAmount.toFixed(2),
        taxName: null,
        taxPercentage: '0.00',
        taxEnabled: false,
      })),
    } as never,
    {
      computeTax: jest.fn(async () => ({
        applied: false,
        hsnSac: null,
        placeOfSupply: 'INTRA_STATE',
        totalRate: '0.00',
        totalTax: '0.00',
        totalTaxCents: 0,
        components: [],
        taxRuleId: null,
        ruleEffectiveFrom: null,
        taxableValue: '0.00',
      })),
    } as never,
    { resolveGroupDepositInput: jest.fn().mockResolvedValue({ type: 'NONE', value: 0 }) } as never,
  );

const assignableReservation = (overrides: Partial<ReservationEntity> = {}) =>
  reservation({
    arrivalDate: dateKey(),
    departureDate: dateKey(2),
    guest: { displayName: 'Daniel Lee', firstName: 'Daniel', lastName: 'Lee' } as never,
    room: undefined as never,
    roomId: null,
    roomType: {
      code: 'DLX',
      name: 'Deluxe',
      maxOccupancy: 3,
      maxAdults: 2,
      maxChildren: 1,
    } as never,
    status: ReservationStatus.CONFIRMED,
    ...overrides,
  });

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
      count: jest.fn().mockResolvedValue(0),
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
    groupAssignmentsRepository = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };
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

  it('surfaces active group context when an individual stay also claims the room', async () => {
    const activeStay = reservation({
      status: ReservationStatus.CHECKED_IN,
      roomId,
      guest: { displayName: 'E2E Individual Guest' } as never,
    });

    reservationsRepository.find?.mockResolvedValueOnce([activeStay]);
    groupAssignmentsRepository.find = jest.fn().mockResolvedValue([
      {
        roomId,
        room: { propertyId },
        groupBooking: {
          id: 'group-booking-id',
          groupCode: 'GRP-00001',
          groupName: 'Old Group',
          status: 'CHECKED_IN',
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

    expect(result[0]).toMatchObject({
      groupContext: {
        groupCode: 'GRP-00001',
      },
      currentStay: {
        guestName: 'E2E Individual Guest',
        status: ReservationStatus.CHECKED_IN,
      },
      primaryAction: 'View Details',
      attentionLevel: 'CRITICAL',
    });
  });

  it('shows checked-in due-out rooms as occupied even when stored room status is ready', async () => {
    reservationsRepository.find?.mockResolvedValue([
      reservation({
        departureDate: dateKey(),
        status: ReservationStatus.CHECKED_IN,
      }),
    ]);
    reservationsRepository.createQueryBuilder?.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      asRepository(groupMasterFoliosRepository),
      propertiesService,
    );

    const result = await service.getRoomBoard(propertyId);

    expect(result[0]).toMatchObject({
      uiStatus: 'OCCUPIED',
      operationalStatus: RoomOperationalStatus.OCCUPIED,
      currentStay: {
        status: ReservationStatus.CHECKED_IN,
      },
      checkoutLabel: expect.stringMatching(/^Checkout (Today|Tomorrow)$/),
      primaryAction: 'Open Stay',
    });
  });

  it('keeps overdue checked-in stay attached to room board as currentStay with OCCUPIED status and Open Stay action', async () => {
    reservationsRepository.find?.mockResolvedValue([
      reservation({
        arrivalDate: dateKey(-3),
        departureDate: dateKey(-1),
        status: ReservationStatus.CHECKED_IN,
      }),
    ]);
    reservationsRepository.createQueryBuilder?.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      asRepository(groupMasterFoliosRepository),
      propertiesService,
    );

    const result = await service.getRoomBoard(propertyId);

    expect(result[0]).toMatchObject({
      uiStatus: 'OCCUPIED',
      operationalStatus: RoomOperationalStatus.OCCUPIED,
      currentStay: {
        guestName: 'Rahul Sharma',
        status: ReservationStatus.CHECKED_IN,
      },
      checkoutLabel: 'Overdue Checkout',
      primaryAction: 'Open Stay',
      attentionLevel: 'CRITICAL',
    });
  });

  it('keeps confirmed arrivals reserved without making the room occupied', async () => {
    reservationsRepository.find?.mockResolvedValue([]);
    reservationsRepository.createQueryBuilder?.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        reservation({
          arrivalDate: dateKey(),
          departureDate: dateKey(1),
          status: ReservationStatus.CONFIRMED,
        }),
      ]),
    });
    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      asRepository(groupMasterFoliosRepository),
      propertiesService,
    );

    const result = await service.getRoomBoard(propertyId);

    expect(result[0]).toMatchObject({
      uiStatus: 'READY',
      operationalStatus: RoomOperationalStatus.READY,
      currentStay: {
        status: ReservationStatus.CONFIRMED,
      },
      primaryAction: 'Check In',
    });
  });

  it('keeps an on-hold group room allocation visible without making it occupied', async () => {
    reservationsRepository.find?.mockResolvedValue([]);
    reservationsRepository.createQueryBuilder?.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
    groupAssignmentsRepository.find = jest.fn().mockResolvedValue([
      {
        roomId,
        room: { propertyId },
        groupBooking: {
          id: 'group-booking-id',
          groupCode: 'GRP-00005',
          groupName: 'Fresh Repro Group',
          status: GroupBookingStatus.ON_HOLD,
          arrivalDate: dateKey(),
          departureDate: dateKey(1),
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

    expect(result[0]).toMatchObject({
      uiStatus: 'READY',
      operationalStatus: RoomOperationalStatus.READY,
      groupContext: {
        groupCode: 'GRP-00005',
        status: GroupBookingStatus.ON_HOLD,
      },
      currentStay: null,
      primaryAction: 'View Details',
      attentionLevel: 'NORMAL',
    });
    expect(result[0].primaryAction).not.toBe('Open Stay');
  });

  it('keeps a confirmed pre-check-in group room allocation visible without making it occupied', async () => {
    reservationsRepository.find?.mockResolvedValue([]);
    reservationsRepository.createQueryBuilder?.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
    groupAssignmentsRepository.find = jest.fn().mockResolvedValue([
      {
        roomId,
        room: { propertyId },
        groupBooking: {
          id: 'group-booking-id',
          groupCode: 'GRP-00006',
          groupName: 'Confirmed Arrival Group',
          status: GroupBookingStatus.CONFIRMED,
          arrivalDate: dateKey(),
          departureDate: dateKey(1),
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

    expect(result[0]).toMatchObject({
      uiStatus: 'READY',
      operationalStatus: RoomOperationalStatus.READY,
      groupContext: {
        groupCode: 'GRP-00006',
        status: GroupBookingStatus.CONFIRMED,
      },
      currentStay: null,
      primaryAction: 'View Details',
      attentionLevel: 'NORMAL',
    });
    expect(result[0].primaryAction).not.toBe('Open Stay');
  });

  it('does not expose normal check-in when a checked-in group also claims the arrival room', async () => {
    reservationsRepository.find?.mockResolvedValue([]);
    reservationsRepository.createQueryBuilder?.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        reservation({
          arrivalDate: dateKey(),
          departureDate: dateKey(1),
          status: ReservationStatus.CONFIRMED,
        }),
      ]),
    });
    groupAssignmentsRepository.find = jest.fn().mockResolvedValue([
      {
        roomId,
        room: { propertyId },
        groupBooking: {
          id: 'group-booking-id',
          groupCode: 'GRP-00003',
          groupName: 'Active Group',
          status: GroupBookingStatus.CHECKED_IN,
          arrivalDate: dateKey(-1),
          departureDate: dateKey(1),
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

    expect(result[0]).toMatchObject({
      uiStatus: 'UNAVAILABLE',
      groupContext: {
        groupCode: 'GRP-00003',
      },
      currentStay: {
        status: ReservationStatus.CONFIRMED,
      },
      primaryAction: 'View Details',
      attentionLevel: 'CRITICAL',
    });
  });

  it('keeps checked-in group rooms occupied on the room board', async () => {
    roomsRepository.find = jest
      .fn()
      .mockResolvedValue([room({ operationalStatus: RoomOperationalStatus.OCCUPIED })]);
    reservationsRepository.find?.mockResolvedValue([]);
    reservationsRepository.createQueryBuilder?.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
    groupAssignmentsRepository.find = jest.fn().mockResolvedValue([
      {
        roomId,
        room: { propertyId },
        groupBooking: {
          id: 'group-booking-id',
          groupCode: 'GRP-00003',
          groupName: 'Active Group',
          status: GroupBookingStatus.CHECKED_IN,
          arrivalDate: dateKey(-1),
          departureDate: dateKey(1),
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

    expect(result[0]).toMatchObject({
      uiStatus: 'OCCUPIED',
      operationalStatus: RoomOperationalStatus.OCCUPIED,
      groupContext: {
        groupCode: 'GRP-00003',
      },
      currentStay: null,
      primaryAction: 'View Details',
      attentionLevel: 'NORMAL',
    });
  });

  it('does not keep checked-out reservations occupied on the room board', async () => {
    reservationsRepository.find?.mockResolvedValue([]);
    reservationsRepository.createQueryBuilder?.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      asRepository(groupMasterFoliosRepository),
      propertiesService,
    );

    const result = await service.getRoomBoard(propertyId);

    expect(result[0]).toMatchObject({
      uiStatus: 'READY',
      currentStay: null,
      primaryAction: 'Assign Guest',
    });
  });

  it('prefers the active checked-in stay over a future confirmed assignment when both point to the same room', async () => {
    const activeStay = reservation({
      id: 'stay-id',
      reservationCode: 'HS260812-00051',
      status: ReservationStatus.CHECKED_IN,
      roomId,
      guest: { displayName: 'Sharad Gupta' } as never,
    });
    const futureAssignment = reservation({
      id: 'future-assignment-id',
      reservationCode: 'FUT-002',
      status: ReservationStatus.CONFIRMED,
      guest: { displayName: 'Future Guest' } as never,
      roomId,
    });

    reservationsRepository.find
      ?.mockResolvedValueOnce([activeStay])
      .mockResolvedValueOnce([futureAssignment]);
    reservationsRepository.createQueryBuilder?.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([futureAssignment]),
    });

    const service = new RoomBoardService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      asRepository(groupMasterFoliosRepository),
      propertiesService,
    );

    const result = await service.getRoomBoard(propertyId);

    expect(result[0].currentStay).toMatchObject({
      guestName: 'Sharad Gupta',
      status: ReservationStatus.CHECKED_IN,
      reservationCode: 'HS260812-00051',
    });
    expect(result[0].currentStay?.reservationCode).not.toBe(futureAssignment.reservationCode);
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
      asRepository(groupAssignmentsRepository),
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
      asRepository(groupAssignmentsRepository),
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

  it('excludes rooms assigned to overlapping active groups from room availability', async () => {
    const secondRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';
    roomsRepository.find?.mockResolvedValue([
      room({ id: roomId, roomNumber: '204' }),
      room({ id: secondRoomId, roomNumber: '205' }),
    ]);
    groupAssignmentsRepository.createQueryBuilder?.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ roomId }]),
    });
    const service = new RoomAvailabilityService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      propertiesService,
    );

    await expect(
      service.getAvailableRooms(propertyId, {
        arrivalDate: '2026-07-02',
        departureDate: '2026-07-04',
        roomTypeId,
      }),
    ).resolves.toMatchObject([{ roomId: secondRoomId, roomNumber: '205' }]);
  });

  it('keeps a room available when an assigned reservation starts on the requested departure date', async () => {
    reservationsRepository.find?.mockResolvedValue([]);
    const service = new RoomAvailabilityService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      propertiesService,
    );

    await expect(
      service.getAvailableRooms(propertyId, {
        arrivalDate: '2026-08-12',
        departureDate: '2026-08-14',
        roomTypeId,
      }),
    ).resolves.toMatchObject([{ roomId, roomNumber: '204' }]);
    expect(reservationsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          arrivalDate: expect.objectContaining({ _value: '2026-08-14' }),
          departureDate: expect.objectContaining({ _value: '2026-08-12' }),
        }),
      }),
    );
  });

  it('excludes a room when an assigned reservation starts before the requested departure date', async () => {
    reservationsRepository.find?.mockResolvedValue([
      reservation({
        arrivalDate: '2026-08-13',
        departureDate: '2026-08-15',
      }),
    ]);
    const service = new RoomAvailabilityService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      propertiesService,
    );

    await expect(
      service.getAvailableRooms(propertyId, {
        arrivalDate: '2026-08-12',
        departureDate: '2026-08-14',
        roomTypeId,
      }),
    ).resolves.toEqual([]);
  });

  it('excludes checked-in rooms from availability even when stored room status is ready', async () => {
    reservationsRepository.find?.mockResolvedValueOnce([]).mockResolvedValueOnce([
      reservation({
        status: ReservationStatus.CHECKED_IN,
        arrivalDate: '2026-08-13',
        departureDate: '2026-08-14',
      }),
    ]);
    const service = new RoomAvailabilityService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      propertiesService,
    );

    await expect(
      service.getAvailableRooms(propertyId, {
        arrivalDate: '2026-08-14',
        departureDate: '2026-08-15',
        roomTypeId,
      }),
    ).resolves.toEqual([]);
  });

  it('excludes non-ready rooms from room availability', async () => {
    const cleaningRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';
    const maintenanceRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0677';
    roomsRepository.find?.mockResolvedValue([
      room({ id: roomId, roomNumber: '204' }),
      room({
        id: cleaningRoomId,
        roomNumber: '205',
        operationalStatus: RoomOperationalStatus.NEEDS_CLEANING,
      }),
      room({
        id: maintenanceRoomId,
        roomNumber: '206',
        operationalStatus: RoomOperationalStatus.OUT_OF_SERVICE,
      }),
    ]);
    const service = new RoomAvailabilityService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupAssignmentsRepository),
      propertiesService,
    );

    await expect(
      service.getAvailableRooms(propertyId, {
        arrivalDate: '2026-07-02',
        departureDate: '2026-07-04',
        roomTypeId,
      }),
    ).resolves.toMatchObject([{ roomId, roomNumber: '204' }]);
  });

  it('rejects a group room change when the replacement is no longer available', async () => {
    const group = {
      id: 'group-booking-id',
      arrivalDate: '2026-07-02',
      departureDate: '2026-07-04',
      propertyId,
      status: GroupBookingStatus.CONFIRMED,
    };
    const replacementRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';
    const groupBookingsRepository = { findOne: jest.fn().mockResolvedValue(group) };
    const roomAssignmentsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'assignment-id',
        groupBookingId: group.id,
        roomId,
        roomTypeId,
      }),
      save: jest.fn(),
    };
    const roomsRepository = {
      findOne: jest.fn().mockResolvedValue(
        room({
          id: replacementRoomId,
          roomNumber: '205',
        }),
      ),
    };
    const roomAvailabilityService = { getAvailableRooms: jest.fn().mockResolvedValue([]) };
    const service = new GroupBookingService(
      groupBookingsRepository as never,
      {} as never,
      {} as never,
      roomsRepository as never,
      {} as never,
      {} as never,
      roomAssignmentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      propertiesService as never,
      {} as never,
      roomAvailabilityService as never,
    );

    await expect(
      service.changeAssignedRoom(propertyId, group.id, 'assignment-id', {
        roomId: replacementRoomId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(roomAssignmentsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a group room change to the current room', async () => {
    const group = {
      id: 'group-booking-id',
      arrivalDate: '2026-07-02',
      departureDate: '2026-07-04',
      propertyId,
      status: GroupBookingStatus.CONFIRMED,
    };
    const groupBookingsRepository = { findOne: jest.fn().mockResolvedValue(group) };
    const roomAssignmentsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'assignment-id',
        groupBookingId: group.id,
        roomId,
        roomTypeId,
      }),
      save: jest.fn(),
    };
    const service = new GroupBookingService(
      groupBookingsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      roomAssignmentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      propertiesService as never,
      {} as never,
      { getAvailableRooms: jest.fn() } as never,
    );

    await expect(
      service.changeAssignedRoom(propertyId, group.id, 'assignment-id', { roomId }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(roomAssignmentsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a group room change to another room already assigned to the same group', async () => {
    const group = {
      id: 'group-booking-id',
      arrivalDate: '2026-07-02',
      departureDate: '2026-07-04',
      propertyId,
      status: GroupBookingStatus.CONFIRMED,
    };
    const replacementRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';
    const groupBookingsRepository = { findOne: jest.fn().mockResolvedValue(group) };
    const roomAssignmentsRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'assignment-id',
          groupBookingId: group.id,
          roomId,
          roomTypeId,
        })
        .mockResolvedValueOnce({
          id: 'other-assignment-id',
          groupBookingId: group.id,
          roomId: replacementRoomId,
          roomTypeId,
        }),
      save: jest.fn(),
    };
    const roomsRepository = {
      findOne: jest.fn().mockResolvedValue(
        room({
          id: replacementRoomId,
          roomNumber: '205',
        }),
      ),
    };
    const roomAvailabilityService = {
      getAvailableRooms: jest.fn().mockResolvedValue([{ roomId: replacementRoomId }]),
    };
    const service = new GroupBookingService(
      groupBookingsRepository as never,
      {} as never,
      {} as never,
      roomsRepository as never,
      {} as never,
      {} as never,
      roomAssignmentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      propertiesService as never,
      {} as never,
      roomAvailabilityService as never,
    );

    await expect(
      service.changeAssignedRoom(propertyId, group.id, 'assignment-id', {
        roomId: replacementRoomId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(roomAssignmentsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects active group room change to a room with a confirmed arrival today', async () => {
    const replacementRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';
    const group = {
      id: 'group-booking-id',
      arrivalDate: dateKey(-2),
      departureDate: dateKey(),
      propertyId,
      status: GroupBookingStatus.CHECKED_IN,
    };
    const roomAssignmentsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'assignment-id',
        groupBookingId: group.id,
        roomId,
        roomTypeId,
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      save: jest.fn(),
    };
    const reservationsRepository = {
      findOne: jest.fn().mockResolvedValue(
        reservation({
          roomId: replacementRoomId,
          status: ReservationStatus.CONFIRMED,
          arrivalDate: dateKey(),
          departureDate: dateKey(1),
        }),
      ),
    };
    const service = new GroupBookingService(
      { findOne: jest.fn().mockResolvedValue(group) } as never,
      {} as never,
      {} as never,
      {
        findOne: jest.fn().mockResolvedValue(room({ id: replacementRoomId, roomNumber: '205' })),
      } as never,
      reservationsRepository as never,
      {} as never,
      roomAssignmentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      propertiesService as never,
      {} as never,
      { getAvailableRooms: jest.fn().mockResolvedValue([{ roomId: replacementRoomId }]) } as never,
    );

    await expect(
      service.changeAssignedRoom(propertyId, group.id, 'assignment-id', {
        roomId: replacementRoomId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(roomAssignmentsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects active group room change to a room with a checked-in stay', async () => {
    const replacementRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';
    const group = {
      id: 'group-booking-id',
      arrivalDate: dateKey(-1),
      departureDate: dateKey(1),
      propertyId,
      status: GroupBookingStatus.CHECKED_IN,
    };
    const roomAssignmentsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'assignment-id',
        groupBookingId: group.id,
        roomId,
        roomTypeId,
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      save: jest.fn(),
    };
    const reservationsRepository = {
      findOne: jest.fn().mockResolvedValue(
        reservation({
          roomId: replacementRoomId,
          status: ReservationStatus.CHECKED_IN,
        }),
      ),
    };
    const service = new GroupBookingService(
      { findOne: jest.fn().mockResolvedValue(group) } as never,
      {} as never,
      {} as never,
      {
        findOne: jest.fn().mockResolvedValue(room({ id: replacementRoomId, roomNumber: '205' })),
      } as never,
      reservationsRepository as never,
      {} as never,
      roomAssignmentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      propertiesService as never,
      {} as never,
      { getAvailableRooms: jest.fn().mockResolvedValue([{ roomId: replacementRoomId }]) } as never,
    );

    await expect(
      service.changeAssignedRoom(propertyId, group.id, 'assignment-id', {
        roomId: replacementRoomId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(roomAssignmentsRepository.save).not.toHaveBeenCalled();
  });

  it('returns only available-now candidates for an active group room change', async () => {
    const currentRoomId = roomId;
    const arrivalTodayRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0601';
    const checkedInRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0602';
    const conflictingGroupRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0603';
    const safeRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0604';
    const alreadyAssignedRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0605';
    const group = {
      id: 'group-booking-id',
      arrivalDate: dateKey(-1),
      departureDate: dateKey(1),
      propertyId,
      status: GroupBookingStatus.CHECKED_IN,
    };
    const assignment = {
      id: 'assignment-id',
      groupBookingId: group.id,
      roomId: currentRoomId,
      roomTypeId,
    };
    const roomById = new Map(
      [arrivalTodayRoomId, checkedInRoomId, conflictingGroupRoomId, safeRoomId].map((id) => [
        id,
        room({ id }),
      ]),
    );
    const groupClaimQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'other-assignment-id' })
        .mockResolvedValueOnce(null),
    };
    const roomAssignmentsRepository = {
      findOne: jest.fn().mockResolvedValue(assignment),
      find: jest
        .fn()
        .mockResolvedValue([
          assignment,
          { id: 'already-assigned-id', groupBookingId: group.id, roomId: alreadyAssignedRoomId },
        ]),
      createQueryBuilder: jest.fn().mockReturnValue(groupClaimQueryBuilder),
    };
    const reservationsRepository = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(
          reservation({ roomId: arrivalTodayRoomId, status: ReservationStatus.CONFIRMED }),
        )
        .mockResolvedValueOnce(
          reservation({ roomId: checkedInRoomId, status: ReservationStatus.CHECKED_IN }),
        )
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null),
    };
    const service = new GroupBookingService(
      { findOne: jest.fn().mockResolvedValue(group) } as never,
      {} as never,
      {} as never,
      {
        findOne: jest.fn(({ where }) => Promise.resolve(roomById.get(where.id) ?? null)),
      } as never,
      reservationsRepository as never,
      {} as never,
      roomAssignmentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      propertiesService as never,
      {} as never,
      {
        getAvailableRooms: jest.fn().mockResolvedValue([
          { roomId: currentRoomId, roomNumber: '204', roomType: { id: roomTypeId } },
          { roomId: arrivalTodayRoomId, roomNumber: '205', roomType: { id: roomTypeId } },
          { roomId: checkedInRoomId, roomNumber: '206', roomType: { id: roomTypeId } },
          { roomId: conflictingGroupRoomId, roomNumber: '207', roomType: { id: roomTypeId } },
          { roomId: safeRoomId, roomNumber: '208', roomType: { id: roomTypeId } },
          { roomId: alreadyAssignedRoomId, roomNumber: '209', roomType: { id: roomTypeId } },
        ]),
      } as never,
    );

    await expect(
      service.getRoomChangeCandidates(propertyId, group.id, assignment.id),
    ).resolves.toEqual([
      expect.objectContaining({
        roomId: safeRoomId,
      }),
    ]);
    expect(reservationsRepository.findOne).toHaveBeenCalledTimes(4);
    expect(groupClaimQueryBuilder.getOne).toHaveBeenCalledTimes(2);
  });

  it('accepts active group room change to a truly ready vacant room', async () => {
    const replacementRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';
    const sourceRoom = room({
      id: roomId,
      roomNumber: '204',
      operationalStatus: RoomOperationalStatus.OCCUPIED,
    });
    const replacementRoom = room({ id: replacementRoomId, roomNumber: '205' });
    const group = {
      id: 'group-booking-id',
      arrivalDate: dateKey(-1),
      departureDate: dateKey(1),
      propertyId,
      status: GroupBookingStatus.CHECKED_IN,
    };
    const assignment = {
      id: 'assignment-id',
      groupBookingId: group.id,
      roomId,
      roomTypeId,
      roomNumber: '204',
    };
    const roomAssignmentsRepository = {
      findOne: jest.fn().mockResolvedValueOnce(assignment).mockResolvedValueOnce(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const roomsRepository = {
      findOne: jest.fn().mockResolvedValueOnce(replacementRoom).mockResolvedValueOnce(sourceRoom),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const service = new GroupBookingService(
      { findOne: jest.fn().mockResolvedValue(group) } as never,
      {} as never,
      {} as never,
      roomsRepository as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      roomAssignmentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      propertiesService as never,
      {} as never,
      { getAvailableRooms: jest.fn().mockResolvedValue([{ roomId: replacementRoomId }]) } as never,
    );
    jest.spyOn(service, 'getHold').mockResolvedValue({
      roomAssignments: [{ id: assignment.id, roomId: replacementRoomId }],
    } as never);

    await expect(
      service.changeAssignedRoom(propertyId, group.id, assignment.id, {
        roomId: replacementRoomId,
      }),
    ).resolves.toMatchObject({
      roomAssignments: [{ roomId: replacementRoomId }],
    });
    expect(roomAssignmentsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: replacementRoomId }),
    );
    expect(roomsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: roomId,
        operationalStatus: RoomOperationalStatus.READY,
        operationalStatusReason: null,
        operationalStatusNote: null,
      }),
    );
    expect(roomsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: replacementRoomId,
        operationalStatus: RoomOperationalStatus.OCCUPIED,
        operationalStatusReason: null,
        operationalStatusNote: null,
      }),
    );
  });

  it('allows future group room change to a room with a reservation starting on group departure', async () => {
    const replacementRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';
    const group = {
      id: 'group-booking-id',
      arrivalDate: dateKey(30),
      departureDate: dateKey(32),
      propertyId,
      status: GroupBookingStatus.CONFIRMED,
    };
    const assignment = {
      id: 'assignment-id',
      groupBookingId: group.id,
      roomId,
      roomTypeId,
      roomNumber: '204',
    };
    const roomAssignmentsRepository = {
      findOne: jest.fn().mockResolvedValueOnce(assignment).mockResolvedValueOnce(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const roomsRepository = {
      findOne: jest.fn().mockResolvedValue(room({ id: replacementRoomId, roomNumber: '205' })),
      save: jest.fn(),
    };
    const service = new GroupBookingService(
      { findOne: jest.fn().mockResolvedValue(group) } as never,
      {} as never,
      {} as never,
      roomsRepository as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      roomAssignmentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      propertiesService as never,
      {} as never,
      { getAvailableRooms: jest.fn().mockResolvedValue([{ roomId: replacementRoomId }]) } as never,
    );
    jest.spyOn(service, 'getHold').mockResolvedValue({
      roomAssignments: [{ id: assignment.id, roomId: replacementRoomId }],
    } as never);

    await expect(
      service.changeAssignedRoom(propertyId, group.id, assignment.id, {
        roomId: replacementRoomId,
      }),
    ).resolves.toMatchObject({
      roomAssignments: [{ roomId: replacementRoomId }],
    });
    expect(roomsRepository.save).not.toHaveBeenCalled();
  });

  it('marks assigned rooms occupied during actual group check-in', async () => {
    const group = {
      id: 'group-booking-id',
      arrivalDate: dateKey(),
      departureDate: dateKey(1),
      estimatedTotal: '2400',
      propertyId,
      status: GroupBookingStatus.CONFIRMED,
    };
    const groupBookingsRepository = {
      findOne: jest.fn().mockResolvedValue(group),
      findOneByOrFail: jest.fn().mockResolvedValue(group),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const groupStaysRepository = {
      create: jest.fn().mockImplementation((value) => value),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({ id: 'group-stay-id' }),
    };
    const groupMasterFoliosRepository = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue({ id: 'folio-id', folioNumber: 'GFO-00001' }),
    };
    const roomRepository = { update: jest.fn().mockResolvedValue({}) };
    const dataSource = {
      transaction: jest.fn().mockImplementation(async (callback) =>
        callback({
          getRepository: (entity: unknown) => {
            if (entity === GroupBookingEntity) return groupBookingsRepository;
            if (entity === GroupStayEntity) return groupStaysRepository;
            if (entity === GroupMasterFolioEntity) return groupMasterFoliosRepository;
            if (entity === RoomEntity) return roomRepository;
            return {};
          },
        }),
      ),
    };
    const service = new GroupBookingService(
      groupBookingsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      groupStaysRepository as never,
      groupMasterFoliosRepository as never,
      dataSource as never,
      propertiesService as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'getCheckInPreview').mockResolvedValue({
      canCheckIn: true,
      blockers: [],
      group,
      rooms: [{ roomId, roomNumber: '204' }],
      warnings: [],
    } as never);
    jest.spyOn(service, 'getHold').mockResolvedValue({ id: group.id } as never);

    await expect(service.checkInGroup(propertyId, group.id)).resolves.toMatchObject({
      masterFolioNumber: 'GFO-00001',
      occupiedRooms: ['204'],
    });
    expect(groupBookingsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: GroupBookingStatus.CHECKED_IN }),
    );
    expect(roomRepository.update).toHaveBeenCalledWith(
      { id: In([roomId]), propertyId },
      { operationalStatus: RoomOperationalStatus.OCCUPIED },
    );
  });

  it('allows group check-in preview for confirmed groups with ready assigned rooms', async () => {
    const service = new GroupBookingService(
      {} as never,
      {} as never,
      {} as never,
      {
        find: jest
          .fn()
          .mockResolvedValue([
            room({ operationalStatus: RoomOperationalStatus.READY, operationalStatusNote: null }),
          ]),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      propertiesService as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'getHold').mockResolvedValue({
      adults: 2,
      arrivalDate: dateKey(),
      children: 0,
      depositRequired: 500,
      departureDate: dateKey(1),
      estimatedTotal: 2400,
      groupCode: 'GRP-00001',
      groupName: 'Ready Group',
      id: 'group-booking-id',
      leadName: 'Lead Guest',
      leadPhone: '+919999999999',
      readiness: { contactComplete: true },
      roomAssignments: [{ roomId }],
      roomBlocks: [{ rooms: 1 }],
      roomingList: [{ guestName: 'Lead Guest' }],
      status: GroupBookingStatus.CONFIRMED,
    } as never);

    await expect(service.getCheckInPreview(propertyId, 'group-booking-id')).resolves.toMatchObject({
      canCheckIn: true,
      blockers: [],
      paymentSummary: {
        depositPaid: 0,
        depositRequired: 500,
        totalPaid: 0,
      },
      previewStatus: 'PENDING',
      rooms: [
        expect.objectContaining({
          readinessStatus: 'READY',
          ready: true,
          roomNumber: '204',
        }),
      ],
    });
  });

  it('blocks group check-in preview when an assigned room is not ready', async () => {
    const service = new GroupBookingService(
      {} as never,
      {} as never,
      {} as never,
      {
        find: jest.fn().mockResolvedValue([
          room({
            operationalStatus: RoomOperationalStatus.MAINTENANCE,
            operationalStatusNote: 'AC repair open',
          }),
        ]),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      propertiesService as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'getHold').mockResolvedValue({
      adults: 2,
      arrivalDate: dateKey(),
      children: 0,
      depositRequired: 0,
      departureDate: dateKey(1),
      estimatedTotal: 2400,
      groupCode: 'GRP-00002',
      groupName: 'Blocked Group',
      id: 'group-booking-id',
      leadName: 'Lead Guest',
      leadPhone: '+919999999999',
      readiness: { contactComplete: true },
      roomAssignments: [{ roomId }],
      roomBlocks: [{ rooms: 1 }],
      roomingList: [{ guestName: 'Lead Guest' }],
      status: GroupBookingStatus.CONFIRMED,
    } as never);

    await expect(service.getCheckInPreview(propertyId, 'group-booking-id')).resolves.toMatchObject({
      canCheckIn: false,
      blockers: ['1 assigned room(s) are not ready.'],
      rooms: [
        expect.objectContaining({
          issue: 'AC repair open',
          readinessStatus: 'NOT_READY',
          ready: false,
        }),
      ],
    });
  });

  it('returns already-checked-in preview state without false blockers', async () => {
    const service = new GroupBookingService(
      {} as never,
      {} as never,
      {} as never,
      {
        find: jest
          .fn()
          .mockResolvedValue([room({ operationalStatus: RoomOperationalStatus.OCCUPIED })]),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
      propertiesService as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service, 'getHold').mockResolvedValue({
      adults: 2,
      arrivalDate: dateKey(),
      children: 0,
      depositRequired: 0,
      departureDate: dateKey(1),
      estimatedTotal: 2400,
      groupCode: 'GRP-00003',
      groupName: 'In House Group',
      id: 'group-booking-id',
      leadName: 'Lead Guest',
      leadPhone: '+919999999999',
      readiness: { contactComplete: true },
      roomAssignments: [{ roomId }],
      roomBlocks: [{ rooms: 1 }],
      roomingList: [{ guestName: 'Lead Guest' }],
      status: GroupBookingStatus.CHECKED_IN,
    } as never);

    await expect(service.getCheckInPreview(propertyId, 'group-booking-id')).resolves.toMatchObject({
      blockers: [],
      canCheckIn: false,
      previewStatus: 'ALREADY_CHECKED_IN',
      warnings: ['This group is already checked in.'],
    });
  });

  it('keeps future group room change candidates date-range based', async () => {
    const replacementRoomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';
    const group = {
      id: 'group-booking-id',
      arrivalDate: dateKey(30),
      departureDate: dateKey(32),
      propertyId,
      status: GroupBookingStatus.CONFIRMED,
    };
    const assignment = {
      id: 'assignment-id',
      groupBookingId: group.id,
      roomId,
      roomTypeId,
    };
    const roomAssignmentsRepository = {
      findOne: jest.fn().mockResolvedValue(assignment),
      find: jest.fn().mockResolvedValue([assignment]),
      createQueryBuilder: jest.fn(),
    };
    const roomAvailabilityService = {
      getAvailableRooms: jest.fn().mockResolvedValue([
        { roomId, roomNumber: '204', roomType: { id: roomTypeId } },
        { roomId: replacementRoomId, roomNumber: '205', roomType: { id: roomTypeId } },
      ]),
    };
    const service = new GroupBookingService(
      { findOne: jest.fn().mockResolvedValue(group) } as never,
      {} as never,
      {} as never,
      { findOne: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      {} as never,
      roomAssignmentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      propertiesService as never,
      {} as never,
      roomAvailabilityService as never,
    );

    await expect(
      service.getRoomChangeCandidates(propertyId, group.id, assignment.id),
    ).resolves.toEqual([
      expect.objectContaining({
        roomId: replacementRoomId,
      }),
    ]);
    expect(roomAvailabilityService.getAvailableRooms).toHaveBeenCalledWith(propertyId, {
      arrivalDate: group.arrivalDate,
      departureDate: group.departureDate,
      roomTypeId,
    });
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
      {} as never,
    );

    await expect(
      service.getGroupMasterFolioDetail(propertyId, 'group-booking-id'),
    ).resolves.toMatchObject({
      folioNumber: 'GFO-00001',
      checkoutSummary: {
        balanceDue: 2400,
        occupiedRoomCount: 1,
        checkoutEligible: true,
        checkoutBlockers: [],
        paymentStatus: 'UNPAID',
        totalCharges: 2400,
        totalPaid: 0,
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

  it('records a persisted payment against a group master folio and re-reads authoritative detail', async () => {
    const persistedPayment = {
      id: 'persisted-payment-id',
      amount: '500.00',
      method: FolioPaymentMethod.CARD,
      receivedAt: new Date('2026-07-03T12:00:00.000Z'),
      reference: 'TXN-001',
    };
    const groupBookingsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'group-booking-id',
        arrivalDate: '2026-07-01',
        departureDate: '2026-07-03',
        depositRequired: '0',
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
      }),
      update: jest.fn().mockResolvedValue({}),
    };
    const folioPaymentsRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(persistedPayment),
      find: jest.fn().mockResolvedValue([persistedPayment]),
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
      {} as never,
      folioPaymentsRepository as never,
    );

    const result = await service.postGroupMasterFolioPayment(propertyId, 'group-booking-id', {
      amount: 500,
      method: FolioPaymentMethod.CARD,
      reference: 'TXN-001',
    });

    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]).toMatchObject({
      amount: 500,
      id: 'persisted-payment-id',
      method: FolioPaymentMethod.CARD,
      reference: 'TXN-001',
      receivedAt: '2026-07-03T12:00:00.000Z',
    });
    expect(result.checkoutSummary).toMatchObject({
      balanceDue: 1900,
      paymentStatus: 'PARTIALLY_PAID',
      totalCharges: 2400,
      totalPaid: 500,
    });
    expect(folioPaymentsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '500.00',
        folioId: null,
        groupMasterFolioId: 'folio-id',
        reference: 'TXN-001',
      }),
    );
  });

  it('aggregates multiple persisted group folio payments and enables checkout after full settlement', async () => {
    const groupBookingsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'group-booking-id',
        arrivalDate: '2026-07-01',
        departureDate: '2026-07-03',
        depositRequired: '1400',
        estimatedTotal: '7000',
        groupCode: 'GRP-00005',
        groupName: 'Staging Group',
        status: 'CHECKED_IN',
      }),
    };
    const groupMasterFoliosRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'folio-id',
        folioNumber: 'GFO-00002',
        currency: 'INR',
        status: 'OPEN',
        estimatedTotal: '7000',
      }),
    };
    const folioPaymentsRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'deposit-payment-id',
          amount: '1400.00',
          method: FolioPaymentMethod.CASH,
          receivedAt: new Date('2026-08-15T05:50:00.000Z'),
          reference: 'Deposit',
        },
        {
          id: 'final-payment-id',
          amount: '5600.00',
          method: FolioPaymentMethod.CASH,
          receivedAt: new Date('2026-08-15T06:41:21.683Z'),
          reference: 'UAT-GRP-00005-FINAL',
        },
      ]),
    };
    const service = new GroupBookingService(
      groupBookingsRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { find: jest.fn().mockResolvedValue([{ roomId, room: { roomNumber: '204' } }]) } as never,
      { findOne: jest.fn().mockResolvedValue({}) } as never,
      groupMasterFoliosRepository as never,
      {} as never,
      propertiesService as never,
      {} as never,
      {} as never,
      folioPaymentsRepository as never,
    );

    await expect(
      service.getGroupMasterFolioDetail(propertyId, 'group-booking-id'),
    ).resolves.toMatchObject({
      checkoutSummary: {
        balanceDue: 0,
        checkoutEligible: true,
        paymentStatus: 'PAID',
        totalCharges: 7000,
        totalPaid: 7000,
      },
      payments: [
        expect.objectContaining({ amount: 1400, reference: 'Deposit' }),
        expect.objectContaining({ amount: 5600, reference: 'UAT-GRP-00005-FINAL' }),
      ],
    });
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
      }),
      save: jest.fn().mockImplementation(async (folio) => folio),
    };
    const folioPaymentsRepository = {
      find: jest.fn().mockResolvedValue([
        {
          amount: '2400.00',
          id: 'payment-id',
          method: 'CARD',
          receivedAt: new Date('2026-07-03T00:00:00.000Z'),
          reference: null,
        },
      ]),
    };
    const roomAssignmentsRepository = {
      find: jest.fn().mockResolvedValue([{ roomId: roomId, room: { roomNumber: '204' } }]),
    };
    const groupStaysRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'stay-id', status: 'IN_HOUSE' }),
      save: jest.fn().mockResolvedValue({ id: 'stay-id', status: 'CHECKED_OUT' }),
    };
    const roomRepository = { update: jest.fn().mockResolvedValue({}) };

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
              if (entity === RoomEntity) return roomRepository;
              return {};
            },
          }),
        ),
      } as never,
      propertiesService as never,
      {} as never,
      {} as never,
      folioPaymentsRepository as never,
    );

    const result = await service.completeGroupCheckout(propertyId, 'group-booking-id');

    expect(result.status).toBe('SETTLED');
    expect(groupBookingsRepository.save).toHaveBeenCalled();
    expect(groupStaysRepository.save).toHaveBeenCalled();
    expect(roomRepository.update).toHaveBeenCalledWith(
      { id: In([roomId]), propertyId },
      { operationalStatus: RoomOperationalStatus.NEEDS_CLEANING },
    );
  });

  it('rejects group checkout when persisted payments do not settle the balance', async () => {
    const group = {
      id: 'group-booking-id',
      arrivalDate: '2026-07-01',
      departureDate: '2026-07-03',
      depositRequired: '1400',
      estimatedTotal: '7000',
      groupCode: 'GRP-00005',
      groupName: 'Staging Group',
      status: 'CHECKED_IN',
    };
    const service = new GroupBookingService(
      { findOne: jest.fn().mockResolvedValue(group) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { find: jest.fn().mockResolvedValue([{ roomId, room: { roomNumber: '204' } }]) } as never,
      { findOne: jest.fn().mockResolvedValue({}) } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'folio-id',
          folioNumber: 'GFO-00002',
          currency: 'INR',
          status: 'OPEN',
          estimatedTotal: '7000',
        }),
      } as never,
      { transaction: jest.fn() } as never,
      propertiesService as never,
      {} as never,
      {} as never,
      {
        find: jest.fn().mockResolvedValue([
          {
            amount: '5600.00',
            id: 'payment-id',
            method: 'CASH',
            receivedAt: new Date('2026-08-15T06:41:21.683Z'),
            reference: null,
          },
        ]),
      } as never,
    );

    await expect(
      service.completeGroupCheckout(propertyId, 'group-booking-id'),
    ).rejects.toBeInstanceOf(BadRequestException);
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
    const service = createGroupRoomMixService(
      roomsRepository,
      reservationsRepository,
      groupBlocksRepository,
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

  it('returns tax-inclusive group room mix pricing from configured BAR rate + GST engine', async () => {
    roomsRepository.find?.mockResolvedValue([
      room({
        id: 'room-1',
        roomNumber: '301',
        roomTypeId: 'dlx-id',
        roomType: { id: 'dlx-id', code: 'DLX', name: 'Deluxe', maxOccupancy: 3, maxAdults: 2, maxChildren: 1 } as never,
      }),
    ]);
    reservationsRepository.find?.mockResolvedValue([]);
    const service = new GroupRoomMixService(
      asRepository(roomsRepository),
      asRepository(reservationsRepository),
      asRepository(groupBlocksRepository),
      asRepository({ findOne: jest.fn().mockResolvedValue({ id: 'bar', isDefault: true, status: 'ACTIVE' }) }),
      asRepository({ find: jest.fn().mockResolvedValue([{ roomTypeId: 'dlx-id', baseRate: '3500.00' }]) }),
      asRepository({ find: jest.fn().mockResolvedValue([]) }),
      propertiesService,
      { calculateForProperty: jest.fn() } as never,
      {
        computeTax: jest.fn(async (input: { taxableAmountCents: number }) => {
          const totalTaxCents = Math.round(input.taxableAmountCents * 0.12);
          return {
            applied: true,
            hsnSac: '996311',
            placeOfSupply: 'INTRA_STATE',
            totalRate: '12.00',
            totalTax: (totalTaxCents / 100).toFixed(2),
            totalTaxCents,
            components: [],
            taxRuleId: 'tax-1',
            ruleEffectiveFrom: null,
            taxableValue: (input.taxableAmountCents / 100).toFixed(2),
          };
        }),
      } as never,
      { resolveGroupDepositInput: jest.fn().mockResolvedValue({ type: 'NONE', value: 0 }) } as never,
    );

    const suggestion = await service.suggestRoomMix(propertyId, {
      adults: 2,
      arrivalDate: '2026-08-03',
      children: 0,
      departureDate: '2026-08-05',
    });

    expect(suggestion.options[0]).toMatchObject({
      estimatedTotal: 7840,
      pricing: {
        grandTotal: 7840,
        roomSubtotal: 7000,
        taxAmount: 840,
        taxEnabled: true,
        taxName: 'GST',
        taxPercentage: '12.00',
      },
    });
    expect(suggestion.options[0].roomBlocks[0]).toMatchObject({
      estimatedTotal: 7000,
      rooms: 1,
    });
  });

  it('bounds room mix search for 2 adults across 100+ rooms and many room types', async () => {
    roomsRepository.find?.mockResolvedValue(
      Array.from({ length: 120 }, (_, index) =>
        room({
          id: `bulk-room-${index}`,
          roomNumber: `B${String(index).padStart(3, '0')}`,
          roomTypeId: `bulk-type-${index}`,
          roomType: {
            code: `BT${index}`,
            id: `bulk-type-${index}`,
            maxAdults: 2,
            maxChildren: 1,
            maxOccupancy: 3,
            name: index % 3 === 0 ? `Suite ${index}` : `Deluxe ${index}`,
          } as never,
        }),
      ),
    );
    reservationsRepository.find?.mockResolvedValue([]);
    const service = createGroupRoomMixService(
      roomsRepository,
      reservationsRepository,
      groupBlocksRepository,
      propertiesService,
    );

    const suggestion = await service.suggestRoomMix(propertyId, {
      adults: 2,
      arrivalDate: '2026-08-03',
      children: 0,
      departureDate: '2026-08-04',
      preference: GroupRoomMixPreference.BEST_FIT,
    });

    expect(suggestion.options[0]).toMatchObject({
      totalRooms: 1,
      type: 'BEST_FIT',
    });
    expect(service.getLastSearchStateCountForTesting()).toBeLessThan(20_000);
  });

  it('keeps BEST_FIT, COMFORT, and BUDGET rankings deterministic without materializing all mixes', async () => {
    const inventory = [
      {
        count: 6,
        id: 'compact-id',
        name: 'Compact',
        maxAdults: 2,
        maxChildren: 0,
        maxOccupancy: 2,
      },
      { count: 4, id: 'deluxe-id', name: 'Deluxe', maxAdults: 2, maxChildren: 1, maxOccupancy: 3 },
      { count: 3, id: 'suite-id', name: 'Suite', maxAdults: 3, maxChildren: 2, maxOccupancy: 5 },
    ];
    roomsRepository.find?.mockResolvedValue(
      inventory.flatMap((type) =>
        Array.from({ length: type.count }, (_, index) =>
          room({
            id: `${type.id}-room-${index}`,
            roomNumber: `${type.id}-${index}`,
            roomTypeId: type.id,
            roomType: {
              code: type.id.slice(0, 3).toUpperCase(),
              id: type.id,
              maxAdults: type.maxAdults,
              maxChildren: type.maxChildren,
              maxOccupancy: type.maxOccupancy,
              name: type.name,
            } as never,
          }),
        ),
      ),
    );
    reservationsRepository.find?.mockResolvedValue([]);
    const service = createGroupRoomMixService(
      roomsRepository,
      reservationsRepository,
      groupBlocksRepository,
      propertiesService,
    );

    const suggestion = await service.suggestRoomMix(propertyId, {
      adults: 10,
      arrivalDate: '2026-08-03',
      children: 6,
      departureDate: '2026-08-05',
      preference: GroupRoomMixPreference.COMFORT,
    });

    expect(suggestion.options.map((option) => option.type)).toEqual(['COMFORT', 'BEST_FIT']);
    expect(suggestion.options.find((option) => option.type === 'BEST_FIT')).toMatchObject({
      spareCapacity: 0,
      totalRooms: 4,
    });
    expect(suggestion.options.find((option) => option.type === 'COMFORT')?.roomBlocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ roomTypeName: 'Suite', rooms: 3 })]),
    );
    expect(service.getLastSearchStateCountForTesting()).toBeLessThan(200_000);
  });

  it('scales room mix search for 50 adults and 20 children', async () => {
    roomsRepository.find?.mockResolvedValue(
      Array.from({ length: 300 }, (_, index) =>
        room({
          id: `large-room-${index}`,
          roomNumber: `L${String(index).padStart(3, '0')}`,
          roomTypeId: `large-type-${index % 24}`,
          roomType: {
            code: `LT${index % 24}`,
            id: `large-type-${index % 24}`,
            maxAdults: 3 + (index % 3),
            maxChildren: index % 2 === 0 ? 2 : 1,
            maxOccupancy: 5 + (index % 2),
            name: index % 5 === 0 ? `Suite Large ${index % 24}` : `Deluxe Large ${index % 24}`,
          } as never,
        }),
      ),
    );
    reservationsRepository.find?.mockResolvedValue([]);
    const service = createGroupRoomMixService(
      roomsRepository,
      reservationsRepository,
      groupBlocksRepository,
      propertiesService,
    );

    const suggestion = await service.suggestRoomMix(propertyId, {
      adults: 50,
      arrivalDate: '2026-08-03',
      children: 20,
      departureDate: '2026-08-06',
      preference: GroupRoomMixPreference.BUDGET,
    });

    expect(suggestion.options[0]).toMatchObject({ type: 'BUDGET' });
    expect(suggestion.options[0].adultCapacity).toBeGreaterThanOrEqual(50);
    expect(suggestion.options[0].childCapacity).toBeGreaterThanOrEqual(20);
    expect(suggestion.options[0].totalCapacity).toBeGreaterThanOrEqual(70);
    expect(service.getLastSearchStateCountForTesting()).toBeLessThanOrEqual(200_001);
  });

  it('returns a warning when no group room mix can fit the request', async () => {
    reservationsRepository.find?.mockResolvedValue([]);
    const service = createGroupRoomMixService(
      roomsRepository,
      reservationsRepository,
      groupBlocksRepository,
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
      asRepository(groupAssignmentsRepository),
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
      asRepository(groupAssignmentsRepository),
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

  it('flags departures due today with MEDIUM priority and DEPARTURE_TODAY type', async () => {
    roomsRepository.find?.mockResolvedValue([]);
    reservationsRepository.find
      ?.mockResolvedValueOnce([]) // unassignedArrivals
      .mockResolvedValueOnce([]) // vipUnassignedArrivals
      .mockResolvedValueOnce([
        reservation({
          departureDate: dateKey(),
          status: ReservationStatus.CHECKED_IN,
        }),
      ]) // checkedInDepartures
      .mockResolvedValueOnce([]); // pendingPayments

    const service = new NeedsAttentionService(
      asRepository(reservationsRepository),
      asRepository(roomsRepository),
      propertiesService,
    );

    const result = await service.getNeedsAttention(propertyId);

    expect(result).toMatchObject([
      {
        type: 'DEPARTURE_TODAY',
        title: 'Rahul Sharma',
        priority: 'MEDIUM',
        primaryAction: 'Open Stay',
        metadata: {
          guestName: 'Rahul Sharma',
          reservationCode: 'RSV-001',
        },
      },
    ]);
  });

  it('flags overdue checked-in departures with CRITICAL priority and OVERDUE_CHECKOUT type', async () => {
    roomsRepository.find?.mockResolvedValue([]);
    reservationsRepository.find
      ?.mockResolvedValueOnce([]) // unassignedArrivals
      .mockResolvedValueOnce([]) // vipUnassignedArrivals
      .mockResolvedValueOnce([
        reservation({
          departureDate: dateKey(-1),
          status: ReservationStatus.CHECKED_IN,
        }),
      ]) // checkedInDepartures
      .mockResolvedValueOnce([]); // pendingPayments

    const service = new NeedsAttentionService(
      asRepository(reservationsRepository),
      asRepository(roomsRepository),
      propertiesService,
    );

    const result = await service.getNeedsAttention(propertyId);

    expect(result).toMatchObject([
      {
        type: 'OVERDUE_CHECKOUT',
        title: 'Rahul Sharma',
        description: expect.stringContaining('overdue for checkout'),
        priority: 'CRITICAL',
        primaryAction: 'Open Stay',
        metadata: {
          guestName: 'Rahul Sharma',
          reservationCode: 'RSV-001',
        },
      },
    ]);
  });

  it('returns assignable reservations only for valid unassigned active bookings', async () => {
    reservationsRepository.find?.mockResolvedValue([assignableReservation()]);
    const service = new AssignableReservationsService(
      asRepository(reservationsRepository),
      asRepository(roomsRepository),
      propertiesService,
    );

    await expect(service.getAssignableReservations(propertyId, {})).resolves.toMatchObject([
      {
        adults: 2,
        bookedRoomTypeName: 'Deluxe',
        children: 0,
        confirmationNumber: 'RSV-001',
        guestName: 'Daniel Lee',
        totalGuestCount: 2,
      },
    ]);
  });

  it.each([
    ['past completed reservation', assignableReservation({ departureDate: dateKey(-1) })],
    ['checked-out reservation', assignableReservation({ status: ReservationStatus.CHECKED_OUT })],
    ['cancelled reservation', assignableReservation({ status: ReservationStatus.CANCELLED })],
    ['already assigned reservation', assignableReservation({ roomId })],
    ['reservation from another property', assignableReservation({ propertyId: 'other-property' })],
    [
      'reservation without valid guest information',
      assignableReservation({ guest: { displayName: '' } as never, guestId: '' }),
    ],
  ])('excludes %s from assignable reservations', async (_label, candidate) => {
    reservationsRepository.find?.mockResolvedValue([candidate]);
    const service = new AssignableReservationsService(
      asRepository(reservationsRepository),
      asRepository(roomsRepository),
      propertiesService,
    );

    await expect(service.getAssignableReservations(propertyId, {})).resolves.toEqual([]);
  });

  it('excludes incompatible room types when a room filter is supplied', async () => {
    roomsRepository.findOne?.mockResolvedValue(room({ roomTypeId: 'suite-type-id' }));
    reservationsRepository.find?.mockResolvedValue([assignableReservation()]);
    const service = new AssignableReservationsService(
      asRepository(reservationsRepository),
      asRepository(roomsRepository),
      propertiesService,
    );

    await expect(service.getAssignableReservations(propertyId, { roomId })).resolves.toEqual([]);
  });

  it('excludes reservations when the selected room capacity is insufficient', async () => {
    reservationsRepository.find?.mockResolvedValue([assignableReservation({ children: 2 })]);
    const service = new AssignableReservationsService(
      asRepository(reservationsRepository),
      asRepository(roomsRepository),
      propertiesService,
    );

    await expect(service.getAssignableReservations(propertyId, { roomId })).resolves.toEqual([]);
  });

  it('excludes reservations when the selected room is not ready for assignment', async () => {
    roomsRepository.findOne?.mockResolvedValue(
      room({ operationalStatus: RoomOperationalStatus.OCCUPIED }),
    );
    const service = new AssignableReservationsService(
      asRepository(reservationsRepository),
      asRepository(roomsRepository),
      propertiesService,
    );

    await expect(service.getAssignableReservations(propertyId, { roomId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sorts assignable reservations by today arrival, then arrival date, then guest name', async () => {
    reservationsRepository.find?.mockResolvedValue([
      assignableReservation({
        arrivalDate: dateKey(2),
        guest: { displayName: 'Zara Khan' } as never,
        id: 'upcoming-zara',
      }),
      assignableReservation({
        arrivalDate: dateKey(),
        guest: { displayName: 'Nidhi Agrawal' } as never,
        id: 'today-nidhi',
      }),
      assignableReservation({
        arrivalDate: dateKey(),
        guest: { displayName: 'Daniel Lee' } as never,
        id: 'today-daniel',
      }),
      assignableReservation({
        arrivalDate: dateKey(1),
        guest: { displayName: 'Amit Patel' } as never,
        id: 'upcoming-amit',
      }),
    ]);
    const service = new AssignableReservationsService(
      asRepository(reservationsRepository),
      asRepository(roomsRepository),
      propertiesService,
    );

    const result = await service.getAssignableReservations(propertyId, {});

    expect(result.map((item) => item.guestName)).toEqual([
      'Daniel Lee',
      'Nidhi Agrawal',
      'Amit Patel',
      'Zara Khan',
    ]);
  });
});
