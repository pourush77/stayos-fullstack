import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum';
import { EmployeeDepartment } from '../employees/domain/employee-department.enum';
import { EmployeeStatus } from '../employees/domain/employee-status.enum';
import { EmployeeEntity } from '../employees/infrastructure/employee.entity';
import { PropertiesService } from '../properties/properties.service';
import { RoomOperationalStatus } from '../rooms/domain/room-operational-status.enum';
import { RoomStatus } from '../rooms/domain/room-status.enum';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import {
  HousekeepingPrimaryAction,
  HousekeepingRoomStatus,
} from './dto/housekeeping-room-response.dto';
import { HousekeepingInspectionAction } from './dto/inspect-housekeeping-room.dto';
import { HousekeepingMaintenancePriority } from './dto/report-maintenance.dto';
import { requiredHousekeepingChecklistKeys } from './domain/housekeeping-checklist';
import { HousekeepingService } from './housekeeping.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const roomId = '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673';
const actorId = '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674';
const employeeId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';

const employeeEntity: EmployeeEntity = {
  id: employeeId,
  propertyId,
  property: undefined as never,
  employeeCode: 'HK-001',
  firstName: 'Ram',
  lastName: 'Kumar',
  displayName: 'Ram Kumar',
  department: EmployeeDepartment.HOUSEKEEPING,
  designation: 'Room Attendant',
  phone: '+919876543210',
  status: EmployeeStatus.ACTIVE,
  photoUrl: null,
  staffAccessEnabled: true,
  staffAccessToken: 'staff-token',
  createdAt: new Date('2026-07-05T08:00:00.000Z'),
  updatedAt: new Date('2026-07-05T08:00:00.000Z'),
};

const roomEntity = (
  status: RoomOperationalStatus,
  overrides: Partial<RoomEntity> = {},
): RoomEntity => ({
  id: roomId,
  propertyId,
  property: undefined as never,
  floorId: '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671',
  floor: { name: 'F2' } as never,
  roomTypeId: '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672',
  roomType: { name: 'Deluxe' } as never,
  roomNumber: '204',
  displayName: null,
  description: null,
  status: RoomStatus.ACTIVE,
  operationalStatus: status,
  operationalStatusReason: null,
  operationalStatusNote: null,
  assignedEmployeeId: employeeId,
  assignedEmployee: employeeEntity,
  startedAt: null,
  completedAt:
    status === RoomOperationalStatus.INSPECTION ? new Date('2026-07-05T09:30:00.000Z') : null,
  inspectedAt: null,
  completedOnBehalf: false,
  completedByEmployeeId: null,
  completedByUserId: null,
  inspectedByUserId: null,
  checklist: [],
  reworkReason: null,
  createdAt: new Date('2026-07-05T08:00:00.000Z'),
  updatedAt: new Date('2026-07-05T10:15:00.000Z'),
  ...overrides,
});

describe('HousekeepingService', () => {
  let service: HousekeepingService;
  let roomsRepository: MockRepository<RoomEntity>;
  let transactionRoomRepository: MockRepository<RoomEntity>;
  let activityRepository: MockRepository<ActivityEventEntity>;
  let auditRepository: MockRepository<AuditEventEntity>;
  let employeesRepository: MockRepository<EmployeeEntity>;
  let transactionEmployeeRepository: MockRepository<EmployeeEntity>;

  beforeEach(async () => {
    roomsRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    transactionRoomRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (room) => room),
    };
    activityRepository = {
      create: jest.fn().mockImplementation((input) => input),
      save: jest.fn().mockImplementation(async (input) => input),
    };
    auditRepository = {
      create: jest.fn().mockImplementation((input) => input),
      save: jest.fn().mockImplementation(async (input) => input),
    };
    employeesRepository = {
      findOne: jest.fn().mockResolvedValue(employeeEntity),
    };
    transactionEmployeeRepository = {
      findOne: jest.fn().mockResolvedValue(employeeEntity),
    };

    const dataSource = {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: (entity: unknown) => {
            if (entity === RoomEntity) return transactionRoomRepository;
            if (entity === ActivityEventEntity) return activityRepository;
            if (entity === AuditEventEntity) return auditRepository;
            if (entity === EmployeeEntity) return transactionEmployeeRepository;

            throw new Error('Unexpected repository');
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HousekeepingService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(RoomEntity), useValue: roomsRepository },
        { provide: getRepositoryToken(EmployeeEntity), useValue: employeesRepository },
        {
          provide: PropertiesService,
          useValue: { findOne: jest.fn().mockResolvedValue({ id: propertyId }) },
        },
      ],
    }).compile();

    service = module.get(HousekeepingService);
  });

  it('returns dashboard summary and room cards', async () => {
    roomsRepository.find?.mockResolvedValue([
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        assignedEmployeeId: null,
        assignedEmployee: null,
      }),
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        id: '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0676',
        roomNumber: '205',
        startedAt: new Date('2026-07-05T09:00:00.000Z'),
      }),
      roomEntity(RoomOperationalStatus.INSPECTION),
      roomEntity(RoomOperationalStatus.MAINTENANCE),
      roomEntity(RoomOperationalStatus.OUT_OF_SERVICE, {
        id: '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0677',
        roomNumber: '206',
      }),
      roomEntity(RoomOperationalStatus.READY, {
        id: '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0678',
        roomNumber: '207',
      }),
    ]);

    const dashboard = await service.getDashboard(propertyId);

    expect(dashboard.summary).toEqual({
      needsCleaning: 1,
      inProgress: 1,
      inspection: 1,
      readyToday: 1,
      maintenance: 2,
    });
    expect(dashboard.rooms).toHaveLength(6);
    expect(dashboard.summary.needsCleaning).toBe(
      dashboard.rooms.filter((room) => room.status === HousekeepingRoomStatus.NEEDS_CLEANING)
        .length,
    );
    expect(dashboard.summary.inProgress).toBe(
      dashboard.rooms.filter((room) => room.status === HousekeepingRoomStatus.CLEANING).length,
    );
    expect(dashboard.summary.inspection).toBe(
      dashboard.rooms.filter((room) => room.status === HousekeepingRoomStatus.INSPECTION).length,
    );
    expect(dashboard.summary.readyToday).toBe(
      dashboard.rooms.filter((room) => room.status === HousekeepingRoomStatus.READY).length,
    );
    expect(dashboard.summary.maintenance).toBe(
      dashboard.rooms.filter((room) =>
        [
          HousekeepingRoomStatus.MAINTENANCE,
          HousekeepingRoomStatus.OUT_OF_SERVICE,
          HousekeepingRoomStatus.OUT_OF_ORDER,
        ].includes(room.status),
      ).length,
    );
    expect(
      dashboard.summary.needsCleaning +
        dashboard.summary.inProgress +
        dashboard.summary.inspection +
        dashboard.summary.readyToday +
        dashboard.summary.maintenance,
    ).toBe(dashboard.rooms.length);
    expect(dashboard.rooms[0]).toMatchObject({
      roomId,
      roomNumber: '204',
      roomType: 'Deluxe',
      floor: 'F2',
      status: HousekeepingRoomStatus.NEEDS_CLEANING,
      assignedEmployeeId: null,
      assignedStaff: null,
      primaryAction: HousekeepingPrimaryAction.ASSIGN_STAFF,
    });
    expect(dashboard.rooms[0].status).not.toBe(HousekeepingRoomStatus.CLEANING);
    expect(dashboard.rooms[0].primaryAction).not.toBe(HousekeepingPrimaryAction.COMPLETE_CLEANING);
    expect(dashboard.rooms[1]).toMatchObject({
      status: HousekeepingRoomStatus.CLEANING,
      assignedEmployeeId: employeeId,
      assignedStaff: 'Ram Kumar',
      primaryAction: HousekeepingPrimaryAction.COMPLETE_CLEANING,
    });
    const findArgs = roomsRepository.find?.mock.calls[0][0];
    expect(findArgs.where.operationalStatus['_value']).toContain(
      RoomOperationalStatus.OCCUPIED,
    );
  });

  it('does not count occupied rooms as needs cleaning if they appear in the visible set', async () => {
    roomsRepository.find?.mockResolvedValue([
      roomEntity(RoomOperationalStatus.OCCUPIED, {
        id: '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0679',
        roomNumber: '303',
      }),
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        assignedEmployeeId: null,
        assignedEmployee: null,
      }),
    ]);

    const dashboard = await service.getDashboard(propertyId);

    expect(dashboard.rooms.map((room) => room.status)).toEqual([
      HousekeepingRoomStatus.OCCUPIED,
      HousekeepingRoomStatus.NEEDS_CLEANING,
    ]);
    expect(dashboard.summary.needsCleaning).toBe(1);
  });

  it('returns staff access employee and assigned worklist only', async () => {
    roomsRepository.find?.mockResolvedValue([
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        startedAt: new Date('2026-07-05T09:00:00.000Z'),
      }),
    ]);

    await expect(service.getStaffAccess(propertyId, 'staff-token')).resolves.toEqual({
      employee: {
        id: employeeId,
        employeeCode: 'HK-001',
        displayName: 'Ram Kumar',
        department: EmployeeDepartment.HOUSEKEEPING,
      },
      rooms: [
        {
          roomId,
          roomNumber: '204',
          roomType: 'Deluxe',
          floor: 'F2',
          status: HousekeepingRoomStatus.CLEANING,
          checklist: [],
          startedAt: new Date('2026-07-05T09:00:00.000Z'),
          completedAt: null,
          reworkReason: null,
        },
      ],
    });
    expect(roomsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedEmployeeId: employeeId }),
        relations: { floor: true, roomType: true },
      }),
    );
  });

  it('rejects invalid staff access tokens with STAFF_ACCESS_INVALID', async () => {
    employeesRepository.findOne?.mockResolvedValue(null);

    await expect(service.getStaffAccess(propertyId, 'bad-token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: ApiErrorCode.STAFF_ACCESS_INVALID }),
    });
  });

  it('rejects disabled staff access with STAFF_ACCESS_INVALID', async () => {
    employeesRepository.findOne?.mockResolvedValue({
      ...employeeEntity,
      staffAccessEnabled: false,
    });

    await expect(service.getStaffAccess(propertyId, 'staff-token')).rejects.toMatchObject({
      response: expect.objectContaining({ code: ApiErrorCode.STAFF_ACCESS_INVALID }),
    });
  });

  it('starts an assigned room from staff access', async () => {
    roomsRepository.findOne?.mockResolvedValue(roomEntity(RoomOperationalStatus.NEEDS_CLEANING));
    roomsRepository.find?.mockResolvedValue([
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        startedAt: new Date('2026-07-05T09:00:00.000Z'),
      }),
    ]);
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING),
    );

    await expect(
      service.startStaffAssignedRoom(propertyId, 'staff-token', roomId),
    ).resolves.toEqual(
      expect.objectContaining({
        employee: expect.objectContaining({ id: employeeId }),
        rooms: expect.any(Array),
      }),
    );
    expect(transactionRoomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ startedAt: expect.any(Date) }),
    );
  });

  it('completes an assigned room checklist from staff access', async () => {
    roomsRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        startedAt: new Date('2026-07-05T09:00:00.000Z'),
      }),
    );
    roomsRepository.find?.mockResolvedValue([roomEntity(RoomOperationalStatus.INSPECTION)]);
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        startedAt: new Date('2026-07-05T09:00:00.000Z'),
      }),
    );

    await expect(
      service.completeStaffAssignedRoom(propertyId, 'staff-token', roomId, {
        checklist: requiredHousekeepingChecklistKeys.map((key) => ({ key, completed: true })),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        employee: expect.objectContaining({ id: employeeId }),
        rooms: expect.any(Array),
      }),
    );
    expect(transactionRoomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        operationalStatus: RoomOperationalStatus.INSPECTION,
        completedByEmployeeId: employeeId,
      }),
    );
  });

  it('denies staff updates to unassigned rooms', async () => {
    roomsRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        assignedEmployeeId: 'a075c8fa-f36e-4f40-a3ef-2e9dbb1f0679',
      }),
    );

    await expect(
      service.startStaffAssignedRoom(propertyId, 'staff-token', roomId),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: ApiErrorCode.STAFF_ROOM_ACCESS_DENIED }),
    });
    expect(transactionRoomRepository.save).not.toHaveBeenCalled();
  });

  it('complete cleaning moves cleaning room to inspection and writes events with actor', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        startedAt: new Date('2026-07-05T09:00:00.000Z'),
      }),
    );

    await expect(service.completeCleaning(propertyId, roomId, { actorId })).resolves.toMatchObject({
      status: HousekeepingRoomStatus.INSPECTION,
    });

    expect(transactionRoomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ operationalStatus: RoomOperationalStatus.INSPECTION }),
    );
    expect(activityRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Room cleaning completed' }),
    );
    expect(auditRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId,
        action: 'HOUSEKEEPING_CLEANING_COMPLETED',
      }),
    );
  });

  it('assigns active housekeeping employee and writes events', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING),
    );

    await expect(
      service.assignEmployee(propertyId, roomId, { employeeId }, { actorId }),
    ).resolves.toMatchObject({
      assignedEmployeeId: employeeId,
      assignedStaff: 'Ram Kumar',
    });

    expect(transactionRoomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ assignedEmployeeId: employeeId }),
    );
    expect(auditRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'HOUSEKEEPING_ROOM_ASSIGNED' }),
    );
  });

  it('assign staff rejects inactive employee', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING),
    );
    transactionEmployeeRepository.findOne?.mockResolvedValue({
      ...employeeEntity,
      status: EmployeeStatus.INACTIVE,
    });

    await expect(service.assignEmployee(propertyId, roomId, { employeeId })).rejects.toMatchObject({
      response: expect.objectContaining({ code: ApiErrorCode.EMPLOYEE_INACTIVE }),
    });
  });

  it('assign staff rejects maintenance employee', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING),
    );
    transactionEmployeeRepository.findOne?.mockResolvedValue({
      ...employeeEntity,
      department: EmployeeDepartment.MAINTENANCE,
    });

    await expect(service.assignEmployee(propertyId, roomId, { employeeId })).rejects.toMatchObject({
      response: expect.objectContaining({ code: ApiErrorCode.EMPLOYEE_NOT_HOUSEKEEPING }),
    });
  });

  it('assign staff rejects missing employee', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING),
    );
    transactionEmployeeRepository.findOne?.mockResolvedValue(null);

    await expect(service.assignEmployee(propertyId, roomId, { employeeId })).rejects.toMatchObject({
      response: expect.objectContaining({ code: ApiErrorCode.EMPLOYEE_NOT_FOUND }),
    });
  });

  it('rejects incomplete checklist', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING, {
        startedAt: new Date('2026-07-05T09:00:00.000Z'),
      }),
    );

    await expect(
      service.completeCleaning(
        propertyId,
        roomId,
        {
          employeeId,
          completedOnBehalf: false,
          checklist: requiredHousekeepingChecklistKeys
            .slice(1)
            .map((key) => ({ key, completed: true })),
        },
        { actorId },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('approves inspected room and marks it ready', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.INSPECTION),
    );

    await expect(
      service.inspect(
        propertyId,
        roomId,
        { action: HousekeepingInspectionAction.APPROVE },
        { actorId },
      ),
    ).resolves.toMatchObject({
      status: HousekeepingRoomStatus.READY,
    });
  });

  it('rejects inspection and returns room to cleaning', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.INSPECTION),
    );

    await expect(
      service.inspect(
        propertyId,
        roomId,
        { action: HousekeepingInspectionAction.REJECT, reworkReason: 'Mirror streaks' },
        { actorId },
      ),
    ).resolves.toMatchObject({
      status: HousekeepingRoomStatus.NEEDS_CLEANING,
    });
    expect(transactionRoomRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ reworkReason: 'Mirror streaks' }),
    );
  });

  it('mark ready moves inspected room to ready', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.INSPECTION),
    );

    await expect(service.markReady(propertyId, roomId, { actorId })).resolves.toMatchObject({
      status: HousekeepingRoomStatus.READY,
    });
  });

  it('mark ready rejects occupied rooms', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.OCCUPIED),
    );

    await expect(service.markReady(propertyId, roomId, { actorId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('complete cleaning rejects ready rooms', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(roomEntity(RoomOperationalStatus.READY));

    await expect(service.completeCleaning(propertyId, roomId, { actorId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('report maintenance moves cleaning room to maintenance', async () => {
    transactionRoomRepository.findOne?.mockResolvedValue(
      roomEntity(RoomOperationalStatus.NEEDS_CLEANING),
    );

    await expect(
      service.reportMaintenance(
        propertyId,
        roomId,
        {
          issue: 'AC not cooling',
          priority: HousekeepingMaintenancePriority.MEDIUM,
        },
        { actorId },
      ),
    ).resolves.toMatchObject({
      status: HousekeepingRoomStatus.MAINTENANCE,
    });

    expect(auditRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HOUSEKEEPING_MAINTENANCE_REPORTED',
        metadata: expect.objectContaining({
          issue: 'AC not cooling',
          priority: HousekeepingMaintenancePriority.MEDIUM,
        }),
      }),
    );
  });
});
