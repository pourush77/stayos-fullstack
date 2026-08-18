import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from '../auth/infrastructure/user.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { MaintenanceTicketCategory } from './domain/maintenance-ticket-category.enum';
import { MaintenanceTicketPriority } from './domain/maintenance-ticket-priority.enum';
import { MaintenanceTicketStatus } from './domain/maintenance-ticket-status.enum';
import { MaintenanceTicketEntity } from './infrastructure/maintenance-ticket.entity';
import { MaintenanceService } from './maintenance.service';
import { RoomOperationalStatus } from '../rooms/domain/room-operational-status.enum';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;
const asRepository = <T extends object>(repository: MockRepository<T>): Repository<T> =>
  repository as unknown as Repository<T>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const otherPropertyId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';
const ticketId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const roomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674';
const userId = 'a075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';

const ticketEntity = (
  overrides: Partial<MaintenanceTicketEntity> = {},
): MaintenanceTicketEntity => ({
  id: ticketId,
  propertyId,
  property: undefined as never,
  roomId,
  room: { id: roomId, propertyId, roomNumber: '402' } as RoomEntity,
  reportedByUserId: userId,
  reportedBy: { id: userId, propertyId } as UserEntity,
  assignedToUserId: null,
  assignedTo: null,
  title: 'Leaking tap',
  description: null,
  category: MaintenanceTicketCategory.PLUMBING,
  priority: MaintenanceTicketPriority.NORMAL,
  status: MaintenanceTicketStatus.OPEN,
  reportedAt: new Date('2026-07-30T09:00:00.000Z'),
  resolvedAt: null,
  resolutionNote: null,
  createdAt: new Date('2026-07-30T09:00:00.000Z'),
  updatedAt: new Date('2026-07-30T09:00:00.000Z'),
  makesRoomUnavailable: false,
  ...overrides,
});

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let ticketsRepository: MockRepository<MaintenanceTicketEntity>;
  let roomsRepository: MockRepository<RoomEntity>;
  let usersRepository: MockRepository<UserEntity>;
  const roomsService = {
    returnToHousekeeping: jest.fn(),
  };

  beforeEach(() => {
    ticketsRepository = {
      create: jest.fn((entity) => entity),
      find: jest.fn().mockResolvedValue([ticketEntity()]),
      findOne: jest.fn().mockResolvedValue(ticketEntity()),
      save: jest.fn().mockImplementation(async (entity) => ({ ...ticketEntity(), ...entity })),
    };
    roomsRepository = {
      findOne: jest.fn().mockResolvedValue({ id: roomId, propertyId }),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    usersRepository = { findOne: jest.fn().mockResolvedValue({ id: userId, propertyId }) };
    roomsService.returnToHousekeeping.mockClear();
    roomsService.returnToHousekeeping.mockResolvedValue({
      id: roomId,
      propertyId,
      operationalStatus: RoomOperationalStatus.NEEDS_CLEANING,
    });

    service = new MaintenanceService(
      asRepository(ticketsRepository),
      asRepository(roomsRepository),
      asRepository(usersRepository),
      roomsService as never,
    );
  });

  it('creates an open maintenance ticket', async () => {
    await expect(
      service.create(
        propertyId,
        {
          title: 'Leaking tap',
          roomId,
          category: MaintenanceTicketCategory.PLUMBING,
        },
        userId,
      ),
    ).resolves.toMatchObject({
      title: 'Leaking tap',
      roomNumber: '402',
    });
    expect(ticketsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId,
        roomId,
        reportedByUserId: userId,
        status: MaintenanceTicketStatus.OPEN,
        priority: MaintenanceTicketPriority.NORMAL,
      }),
    );
  });

  it('rejects rooms from another property', async () => {
    roomsRepository.findOne?.mockResolvedValue(null);
    await expect(
      service.create(
        otherPropertyId,
        {
          title: 'Leaking tap',
          roomId,
          category: MaintenanceTicketCategory.PLUMBING,
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters tickets by property and status', async () => {
    await service.findAll(propertyId, { status: MaintenanceTicketStatus.OPEN });
    expect(ticketsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ propertyId, status: MaintenanceTicketStatus.OPEN }),
      }),
    );
  });

  it('computes maintenance summary counts', async () => {
    ticketsRepository.find?.mockResolvedValue([
      ticketEntity({ status: MaintenanceTicketStatus.OPEN }),
      ticketEntity({
        status: MaintenanceTicketStatus.IN_PROGRESS,
        priority: MaintenanceTicketPriority.HIGH,
      }),
      ticketEntity({ status: MaintenanceTicketStatus.RESOLVED }),
    ]);
    await expect(service.getSummary(propertyId)).resolves.toEqual({
      open: 1,
      inProgress: 1,
      resolved: 1,
      highPriority: 1,
    });
  });

  it('assigns an open ticket and starts work', async () => {
    await service.assign(propertyId, ticketId, { assignedToUserId: userId });
    expect(ticketsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedToUserId: userId,
        status: MaintenanceTicketStatus.IN_PROGRESS,
      }),
    );
  });

  it('resolves an active ticket with resolution note', async () => {
    ticketsRepository.findOne?.mockResolvedValue(
      ticketEntity({ status: MaintenanceTicketStatus.IN_PROGRESS }),
    );
    await service.resolve(propertyId, ticketId, { resolutionNote: 'Replaced fixture.' });
    expect(ticketsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MaintenanceTicketStatus.RESOLVED,
        resolvedAt: expect.any(Date),
        resolutionNote: 'Replaced fixture.',
      }),
    );
  });

  it('returns a room to housekeeping needs-cleaning after maintenance is resolved', async () => {
    roomsRepository.findOne?.mockResolvedValueOnce({
      id: roomId,
      propertyId,
      operationalStatus: RoomOperationalStatus.MAINTENANCE,
      startedAt: new Date('2026-07-30T10:00:00.000Z'),
      completedAt: new Date('2026-07-30T10:30:00.000Z'),
      inspectedAt: new Date('2026-07-30T10:45:00.000Z'),
      completedByEmployeeId: 'employee-1',
      completedByUserId: 'user-1',
      completedOnBehalf: true,
      checklist: [{ key: 'BED', completed: true }],
      reworkReason: 'old',
    });
    ticketsRepository.findOne
      ?.mockResolvedValueOnce(
        ticketEntity({ status: MaintenanceTicketStatus.IN_PROGRESS, makesRoomUnavailable: true }),
      )
      .mockResolvedValueOnce(null);

    await service.resolve(propertyId, ticketId, { resolutionNote: 'Replaced fixture.' });

    expect(roomsService.returnToHousekeeping).toHaveBeenCalledWith(
      propertyId,
      roomId,
      'Replaced fixture.',
    );
  });

  it('is idempotent: re-resolving an already-resolved ticket does not re-sync the room', async () => {
    ticketsRepository.findOne
      ?.mockResolvedValueOnce(
        ticketEntity({ status: MaintenanceTicketStatus.RESOLVED, makesRoomUnavailable: true }),
      )
      .mockResolvedValueOnce(
        ticketEntity({ status: MaintenanceTicketStatus.RESOLVED, makesRoomUnavailable: true }),
      );

    await service.resolve(propertyId, ticketId, { resolutionNote: 'again' });

    expect(roomsService.returnToHousekeeping).not.toHaveBeenCalled();
    expect(roomsRepository.save).not.toHaveBeenCalled();
  });

  it('keeps a room in maintenance while another blocking ticket remains active', async () => {
    ticketsRepository.findOne
      ?.mockResolvedValueOnce(
        ticketEntity({ status: MaintenanceTicketStatus.IN_PROGRESS, makesRoomUnavailable: true }),
      )
      .mockResolvedValueOnce(
        ticketEntity({
          id: 'active-ticket',
          status: MaintenanceTicketStatus.OPEN,
          makesRoomUnavailable: true,
          title: 'AC still down',
          description: 'Waiting on part',
        }),
      );

    await service.resolve(propertyId, ticketId, { resolutionNote: 'Replaced fixture.' });

    expect(roomsService.returnToHousekeeping).not.toHaveBeenCalled();
    expect(roomsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        operationalStatus: RoomOperationalStatus.MAINTENANCE,
        operationalStatusReason: 'AC still down',
        operationalStatusNote: 'Waiting on part',
      }),
    );
  });

  it('rejects assignment for closed tickets', async () => {
    ticketsRepository.findOne?.mockResolvedValue(
      ticketEntity({ status: MaintenanceTicketStatus.RESOLVED }),
    );
    await expect(
      service.assign(propertyId, ticketId, { assignedToUserId: userId }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancels unresolved tickets', async () => {
    await service.cancel(propertyId, ticketId);
    expect(ticketsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MaintenanceTicketStatus.CANCELLED,
      }),
    );
  });
});
