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

export const requestSuggestions = [
  'Extra Towels',
  'Extra Pillow',
  'Water Bottles',
  'Laundry Pickup',
  'Wake-up Call',
  'Airport Pickup',
  'Taxi',
  'Baby Cot',
  'Extra Bed',
  'Hair Dryer',
  'Iron Board',
  'Room Cleaning',
  'AC Problem',
  'TV Problem',
  'Wi-Fi Issue',
  'Luggage Assistance',
  'Special Decoration',
  'Flowers',
  'Cake',
];

const assignmentRules: Record<string, GuestRequestDepartment> = {
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

  async findAll(propertyId: string, query: GuestRequestQueryDto): Promise<GuestRequestResponseDto[]> {
    const where = {
      propertyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.department ? { department: query.department } : {}),
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
    const requests = await this.requestsRepository.find({ where: { propertyId } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    return {
      active: requests.filter((item) => activeStatuses.includes(item.status)).length,
      awaitingAction: requests.filter((item) => item.status === GuestRequestStatus.REQUESTED).length,
      completedToday: requests.filter((item) => item.status === GuestRequestStatus.COMPLETED && item.completedAt && item.completedAt >= today).length,
      highPriority: requests.filter((item) => item.priority === GuestRequestPriority.HIGH).length,
      vip: requests.filter((item) => item.priority === GuestRequestPriority.VIP).length,
      overdue: requests.filter((item) => item.dueAt && item.dueAt < now && activeStatuses.includes(item.status)).length,
    };
  }

  getSuggestions() {
    return requestSuggestions.map((title) => ({ title, department: this.departmentFor(title) }));
  }

  async findOne(propertyId: string, id: string): Promise<GuestRequestResponseDto> {
    return GuestRequestsMapper.toResponse(await this.findRequest(propertyId, id));
  }

  async create(propertyId: string, dto: CreateGuestRequestDto): Promise<GuestRequestResponseDto> {
    const reservation = dto.reservationId
      ? await this.reservationsRepository.findOne({
          where: { id: dto.reservationId, propertyId },
        })
      : null;
    if (dto.reservationId && !reservation) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reservation was not found' });
    const guestId = dto.guestId ?? reservation?.guestId ?? null;
    const roomId = dto.roomId ?? reservation?.roomId ?? null;
    await this.ensureGuestAndRoom(propertyId, guestId, roomId);

    const department = dto.department ?? this.departmentFor(dto.title);
    const request = await this.requestsRepository.save(
      this.requestsRepository.create({
        propertyId,
        reservationId: reservation?.id ?? null,
        guestId,
        roomId,
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

  async update(propertyId: string, id: string, dto: UpdateGuestRequestDto): Promise<GuestRequestResponseDto> {
    const request = await this.findRequest(propertyId, id, false);
    Object.assign(request, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.department !== undefined ? { department: dto.department, assignedEmployeeId: await this.pickAssignee(propertyId, dto.department) } : {}),
      ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
    });
    await this.requestsRepository.save(request);
    await this.emitActivity(request, 'GUEST_REQUEST_UPDATED', 'Guest request updated');
    return this.findOne(propertyId, id);
  }

  async transition(propertyId: string, id: string, action: keyof typeof transitionTargets): Promise<GuestRequestResponseDto> {
    const request = await this.findRequest(propertyId, id, false);
    const next = transitionTargets[action];
    if (!allowedFrom[request.status].includes(next)) {
      throw new BadRequestException({ code: 'INVALID_STATE', message: `Cannot ${action} request from ${request.status}` });
    }

    request.status = next;
    const now = new Date();
    if (next === GuestRequestStatus.ACCEPTED) request.acceptedAt = now;
    if (next === GuestRequestStatus.IN_PROGRESS) request.startedAt = now;
    if (next === GuestRequestStatus.COMPLETED) request.completedAt = now;
    if (next === GuestRequestStatus.CANCELLED) request.cancelledAt = now;
    await this.requestsRepository.save(request);
    await this.emitActivity(request, `GUEST_REQUEST_${next}`, `Guest request ${next.toLowerCase().replace(/_/g, ' ')}`);
    return this.findOne(propertyId, id);
  }

  async addNote(propertyId: string, id: string, dto: AddGuestRequestNoteDto, actorId?: string | null): Promise<GuestRequestResponseDto> {
    const request = await this.findRequest(propertyId, id, false);
    await this.notesRepository.save(this.notesRepository.create({ propertyId, requestId: id, actorId: actorId ?? null, body: dto.body }));
    await this.emitActivity(request, 'GUEST_REQUEST_NOTE_ADDED', 'Guest request note added');
    return this.findOne(propertyId, id);
  }

  private async findRequest(propertyId: string, id: string, relations = true): Promise<GuestRequestEntity> {
    const request = await this.requestsRepository.findOne({
      where: { id, propertyId },
      relations: relations ? ['guest', 'room', 'reservation', 'assignedEmployee'] : undefined,
    });
    if (!request) throw new NotFoundException({ code: 'GUEST_REQUEST_NOT_FOUND', message: 'Guest request was not found' });
    return request;
  }

  private departmentFor(title: string): GuestRequestDepartment {
    return assignmentRules[title.trim().toLowerCase()] ?? GuestRequestDepartment.RECEPTION;
  }

  private defaultDueAt(department: GuestRequestDepartment): Date {
    const minutes = department === GuestRequestDepartment.MAINTENANCE ? 30 : department === GuestRequestDepartment.CONCIERGE ? 45 : 20;
    return new Date(Date.now() + minutes * 60_000);
  }

  private async pickAssignee(propertyId: string, department: GuestRequestDepartment): Promise<string | null> {
    const employeeDepartment = this.employeeDepartmentFor(department);
    const employee = await this.employeesRepository.findOne({
      where: { propertyId, status: EmployeeStatus.ACTIVE, department: employeeDepartment, staffAccessEnabled: true },
      order: { createdAt: 'ASC' },
    });
    return employee?.id ?? null;
  }

  private employeeDepartmentFor(department: GuestRequestDepartment): EmployeeDepartment {
    if (department === GuestRequestDepartment.HOUSEKEEPING) return EmployeeDepartment.HOUSEKEEPING;
    if (department === GuestRequestDepartment.MAINTENANCE) return EmployeeDepartment.MAINTENANCE;
    if (department === GuestRequestDepartment.LAUNDRY) return EmployeeDepartment.LAUNDRY;
    if (department === GuestRequestDepartment.F_AND_B) return EmployeeDepartment.RESTAURANT;
    return EmployeeDepartment.FRONT_DESK;
  }

  private async ensureGuestAndRoom(propertyId: string, guestId: string | null, roomId: string | null): Promise<void> {
    if (guestId) {
      const guest = await this.guestsRepository.findOne({ where: { id: guestId, propertyId } });
      if (!guest) throw new NotFoundException({ code: 'GUEST_NOT_FOUND', message: 'Guest was not found' });
    }
    if (roomId) {
      const room = await this.roomsRepository.findOne({ where: { id: roomId, propertyId } });
      if (!room) throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: 'Room was not found' });
    }
  }

  private async emitActivity(request: GuestRequestEntity, type: string, title: string): Promise<void> {
    await this.activityRepository.save(this.activityRepository.create({
      propertyId: request.propertyId,
      type,
      title,
      description: `${request.title} - ${request.department}`,
      entityType: 'GuestRequest',
      entityId: request.id,
      metadata: { requestId: request.id, status: request.status, department: request.department, priority: request.priority },
    }));
  }
}
