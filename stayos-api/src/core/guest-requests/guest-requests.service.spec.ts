import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { EmployeeDepartment } from '../employees/domain/employee-department.enum';
import { EmployeeStatus } from '../employees/domain/employee-status.enum';
import { EmployeeEntity } from '../employees/infrastructure/employee.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { GuestRequestDepartment } from './domain/guest-request-department.enum';
import { GuestRequestPriority } from './domain/guest-request-priority.enum';
import { GuestRequestStatus } from './domain/guest-request-status.enum';
import { GuestRequestsService } from './guest-requests.service';
import { GuestRequestEntity } from './infrastructure/guest-request.entity';
import { GuestRequestNoteEntity } from './infrastructure/guest-request-note.entity';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;
const asRepository = <T extends object>(repository: MockRepository<T>): Repository<T> =>
  repository as unknown as Repository<T>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const otherPropertyId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';
const requestId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const guestId = '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673';
const roomId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674';
const reservationId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';
const employeeId = 'a075c8fa-f36e-4f40-a3ef-2e9dbb1f0676';

const requestEntity = (overrides: Partial<GuestRequestEntity> = {}): GuestRequestEntity => ({
  id: requestId,
  propertyId,
  property: undefined as never,
  reservationId,
  reservation: { id: reservationId, reservationCode: 'RSV-001' } as ReservationEntity,
  guestId,
  guest: { id: guestId, displayName: 'Ananya Rao' } as GuestEntity,
  roomId,
  room: { id: roomId, roomNumber: '402' } as RoomEntity,
  assignedEmployeeId: employeeId,
  assignedEmployee: { id: employeeId, displayName: 'Anita' } as EmployeeEntity,
  title: 'Extra Towels',
  description: null,
  status: GuestRequestStatus.REQUESTED,
  priority: GuestRequestPriority.NORMAL,
  department: GuestRequestDepartment.HOUSEKEEPING,
  dueAt: new Date(Date.now() + 10 * 60_000),
  acceptedAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: new Date('2026-07-30T09:00:00.000Z'),
  updatedAt: new Date('2026-07-30T09:00:00.000Z'),
  notes: [],
  ...overrides,
});

describe('GuestRequestsService', () => {
  let service: GuestRequestsService;
  let requestsRepository: MockRepository<GuestRequestEntity>;
  let notesRepository: MockRepository<GuestRequestNoteEntity>;
  let reservationsRepository: MockRepository<ReservationEntity>;
  let guestsRepository: MockRepository<GuestEntity>;
  let roomsRepository: MockRepository<RoomEntity>;
  let employeesRepository: MockRepository<EmployeeEntity>;
  let activityRepository: MockRepository<ActivityEventEntity>;

  beforeEach(() => {
    requestsRepository = {
      create: jest.fn((entity) => entity),
      find: jest.fn().mockResolvedValue([requestEntity()]),
      findOne: jest.fn().mockResolvedValue(requestEntity()),
      save: jest.fn().mockImplementation(async (entity) => ({ ...requestEntity(), ...entity })),
    };
    notesRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    reservationsRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: reservationId,
        propertyId,
        guestId,
        roomId,
        status: ReservationStatus.CHECKED_IN,
      }),
    };
    guestsRepository = { findOne: jest.fn().mockResolvedValue({ id: guestId, propertyId }) };
    roomsRepository = { findOne: jest.fn().mockResolvedValue({ id: roomId, propertyId }) };
    employeesRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: employeeId,
        propertyId,
        department: EmployeeDepartment.HOUSEKEEPING,
        status: EmployeeStatus.ACTIVE,
        staffAccessEnabled: true,
      }),
    };
    activityRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    service = new GuestRequestsService(
      asRepository(requestsRepository),
      asRepository(notesRepository),
      asRepository(reservationsRepository),
      asRepository(guestsRepository),
      asRepository(roomsRepository),
      asRepository(employeesRepository),
      asRepository(activityRepository),
    );
  });

  it('creates a request with server-owned assignment', async () => {
    await expect(service.create(propertyId, { title: 'Laundry Pickup', reservationId })).resolves.toMatchObject({
      title: 'Extra Towels',
      guestDisplayName: 'Ananya Rao',
    });
    expect(requestsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      department: GuestRequestDepartment.LAUNDRY,
      guestId,
      roomId,
    }));
  });

  it('supports public-area requests without reservation', async () => {
    await service.create(propertyId, { title: 'Flowers' });
    expect(requestsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      reservationId: null,
      guestId: null,
      roomId: null,
      department: GuestRequestDepartment.CONCIERGE,
    }));
  });

  it('rejects reservation from another property', async () => {
    reservationsRepository.findOne?.mockResolvedValue(null);
    await expect(service.create(otherPropertyId, { title: 'Extra Towels', reservationId })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('filters list by status and department', async () => {
    await service.findAll(propertyId, {
      status: GuestRequestStatus.REQUESTED,
      department: GuestRequestDepartment.HOUSEKEEPING,
    });
    expect(requestsRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        propertyId,
        status: GuestRequestStatus.REQUESTED,
        department: GuestRequestDepartment.HOUSEKEEPING,
      }),
    }));
  });

  it('computes summary counts and overdue', async () => {
    requestsRepository.find?.mockResolvedValue([
      requestEntity({ status: GuestRequestStatus.REQUESTED, dueAt: new Date(Date.now() - 60_000) }),
      requestEntity({ status: GuestRequestStatus.ACCEPTED, priority: GuestRequestPriority.HIGH }),
      requestEntity({ status: GuestRequestStatus.IN_PROGRESS, priority: GuestRequestPriority.VIP }),
      requestEntity({ status: GuestRequestStatus.COMPLETED, completedAt: new Date() }),
    ]);
    await expect(service.getSummary(propertyId)).resolves.toMatchObject({
      active: 3,
      awaitingAction: 1,
      completedToday: 1,
      highPriority: 1,
      vip: 1,
      overdue: 1,
    });
  });

  it('marks requested request as accepted', async () => {
    await service.transition(propertyId, requestId, 'accept');
    expect(requestsRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: GuestRequestStatus.ACCEPTED,
      acceptedAt: expect.any(Date),
    }));
  });

  it('marks accepted request as in progress', async () => {
    requestsRepository.findOne?.mockResolvedValue(requestEntity({ status: GuestRequestStatus.ACCEPTED }));
    await service.transition(propertyId, requestId, 'start');
    expect(requestsRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: GuestRequestStatus.IN_PROGRESS,
      startedAt: expect.any(Date),
    }));
  });

  it('marks in-progress request as completed', async () => {
    requestsRepository.findOne?.mockResolvedValue(requestEntity({ status: GuestRequestStatus.IN_PROGRESS }));
    await service.transition(propertyId, requestId, 'complete');
    expect(requestsRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: GuestRequestStatus.COMPLETED,
      completedAt: expect.any(Date),
    }));
  });

  it('cancels active request', async () => {
    await service.transition(propertyId, requestId, 'cancel');
    expect(requestsRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      status: GuestRequestStatus.CANCELLED,
      cancelledAt: expect.any(Date),
    }));
  });

  it('rejects invalid transition', async () => {
    await expect(service.transition(propertyId, requestId, 'start')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds notes', async () => {
    await service.addNote(propertyId, requestId, { body: 'Guest called again.' }, employeeId);
    expect(notesRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      requestId,
      actorId: employeeId,
      body: 'Guest called again.',
    }));
  });

  it('returns delayed as computed field', async () => {
    requestsRepository.findOne?.mockResolvedValue(requestEntity({ dueAt: new Date(Date.now() - 60_000) }));
    await expect(service.findOne(propertyId, requestId)).resolves.toMatchObject({ overdue: true });
  });
});
