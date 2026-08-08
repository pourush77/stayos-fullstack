import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { EmployeeDepartment } from '../employees/domain/employee-department.enum';
import { EmployeeStatus } from '../employees/domain/employee-status.enum';
import { EmployeeEntity } from '../employees/infrastructure/employee.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { GuestRequestDepartment } from './domain/guest-request-department.enum';
import { GuestRequestPriority } from './domain/guest-request-priority.enum';
import { GuestRequestStatus } from './domain/guest-request-status.enum';
import { GuestRequestType } from './domain/guest-request-type.enum';
import {
  AddGuestRequestNoteDto,
  CreateGuestRequestDto,
  GuestRequestQueryDto,
  GuestRequestResponseDto,
  GuestRequestSummaryDto,
  UpdateGuestRequestDto,
} from './dto/guest-request.dto';
import { GuestRequestsMapper } from './guest-requests.mapper';
import { GuestRequestEntity } from './infrastructure/guest-request.entity';
import { GuestRequestNoteEntity } from './infrastructure/guest-request-note.entity';

const activeStatuses = [
  GuestRequestStatus.REQUESTED,
  GuestRequestStatus.ACCEPTED,
  GuestRequestStatus.IN_PROGRESS,
];

type GuestServiceDefinition = {
  type: GuestRequestType;
  title: string;
  department: GuestRequestDepartment;
};

export const guestServiceDefinitions: GuestServiceDefinition[] = [
  {
    type: GuestRequestType.EXTRA_TOWELS,
    title: 'Extra Towels',
    department: GuestRequestDepartment.HOUSEKEEPING,
  },
  {
    type: GuestRequestType.EXTRA_PILLOW,
    title: 'Extra Pillow',
    department: GuestRequestDepartment.HOUSEKEEPING,
  },
  {
    type: GuestRequestType.WATER_BOTTLES,
    title: 'Water Bottles',
    department: GuestRequestDepartment.HOUSEKEEPING,
  },
  {
    type: GuestRequestType.LAUNDRY_PICKUP,
    title: 'Laundry Pickup',
    department: GuestRequestDepartment.LAUNDRY,
  },
  {
    type: GuestRequestType.WAKE_UP_CALL,
    title: 'Wake-up Call',
    department: GuestRequestDepartment.RECEPTION,
  },
  {
    type: GuestRequestType.AIRPORT_PICKUP,
    title: 'Airport Pickup',
    department: GuestRequestDepartment.CONCIERGE,
  },
  {
    type: GuestRequestType.AIRPORT_DROP,
    title: 'Airport Drop',
    department: GuestRequestDepartment.CONCIERGE,
  },
  {
    type: GuestRequestType.TAXI,
    title: 'Taxi',
    department: GuestRequestDepartment.CONCIERGE,
  },
  {
    type: GuestRequestType.LUGGAGE_ASSISTANCE,
    title: 'Luggage Assistance',
    department: GuestRequestDepartment.CONCIERGE,
  },
  {
    type: GuestRequestType.BABY_COT,
    title: 'Baby Cot',
    department: GuestRequestDepartment.HOUSEKEEPING,
  },
  {
    type: GuestRequestType.EXTRA_BED,
    title: 'Extra Bed',
    department: GuestRequestDepartment.HOUSEKEEPING,
  },
  {
    type: GuestRequestType.HAIR_DRYER,
    title: 'Hair Dryer',
    department: GuestRequestDepartment.HOUSEKEEPING,
  },
  {
    type: GuestRequestType.IRON_BOARD,
    title: 'Iron Board',
    department: GuestRequestDepartment.HOUSEKEEPING,
  },
  {
    type: GuestRequestType.ROOM_CLEANING,
    title: 'Room Cleaning',
    department: GuestRequestDepartment.HOUSEKEEPING,
  },
  {
    type: GuestRequestType.AC_ISSUE,
    title: 'AC Problem',
    department: GuestRequestDepartment.MAINTENANCE,
  },
  {
    type: GuestRequestType.TV_ISSUE,
    title: 'TV Problem',
    department: GuestRequestDepartment.MAINTENANCE,
  },
  {
    type: GuestRequestType.WIFI_ISSUE,
    title: 'Wi-Fi Issue',
    department: GuestRequestDepartment.MAINTENANCE,
  },
  {
    type: GuestRequestType.SPECIAL_DECORATION,
    title: 'Special Decoration',
    department: GuestRequestDepartment.CONCIERGE,
  },
  {
    type: GuestRequestType.FLOWERS,
    title: 'Flowers',
    department: GuestRequestDepartment.CONCIERGE,
  },
  {
    type: GuestRequestType.CAKE,
    title: 'Cake',
    department: GuestRequestDepartment.F_AND_B,
  },
  {
    type: GuestRequestType.OTHER,
    title: 'Other',
    department: GuestRequestDepartment.RECEPTION,
  },
];

/**
 * Legacy fallback.
 *
 * Existing clients may still create guest requests using only `title`.
 * Keep this mapping temporarily so those requests continue to route correctly.
 *
 * New Guest Services UI should send `requestType`.
 */
const legacyAssignmentRules: Record<string, GuestRequestDepartment> = {
  'extra towels': GuestRequestDepartment.HOUSEKEEPING,
  'extra pillow': GuestRequestDepartment.HOUSEKEEPING,
  'water bottles': GuestRequestDepartment.HOUSEKEEPING,
  'baby cot': GuestRequestDepartment.HOUSEKEEPING,
  'extra bed': GuestRequestDepartment.HOUSEKEEPING,
  'hair dryer': GuestRequestDepartment.HOUSEKEEPING,
  'iron board': GuestRequestDepartment.HOUSEKEEPING,
  'room cleaning': GuestRequestDepartment.HOUSEKEEPING,

  'laundry pickup': GuestRequestDepartment.LAUNDRY,

  taxi: GuestRequestDepartment.CONCIERGE,
  'airport pickup': GuestRequestDepartment.CONCIERGE,
  'airport drop': GuestRequestDepartment.CONCIERGE,
  'luggage assistance': GuestRequestDepartment.CONCIERGE,
  'special decoration': GuestRequestDepartment.CONCIERGE,
  flowers: GuestRequestDepartment.CONCIERGE,

  cake: GuestRequestDepartment.F_AND_B,

  'wake-up call': GuestRequestDepartment.RECEPTION,

  'ac problem': GuestRequestDepartment.MAINTENANCE,
  'tv problem': GuestRequestDepartment.MAINTENANCE,
  'wi-fi issue': GuestRequestDepartment.MAINTENANCE,
};

const transitionTargets: Record<string, GuestRequestStatus> = {
  accept: GuestRequestStatus.ACCEPTED,
  start: GuestRequestStatus.IN_PROGRESS,
  complete: GuestRequestStatus.COMPLETED,
  cancel: GuestRequestStatus.CANCELLED,
};

const allowedFrom: Record<GuestRequestStatus, GuestRequestStatus[]> = {
  [GuestRequestStatus.REQUESTED]: [GuestRequestStatus.ACCEPTED, GuestRequestStatus.CANCELLED],
  [GuestRequestStatus.ACCEPTED]: [GuestRequestStatus.IN_PROGRESS, GuestRequestStatus.CANCELLED],
  [GuestRequestStatus.IN_PROGRESS]: [GuestRequestStatus.COMPLETED, GuestRequestStatus.CANCELLED],
  [GuestRequestStatus.COMPLETED]: [],
  [GuestRequestStatus.CANCELLED]: [],
};

@Injectable()
export class GuestRequestsService {
  constructor(
    @InjectRepository(GuestRequestEntity)
    private readonly requestsRepository: Repository<GuestRequestEntity>,
    @InjectRepository(GuestRequestNoteEntity)
    private readonly notesRepository: Repository<GuestRequestNoteEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(GuestEntity)
    private readonly guestsRepository: Repository<GuestEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(EmployeeEntity)
    private readonly employeesRepository: Repository<EmployeeEntity>,
    @InjectRepository(ActivityEventEntity)
    private readonly activityRepository: Repository<ActivityEventEntity>,
  ) {}

  async findAll(
    propertyId: string,
    query: GuestRequestQueryDto,
  ): Promise<GuestRequestResponseDto[]> {
    const where = {
      propertyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.department ? { department: query.department } : {}),
      ...(query.requestType ? { requestType: query.requestType } : {}),
      ...(query.search ? { title: ILike(`%${query.search}%`) } : {}),
    };

    const items = await this.requestsRepository.find({
      where,
      relations: ['guest', 'room', 'reservation', 'assignedEmployee'],
      order: { createdAt: 'DESC' },
    });

    return items.map((item) => GuestRequestsMapper.toResponse(item));
  }

  async getSummary(propertyId: string): Promise<GuestRequestSummaryDto> {
    const requests = await this.requestsRepository.find({
      where: { propertyId },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();

    return {
      active: requests.filter((item) => activeStatuses.includes(item.status)).length,

      awaitingAction: requests.filter((item) => item.status === GuestRequestStatus.REQUESTED)
        .length,

      completedToday: requests.filter(
        (item) =>
          item.status === GuestRequestStatus.COMPLETED &&
          item.completedAt &&
          item.completedAt >= today,
      ).length,

      highPriority: requests.filter((item) => item.priority === GuestRequestPriority.HIGH).length,

      vip: requests.filter((item) => item.priority === GuestRequestPriority.VIP).length,

      overdue: requests.filter(
        (item) => item.dueAt && item.dueAt < now && activeStatuses.includes(item.status),
      ).length,
    };
  }

  getSuggestions() {
    return guestServiceDefinitions.map((service) => ({
      type: service.type,
      title: service.title,
      department: service.department,
    }));
  }

  async findOne(propertyId: string, id: string): Promise<GuestRequestResponseDto> {
    return GuestRequestsMapper.toResponse(await this.findRequest(propertyId, id));
  }

  async create(propertyId: string, dto: CreateGuestRequestDto): Promise<GuestRequestResponseDto> {
    const reservation = dto.reservationId
      ? await this.reservationsRepository.findOne({
          where: {
            id: dto.reservationId,
            propertyId,
          },
        })
      : null;

    if (dto.reservationId && !reservation) {
      throw new NotFoundException({
        code: 'RESERVATION_NOT_FOUND',
        message: 'Reservation was not found',
      });
    }

    const guestId = dto.guestId ?? reservation?.guestId ?? null;
    const roomId = dto.roomId ?? reservation?.roomId ?? null;

    await this.ensureGuestAndRoom(propertyId, guestId, roomId);

    const department = dto.department ?? this.departmentForRequest(dto.requestType, dto.title);

    const request = await this.requestsRepository.save(
      this.requestsRepository.create({
        propertyId,

        reservationId: reservation?.id ?? dto.reservationId ?? null,

        guestId,
        roomId,

        requestType: dto.requestType ?? null,
        details: dto.details ?? null,

        title: dto.title,
        description: dto.description?.trim() || null,

        priority: dto.priority ?? GuestRequestPriority.NORMAL,

        department,

        status: GuestRequestStatus.REQUESTED,

        dueAt: dto.dueAt ? new Date(dto.dueAt) : this.defaultDueAt(department),

        assignedEmployeeId: await this.pickAssignee(propertyId, department),
      }),
    );

    await this.emitActivity(request, 'GUEST_REQUEST_CREATED', 'Guest request created');

    return this.findOne(propertyId, request.id);
  }

  async update(
    propertyId: string,
    id: string,
    dto: UpdateGuestRequestDto,
  ): Promise<GuestRequestResponseDto> {
    const request = await this.findRequest(propertyId, id, false);

    const nextRequestType = dto.requestType !== undefined ? dto.requestType : request.requestType;

    const nextTitle = dto.title !== undefined ? dto.title : request.title;

    let nextDepartment = request.department;
    let shouldReassign = false;

    /*
     * An explicit department always wins.
     */
    if (dto.department !== undefined) {
      nextDepartment = dto.department;
      shouldReassign = true;
    } else if (dto.requestType !== undefined) {
      /*
       * Changing the request type should automatically
       * route the request to the correct department.
       */
      nextDepartment = this.departmentForRequest(nextRequestType, nextTitle);

      shouldReassign = nextDepartment !== request.department;
    } else if (dto.title !== undefined && !request.requestType) {
      /*
       * Legacy requests without a requestType still
       * support title-based routing.
       */
      nextDepartment = this.departmentForRequest(null, nextTitle);

      shouldReassign = nextDepartment !== request.department;
    }

    Object.assign(request, {
      ...(dto.title !== undefined
        ? {
            title: dto.title,
          }
        : {}),

      ...(dto.requestType !== undefined
        ? {
            requestType: dto.requestType,
          }
        : {}),

      ...(dto.details !== undefined
        ? {
            details: dto.details ?? null,
          }
        : {}),

      ...(dto.description !== undefined
        ? {
            description: dto.description?.trim() || null,
          }
        : {}),

      ...(dto.priority !== undefined
        ? {
            priority: dto.priority,
          }
        : {}),

      ...(nextDepartment !== request.department || dto.department !== undefined
        ? {
            department: nextDepartment,
          }
        : {}),

      ...(shouldReassign
        ? {
            assignedEmployeeId: await this.pickAssignee(propertyId, nextDepartment),
          }
        : {}),

      ...(dto.dueAt !== undefined
        ? {
            dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          }
        : {}),
    });

    await this.requestsRepository.save(request);

    await this.emitActivity(request, 'GUEST_REQUEST_UPDATED', 'Guest request updated');

    return this.findOne(propertyId, id);
  }

  async transition(
    propertyId: string,
    id: string,
    action: keyof typeof transitionTargets,
  ): Promise<GuestRequestResponseDto> {
    const request = await this.findRequest(propertyId, id, false);

    const next = transitionTargets[action];

    if (!allowedFrom[request.status].includes(next)) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: `Cannot ${action} request from ${request.status}`,
      });
    }

    request.status = next;

    const now = new Date();

    if (next === GuestRequestStatus.ACCEPTED) {
      request.acceptedAt = now;
    }

    if (next === GuestRequestStatus.IN_PROGRESS) {
      request.startedAt = now;
    }

    if (next === GuestRequestStatus.COMPLETED) {
      request.completedAt = now;
    }

    if (next === GuestRequestStatus.CANCELLED) {
      request.cancelledAt = now;
    }

    await this.requestsRepository.save(request);

    await this.emitActivity(
      request,
      `GUEST_REQUEST_${next}`,
      `Guest request ${next.toLowerCase().replace(/_/g, ' ')}`,
    );

    return this.findOne(propertyId, id);
  }

  async addNote(
    propertyId: string,
    id: string,
    dto: AddGuestRequestNoteDto,
    actorId?: string | null,
  ): Promise<GuestRequestResponseDto> {
    const request = await this.findRequest(propertyId, id, false);

    await this.notesRepository.save(
      this.notesRepository.create({
        propertyId,
        requestId: id,
        actorId: actorId ?? null,
        body: dto.body,
      }),
    );

    await this.emitActivity(request, 'GUEST_REQUEST_NOTE_ADDED', 'Guest request note added');

    return this.findOne(propertyId, id);
  }

  private async findRequest(
    propertyId: string,
    id: string,
    relations = true,
  ): Promise<GuestRequestEntity> {
    const request = await this.requestsRepository.findOne({
      where: {
        id,
        propertyId,
      },

      relations: relations ? ['guest', 'room', 'reservation', 'assignedEmployee'] : undefined,
    });

    if (!request) {
      throw new NotFoundException({
        code: 'GUEST_REQUEST_NOT_FOUND',
        message: 'Guest request was not found',
      });
    }

    return request;
  }

  private departmentForRequest(
    requestType: GuestRequestType | null | undefined,
    title: string,
  ): GuestRequestDepartment {
    if (requestType) {
      const service = guestServiceDefinitions.find((item) => item.type === requestType);

      if (service) {
        return service.department;
      }
    }

    /*
     * Backward compatibility for existing clients that
     * still send only a title.
     */
    return legacyAssignmentRules[title.trim().toLowerCase()] ?? GuestRequestDepartment.RECEPTION;
  }

  private defaultDueAt(department: GuestRequestDepartment): Date {
    const minutes =
      department === GuestRequestDepartment.MAINTENANCE
        ? 30
        : department === GuestRequestDepartment.CONCIERGE
          ? 45
          : 20;

    return new Date(Date.now() + minutes * 60_000);
  }

  private async pickAssignee(
    propertyId: string,
    department: GuestRequestDepartment,
  ): Promise<string | null> {
    const employeeDepartment = this.employeeDepartmentFor(department);

    const employee = await this.employeesRepository.findOne({
      where: {
        propertyId,
        status: EmployeeStatus.ACTIVE,
        department: employeeDepartment,
        staffAccessEnabled: true,
      },

      order: {
        createdAt: 'ASC',
      },
    });

    return employee?.id ?? null;
  }

  private employeeDepartmentFor(department: GuestRequestDepartment): EmployeeDepartment {
    if (department === GuestRequestDepartment.HOUSEKEEPING) {
      return EmployeeDepartment.HOUSEKEEPING;
    }

    if (department === GuestRequestDepartment.MAINTENANCE) {
      return EmployeeDepartment.MAINTENANCE;
    }

    if (department === GuestRequestDepartment.LAUNDRY) {
      return EmployeeDepartment.LAUNDRY;
    }

    if (department === GuestRequestDepartment.F_AND_B) {
      return EmployeeDepartment.RESTAURANT;
    }

    return EmployeeDepartment.FRONT_DESK;
  }

  private async ensureGuestAndRoom(
    propertyId: string,
    guestId: string | null,
    roomId: string | null,
  ): Promise<void> {
    if (guestId) {
      const guest = await this.guestsRepository.findOne({
        where: {
          id: guestId,
          propertyId,
        },
      });

      if (!guest) {
        throw new NotFoundException({
          code: 'GUEST_NOT_FOUND',
          message: 'Guest was not found',
        });
      }
    }

    if (roomId) {
      const room = await this.roomsRepository.findOne({
        where: {
          id: roomId,
          propertyId,
        },
      });

      if (!room) {
        throw new NotFoundException({
          code: 'ROOM_NOT_FOUND',
          message: 'Room was not found',
        });
      }
    }
  }

  private async emitActivity(
    request: GuestRequestEntity,
    type: string,
    title: string,
  ): Promise<void> {
    await this.activityRepository.save(
      this.activityRepository.create({
        propertyId: request.propertyId,
        type,
        title,

        description: `${request.title} - ${request.department}`,

        entityType: 'GuestRequest',
        entityId: request.id,

        metadata: {
          requestId: request.id,
          requestType: request.requestType,
          status: request.status,
          department: request.department,
          priority: request.priority,
        },
      }),
    );
  }
}
