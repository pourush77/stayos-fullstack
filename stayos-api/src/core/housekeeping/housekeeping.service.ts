import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { EmployeeDepartment } from '../employees/domain/employee-department.enum';
import { EmployeeStatus } from '../employees/domain/employee-status.enum';
import { EmployeeEntity } from '../employees/infrastructure/employee.entity';
import { PropertiesService } from '../properties/properties.service';
import { RoomOperationalStatus } from '../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { HousekeepingDashboardDto } from './dto/housekeeping-dashboard.dto';
import { AssignHousekeepingRoomDto } from './dto/assign-housekeeping-room.dto';
import { CompleteCleaningDto } from './dto/complete-cleaning.dto';
import {
  HousekeepingPrimaryAction,
  HousekeepingRoomPriority,
  HousekeepingRoomResponseDto,
  HousekeepingRoomStatus,
} from './dto/housekeeping-room-response.dto';
import {
  HousekeepingInspectionAction,
  InspectHousekeepingRoomDto,
} from './dto/inspect-housekeeping-room.dto';
import { ReportMaintenanceDto } from './dto/report-maintenance.dto';
import { StaffCompleteCleaningDto } from './dto/staff-complete-cleaning.dto';
import {
  HousekeepingStaffAccessResponseDto,
  HousekeepingStaffAccessRoomDto,
} from './dto/staff-access-response.dto';
import {
  HousekeepingChecklistItem,
  requiredHousekeepingChecklistKeys,
} from './domain/housekeeping-checklist';

interface ActorContext {
  actorId?: string | null;
}

const maintenanceStatuses = [
  RoomOperationalStatus.MAINTENANCE,
  RoomOperationalStatus.OUT_OF_ORDER,
  RoomOperationalStatus.OUT_OF_SERVICE,
];

@Injectable()
export class HousekeepingService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    private readonly propertiesService: PropertiesService,
  ) {}

  async getDashboard(propertyId: string): Promise<HousekeepingDashboardDto> {
    await this.propertiesService.findOne(propertyId);

    const rooms = await this.roomsRepository.find({
      where: {
        propertyId,
        operationalStatus: In([
          RoomOperationalStatus.NEEDS_CLEANING,
          RoomOperationalStatus.INSPECTION,
          RoomOperationalStatus.READY,
          RoomOperationalStatus.OCCUPIED,
          ...maintenanceStatuses,
        ]),
      },
      relations: { floor: true, roomType: true, assignedEmployee: true },
      order: { roomNumber: 'ASC' },
    });

    const roomResponses = rooms.map((room) => this.toRoomResponse(room));

    return {
      summary: this.toDashboardSummary(roomResponses),
      rooms: roomResponses,
    };
  }

  async getStaffAccess(
    propertyId: string,
    token: string,
  ): Promise<HousekeepingStaffAccessResponseDto> {
    const employee = await this.findStaffAccessEmployee(propertyId, token);
    const rooms = await this.findStaffAssignedRooms(propertyId, employee.id);

    return this.toStaffAccessResponse(employee, rooms);
  }

  async startStaffAssignedRoom(
    propertyId: string,
    token: string,
    roomId: string,
  ): Promise<HousekeepingStaffAccessResponseDto> {
    const employee = await this.findStaffAccessEmployee(propertyId, token);
    await this.ensureStaffRoomAccess(propertyId, roomId, employee.id);
    await this.startCleaning(propertyId, roomId, { actorId: null });

    return this.getStaffAccess(propertyId, token);
  }

  async completeStaffAssignedRoom(
    propertyId: string,
    token: string,
    roomId: string,
    completeDto: StaffCompleteCleaningDto,
  ): Promise<HousekeepingStaffAccessResponseDto> {
    const employee = await this.findStaffAccessEmployee(propertyId, token);
    await this.ensureStaffRoomAccess(propertyId, roomId, employee.id);
    await this.completeCleaning(
      propertyId,
      roomId,
      {
        ...completeDto,
        employeeId: employee.id,
        completedOnBehalf: false,
      },
      { actorId: null },
    );

    return this.getStaffAccess(propertyId, token);
  }

  async assignEmployee(
    propertyId: string,
    roomId: string,
    assignDto: AssignHousekeepingRoomDto,
    actorContext: ActorContext = {},
  ): Promise<HousekeepingRoomResponseDto> {
    return this.withRoomTransition(propertyId, roomId, actorContext, async (room, repositories) => {
      const employee = await repositories.employeeRepository.findOne({
        where: { id: assignDto.employeeId, propertyId },
      });

      if (!employee) {
        throw new NotFoundException({
          code: ApiErrorCode.EMPLOYEE_NOT_FOUND,
          message: `Employee ${assignDto.employeeId} was not found for this property.`,
        });
      }

      if (employee.status !== EmployeeStatus.ACTIVE) {
        throw this.badRequest(ApiErrorCode.EMPLOYEE_INACTIVE, 'Cannot assign inactive employee.');
      }

      if (employee.department !== EmployeeDepartment.HOUSEKEEPING) {
        throw this.badRequest(
          ApiErrorCode.EMPLOYEE_NOT_HOUSEKEEPING,
          'Cannot assign employee from another department.',
        );
      }

      const previousStatus = room.operationalStatus;
      room.assignedEmployeeId = employee.id;
      room.assignedEmployee = employee;
      const updatedRoom = await repositories.roomRepository.save(room);

      await this.createEvents(repositories, {
        propertyId,
        room: updatedRoom,
        actorId: actorContext.actorId ?? null,
        action: 'HOUSEKEEPING_ROOM_ASSIGNED',
        activityType: 'HOUSEKEEPING_ROOM_ASSIGNED',
        activityTitle: 'Room assigned',
        activityDescription: `Room ${updatedRoom.roomNumber} assigned to ${employee.displayName}.`,
        previousStatus,
        newStatus: updatedRoom.operationalStatus,
        metadata: { assignedEmployeeId: employee.id, assignedEmployeeName: employee.displayName },
      });

      return updatedRoom;
    });
  }

  async startCleaning(
    propertyId: string,
    roomId: string,
    actorContext: ActorContext = {},
  ): Promise<HousekeepingRoomResponseDto> {
    return this.withRoomTransition(propertyId, roomId, actorContext, async (room, repositories) => {
      this.ensureStatus(
        room,
        [RoomOperationalStatus.NEEDS_CLEANING],
        ApiErrorCode.ROOM_NOT_READY_FOR_CLEANING,
        'This room is not in cleaning status.',
      );

      if (!room.assignedEmployeeId) {
        throw this.badRequest(
          ApiErrorCode.HOUSEKEEPING_ACTION_NOT_ALLOWED,
          'Assign an employee before starting cleaning.',
        );
      }

      const previousStatus = room.operationalStatus;
      room.startedAt = room.startedAt ?? new Date();
      room.completedAt = null;
      room.inspectedAt = null;
      room.completedByEmployeeId = null;
      room.completedByUserId = null;
      room.completedOnBehalf = false;
      room.reworkReason = null;
      const updatedRoom = await repositories.roomRepository.save(room);

      await this.createEvents(repositories, {
        propertyId,
        room: updatedRoom,
        actorId: actorContext.actorId ?? null,
        action: 'HOUSEKEEPING_CLEANING_STARTED',
        activityType: 'HOUSEKEEPING_CLEANING_STARTED',
        activityTitle: 'Room cleaning started',
        activityDescription: `${updatedRoom.assignedEmployee?.displayName ?? 'Assigned employee'} started cleaning Room ${updatedRoom.roomNumber}.`,
        previousStatus,
        newStatus: updatedRoom.operationalStatus,
        metadata: { assignedEmployeeId: updatedRoom.assignedEmployeeId },
      });

      return updatedRoom;
    });
  }

  async completeCleaning(
    propertyId: string,
    roomId: string,
    completeDtoOrActorContext: CompleteCleaningDto | ActorContext = {},
    actorContext: ActorContext = {},
  ): Promise<HousekeepingRoomResponseDto> {
    const completeDto =
      'checklist' in completeDtoOrActorContext
        ? completeDtoOrActorContext
        : ({
            employeeId: '',
            completedOnBehalf: false,
            checklist: requiredHousekeepingChecklistKeys.map((key) => ({ key, completed: true })),
          } satisfies CompleteCleaningDto);
    const resolvedActorContext =
      'checklist' in completeDtoOrActorContext ? actorContext : completeDtoOrActorContext;

    return this.withRoomTransition(propertyId, roomId, actorContext, async (room, repositories) => {
      this.ensureStatus(
        room,
        [RoomOperationalStatus.NEEDS_CLEANING],
        ApiErrorCode.ROOM_NOT_READY_FOR_CLEANING_COMPLETION,
        'This room is not in cleaning status.',
      );

      if (!room.startedAt) {
        throw this.badRequest(
          ApiErrorCode.HOUSEKEEPING_ACTION_NOT_ALLOWED,
          'Cannot complete cleaning before start.',
        );
      }

      const employeeId = completeDto.employeeId || room.assignedEmployeeId;
      if (!employeeId || employeeId !== room.assignedEmployeeId) {
        throw this.badRequest(
          ApiErrorCode.HOUSEKEEPING_ACTION_NOT_ALLOWED,
          'Only the assigned employee can complete cleaning.',
        );
      }

      const employee = await repositories.employeeRepository.findOne({
        where: { id: employeeId, propertyId },
      });

      if (!employee) {
        throw new NotFoundException({
          code: ApiErrorCode.HOUSEKEEPING_ACTION_NOT_ALLOWED,
          message: `Employee ${employeeId} was not found for this property.`,
        });
      }

      const checklist = this.validateChecklist(completeDto.checklist);
      const previousStatus = room.operationalStatus;
      room.operationalStatus = RoomOperationalStatus.INSPECTION;
      room.operationalStatusReason = null;
      room.operationalStatusNote = null;
      room.completedAt = new Date();
      room.completedByEmployeeId = employee.id;
      room.completedByUserId = resolvedActorContext.actorId ?? null;
      room.completedOnBehalf = completeDto.completedOnBehalf ?? false;
      room.checklist = checklist as unknown as Record<string, unknown>[];
      room.reworkReason = null;
      const updatedRoom = await repositories.roomRepository.save(room);

      await this.createEvents(repositories, {
        propertyId,
        room: updatedRoom,
        actorId: resolvedActorContext.actorId ?? null,
        action: 'HOUSEKEEPING_CLEANING_COMPLETED',
        activityType: 'HOUSEKEEPING_CLEANING_COMPLETED',
        activityTitle: 'Room cleaning completed',
        activityDescription: `${employee.displayName} completed cleaning Room ${updatedRoom.roomNumber}. Room sent for inspection.`,
        previousStatus,
        newStatus: updatedRoom.operationalStatus,
        metadata: {
          completedByEmployeeId: employee.id,
          completedByEmployeeName: employee.displayName,
          completedByUserId: resolvedActorContext.actorId ?? null,
          completedOnBehalf: completeDto.completedOnBehalf ?? false,
          checklist,
        },
      });

      await repositories.activityRepository.save(
        repositories.activityRepository.create({
          propertyId,
          type: 'HOUSEKEEPING_INSPECTION_REQUESTED',
          title: 'Room sent for inspection',
          description: `Room ${updatedRoom.roomNumber} sent for inspection.`,
          entityType: 'Room',
          entityId: updatedRoom.id,
          metadata: { roomId: updatedRoom.id, roomNumber: updatedRoom.roomNumber },
        }),
      );

      return updatedRoom;
    });
  }

  async inspect(
    propertyId: string,
    roomId: string,
    inspectDto: InspectHousekeepingRoomDto,
    actorContext: ActorContext = {},
  ): Promise<HousekeepingRoomResponseDto> {
    return this.withRoomTransition(propertyId, roomId, actorContext, async (room, repositories) => {
      this.ensureStatus(
        room,
        [RoomOperationalStatus.INSPECTION],
        ApiErrorCode.ROOM_NOT_READY_FOR_MARK_READY,
        'This room must be in inspection status.',
      );

      if (!room.completedAt) {
        throw this.badRequest(
          ApiErrorCode.HOUSEKEEPING_ACTION_NOT_ALLOWED,
          'Cannot inspect before cleaning is complete.',
        );
      }

      const previousStatus = room.operationalStatus;
      const approved = inspectDto.action === HousekeepingInspectionAction.APPROVE;
      room.operationalStatus = approved
        ? RoomOperationalStatus.READY
        : RoomOperationalStatus.NEEDS_CLEANING;
      room.inspectedAt = new Date();
      room.inspectedByUserId = actorContext.actorId ?? null;
      room.reworkReason = approved ? null : (inspectDto.reworkReason ?? null);
      room.operationalStatusReason = approved ? null : (inspectDto.reworkReason ?? null);
      room.operationalStatusNote = null;

      if (!approved) {
        room.startedAt = null;
        room.completedAt = null;
      }

      const updatedRoom = await repositories.roomRepository.save(room);

      await this.createEvents(repositories, {
        propertyId,
        room: updatedRoom,
        actorId: actorContext.actorId ?? null,
        action: approved ? 'HOUSEKEEPING_INSPECTION_APPROVED' : 'HOUSEKEEPING_INSPECTION_REJECTED',
        activityType: approved
          ? 'HOUSEKEEPING_INSPECTION_APPROVED'
          : 'HOUSEKEEPING_INSPECTION_REJECTED',
        activityTitle: approved ? 'Room approved' : 'Room sent back for rework',
        activityDescription: approved
          ? `Room ${updatedRoom.roomNumber} approved.`
          : `Room ${updatedRoom.roomNumber} sent back for rework.`,
        previousStatus,
        newStatus: updatedRoom.operationalStatus,
        metadata: {
          inspectionResult: inspectDto.action,
          inspectedByUserId: actorContext.actorId ?? null,
          reworkReason: inspectDto.reworkReason ?? null,
        },
      });

      return updatedRoom;
    });
  }

  async markReady(
    propertyId: string,
    roomId: string,
    actorContext: ActorContext = {},
  ): Promise<HousekeepingRoomResponseDto> {
    return this.withRoomTransition(propertyId, roomId, actorContext, async (room, repositories) => {
      if (room.operationalStatus === RoomOperationalStatus.OCCUPIED) {
        throw this.badRequest(
          ApiErrorCode.ROOM_OCCUPIED,
          'This room is occupied and cannot be marked ready.',
        );
      }

      this.ensureStatus(
        room,
        [RoomOperationalStatus.INSPECTION],
        ApiErrorCode.ROOM_NOT_READY_FOR_MARK_READY,
        'This room must be inspected before it can be marked ready.',
      );

      const previousStatus = room.operationalStatus;
      room.operationalStatus = RoomOperationalStatus.READY;
      room.operationalStatusReason = null;
      room.operationalStatusNote = null;
      room.inspectedAt = new Date();
      room.inspectedByUserId = actorContext.actorId ?? null;
      const updatedRoom = await repositories.roomRepository.save(room);

      await this.createEvents(repositories, {
        propertyId,
        room: updatedRoom,
        actorId: actorContext.actorId ?? null,
        action: 'HOUSEKEEPING_MARKED_READY',
        activityType: 'HOUSEKEEPING_MARKED_READY',
        activityTitle: 'Room marked ready',
        activityDescription: `Room ${updatedRoom.roomNumber} marked ready.`,
        previousStatus,
        newStatus: updatedRoom.operationalStatus,
      });

      return updatedRoom;
    });
  }

  async reportMaintenance(
    propertyId: string,
    roomId: string,
    reportMaintenanceDto: ReportMaintenanceDto,
    actorContext: ActorContext = {},
  ): Promise<HousekeepingRoomResponseDto> {
    return this.withRoomTransition(propertyId, roomId, actorContext, async (room, repositories) => {
      if (room.operationalStatus === RoomOperationalStatus.OCCUPIED) {
        throw this.badRequest(
          ApiErrorCode.ROOM_OCCUPIED,
          'This room is occupied and cannot be moved to maintenance from housekeeping.',
        );
      }

      this.ensureStatus(
        room,
        [
          RoomOperationalStatus.NEEDS_CLEANING,
          RoomOperationalStatus.INSPECTION,
          RoomOperationalStatus.READY,
        ],
        ApiErrorCode.HOUSEKEEPING_ACTION_NOT_ALLOWED,
        'Maintenance can only be reported from cleaning, inspection, or ready rooms.',
      );

      const previousStatus = room.operationalStatus;
      room.operationalStatus = RoomOperationalStatus.MAINTENANCE;
      room.operationalStatusReason = reportMaintenanceDto.issue;
      room.operationalStatusNote = reportMaintenanceDto.notes ?? null;
      const updatedRoom = await repositories.roomRepository.save(room);

      await this.createEvents(repositories, {
        propertyId,
        room: updatedRoom,
        actorId: actorContext.actorId ?? null,
        action: 'HOUSEKEEPING_MAINTENANCE_REPORTED',
        activityType: 'HOUSEKEEPING_MAINTENANCE_REPORTED',
        activityTitle: 'Maintenance reported from housekeeping',
        activityDescription: `Maintenance reported for Room ${updatedRoom.roomNumber}: ${reportMaintenanceDto.issue}.`,
        previousStatus,
        newStatus: updatedRoom.operationalStatus,
        metadata: {
          issue: reportMaintenanceDto.issue,
          priority: reportMaintenanceDto.priority,
          notes: reportMaintenanceDto.notes ?? null,
        },
      });

      return updatedRoom;
    });
  }

  private async withRoomTransition(
    propertyId: string,
    roomId: string,
    actorContext: ActorContext,
    transition: (
      room: RoomEntity,
      repositories: {
        roomRepository: Repository<RoomEntity>;
        activityRepository: Repository<ActivityEventEntity>;
        auditRepository: Repository<AuditEventEntity>;
        employeeRepository: Repository<EmployeeEntity>;
      },
    ) => Promise<RoomEntity>,
  ): Promise<HousekeepingRoomResponseDto> {
    await this.propertiesService.findOne(propertyId);

    const updatedRoom = await this.dataSource.transaction(async (manager) => {
      const roomRepository = manager.getRepository(RoomEntity);
      const activityRepository = manager.getRepository(ActivityEventEntity);
      const auditRepository = manager.getRepository(AuditEventEntity);
      const employeeRepository = manager.getRepository(EmployeeEntity);
      const room = await roomRepository.findOne({
        where: { id: roomId, propertyId },
        relations: { floor: true, roomType: true, assignedEmployee: true },
      });

      if (!room) {
        throw new NotFoundException({
          code: ApiErrorCode.ROOM_NOT_FOUND,
          message: `Room ${roomId} was not found`,
        });
      }

      return transition(room, {
        roomRepository,
        activityRepository,
        auditRepository,
        employeeRepository,
      });
    });

    return this.toRoomResponse(updatedRoom);
  }

  private async createEvents(
    repositories: {
      activityRepository: Repository<ActivityEventEntity>;
      auditRepository: Repository<AuditEventEntity>;
    },
    input: {
      propertyId: string;
      room: RoomEntity;
      actorId: string | null;
      action: string;
      activityType: string;
      activityTitle: string;
      activityDescription: string;
      previousStatus: RoomOperationalStatus;
      newStatus: RoomOperationalStatus;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const metadata = {
      propertyId: input.propertyId,
      roomId: input.room.id,
      roomNumber: input.room.roomNumber,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      ...(input.metadata ?? {}),
    };

    await Promise.all([
      repositories.auditRepository.save(
        repositories.auditRepository.create({
          propertyId: input.propertyId,
          actorId: input.actorId,
          entityType: 'Room',
          entityId: input.room.id,
          action: input.action,
          previousState: { operationalStatus: input.previousStatus },
          nextState: { operationalStatus: input.newStatus },
          metadata,
        }),
      ),
      repositories.activityRepository.save(
        repositories.activityRepository.create({
          propertyId: input.propertyId,
          type: input.activityType,
          title: input.activityTitle,
          description: input.activityDescription,
          entityType: 'Room',
          entityId: input.room.id,
          metadata,
        }),
      ),
    ]);
  }

  private ensureStatus(
    room: RoomEntity,
    allowedStatuses: RoomOperationalStatus[],
    code: ApiErrorCode,
    message: string,
  ): void {
    if (room.operationalStatus === RoomOperationalStatus.OCCUPIED) {
      throw this.badRequest(
        ApiErrorCode.ROOM_OCCUPIED,
        'This room is occupied and cannot be cleaned yet.',
      );
    }

    if (!allowedStatuses.includes(room.operationalStatus)) {
      throw this.badRequest(code, message);
    }
  }

  private toDashboardSummary(
    rooms: HousekeepingRoomResponseDto[],
  ): HousekeepingDashboardDto['summary'] {
    return {
      needsCleaning: rooms.filter((room) => room.status === HousekeepingRoomStatus.NEEDS_CLEANING)
        .length,
      inProgress: rooms.filter((room) => room.status === HousekeepingRoomStatus.CLEANING).length,
      inspection: rooms.filter((room) => room.status === HousekeepingRoomStatus.INSPECTION).length,
      readyToday: rooms.filter((room) => room.status === HousekeepingRoomStatus.READY).length,
      maintenance: rooms.filter((room) =>
        [
          HousekeepingRoomStatus.MAINTENANCE,
          HousekeepingRoomStatus.OUT_OF_SERVICE,
          HousekeepingRoomStatus.OUT_OF_ORDER,
        ].includes(room.status),
      ).length,
    };
  }

  private async findStaffAccessEmployee(
    propertyId: string,
    token: string,
  ): Promise<EmployeeEntity> {
    await this.propertiesService.findOne(propertyId);

    const employee = await this.employeesRepository.findOne({
      where: {
        propertyId,
        staffAccessToken: token,
      },
    });

    if (
      !employee ||
      employee.status !== EmployeeStatus.ACTIVE ||
      employee.department !== EmployeeDepartment.HOUSEKEEPING ||
      !employee.staffAccessEnabled
    ) {
      throw this.badRequest(
        ApiErrorCode.STAFF_ACCESS_INVALID,
        'Staff access link is invalid or no longer active.',
      );
    }

    return employee;
  }

  private async findStaffAssignedRooms(
    propertyId: string,
    employeeId: string,
  ): Promise<RoomEntity[]> {
    return this.roomsRepository.find({
      where: {
        propertyId,
        assignedEmployeeId: employeeId,
        operationalStatus: In([
          RoomOperationalStatus.NEEDS_CLEANING,
          RoomOperationalStatus.INSPECTION,
        ]),
      },
      relations: { floor: true, roomType: true },
      order: { roomNumber: 'ASC' },
    });
  }

  private async ensureStaffRoomAccess(
    propertyId: string,
    roomId: string,
    employeeId: string,
  ): Promise<void> {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId, propertyId },
    });

    if (!room || room.assignedEmployeeId !== employeeId) {
      throw this.badRequest(
        ApiErrorCode.STAFF_ROOM_ACCESS_DENIED,
        'This room is not assigned to this staff member.',
      );
    }
  }

  private toRoomResponse(room: RoomEntity): HousekeepingRoomResponseDto {
    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomType: room.roomType?.name ?? '',
      floor: room.floor?.name ?? '',
      status: this.toHousekeepingStatus(room),
      priority: this.toPriority(room.operationalStatus),
      assignedEmployeeId: room.assignedEmployeeId ?? null,
      assignedStaff: room.assignedEmployee?.displayName ?? null,
      lastActivityAt: room.updatedAt,
      primaryAction: this.toPrimaryAction(room),
    };
  }

  private toStaffAccessResponse(
    employee: EmployeeEntity,
    rooms: RoomEntity[],
  ): HousekeepingStaffAccessResponseDto {
    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        displayName: employee.displayName,
        department: employee.department,
      },
      rooms: rooms.map((room) => this.toStaffAccessRoom(room)),
    };
  }

  private toStaffAccessRoom(room: RoomEntity): HousekeepingStaffAccessRoomDto {
    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomType: room.roomType?.name ?? '',
      floor: room.floor?.name ?? '',
      status: this.toHousekeepingStatus(room),
      checklist: this.toChecklist(room.checklist ?? []),
      startedAt: room.startedAt ?? null,
      completedAt: room.completedAt ?? null,
      reworkReason: room.reworkReason ?? null,
    };
  }

  private toChecklist(checklist: Record<string, unknown>[]): HousekeepingChecklistItem[] {
    return checklist.map((item) => ({
      key: item.key as HousekeepingChecklistItem['key'],
      completed: Boolean(item.completed),
      completedAt: typeof item.completedAt === 'string' ? item.completedAt : null,
    }));
  }

  private toHousekeepingStatus(room: RoomEntity): HousekeepingRoomStatus {
    if (room.operationalStatus === RoomOperationalStatus.NEEDS_CLEANING) {
      return room.startedAt
        ? HousekeepingRoomStatus.CLEANING
        : HousekeepingRoomStatus.NEEDS_CLEANING;
    }

    return room.operationalStatus as unknown as HousekeepingRoomStatus;
  }

  private toPriority(status: RoomOperationalStatus): HousekeepingRoomPriority {
    if (
      [RoomOperationalStatus.OUT_OF_ORDER, RoomOperationalStatus.OUT_OF_SERVICE].includes(status)
    ) {
      return HousekeepingRoomPriority.CRITICAL;
    }

    if (status === RoomOperationalStatus.MAINTENANCE) {
      return HousekeepingRoomPriority.HIGH;
    }

    return HousekeepingRoomPriority.NORMAL;
  }

  private toPrimaryAction(room: RoomEntity): HousekeepingPrimaryAction {
    switch (room.operationalStatus) {
      case RoomOperationalStatus.NEEDS_CLEANING:
        if (room.startedAt) {
          return HousekeepingPrimaryAction.COMPLETE_CLEANING;
        }

        return room.assignedEmployeeId
          ? HousekeepingPrimaryAction.START_CLEANING
          : HousekeepingPrimaryAction.ASSIGN_STAFF;
      case RoomOperationalStatus.INSPECTION:
        return HousekeepingPrimaryAction.MARK_READY;
      case RoomOperationalStatus.READY:
      case RoomOperationalStatus.MAINTENANCE:
      case RoomOperationalStatus.OUT_OF_ORDER:
      case RoomOperationalStatus.OUT_OF_SERVICE:
      case RoomOperationalStatus.OCCUPIED:
        return HousekeepingPrimaryAction.NONE;
    }
  }

  private badRequest(code: ApiErrorCode, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }

  private validateChecklist(
    checklist: Array<{ key: string; completed: boolean }>,
  ): HousekeepingChecklistItem[] {
    const completedAt = new Date().toISOString();
    const keys = new Set(checklist.map((item) => item.key));

    if (
      checklist.length !== requiredHousekeepingChecklistKeys.length ||
      requiredHousekeepingChecklistKeys.some((key) => !keys.has(key)) ||
      checklist.some((item) => !item.completed)
    ) {
      throw this.badRequest(
        ApiErrorCode.HOUSEKEEPING_ACTION_NOT_ALLOWED,
        'Checklist must include every fixed item and all items must be completed.',
      );
    }

    return checklist.map((item) => ({
      key: item.key as HousekeepingChecklistItem['key'],
      completed: item.completed,
      completedAt,
    }));
  }
}
