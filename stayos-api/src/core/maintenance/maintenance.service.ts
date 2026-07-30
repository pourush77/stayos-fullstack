import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserEntity } from '../auth/infrastructure/user.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { MaintenanceTicketPriority } from './domain/maintenance-ticket-priority.enum';
import { MaintenanceTicketStatus } from './domain/maintenance-ticket-status.enum';
import {
  AssignMaintenanceTicketDto,
  CreateMaintenanceTicketDto,
  MaintenanceSummaryDto,
  MaintenanceTicketQueryDto,
  MaintenanceTicketResponseDto,
  ResolveMaintenanceTicketDto,
  UpdateMaintenanceTicketDto,
} from './dto/maintenance.dto';
import { MaintenanceMapper } from './maintenance.mapper';
import { MaintenanceTicketEntity } from './infrastructure/maintenance-ticket.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceTicketEntity)
    private readonly ticketsRepository: Repository<MaintenanceTicketEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async findAll(propertyId: string, query: MaintenanceTicketQueryDto): Promise<MaintenanceTicketResponseDto[]> {
    const tickets = await this.ticketsRepository.find({
      where: { propertyId, ...(query.status ? { status: query.status } : {}) },
      relations: ['room'],
      order: { reportedAt: 'DESC' },
    });
    return tickets.map(MaintenanceMapper.toResponse);
  }

  async getSummary(propertyId: string): Promise<MaintenanceSummaryDto> {
    const tickets = await this.ticketsRepository.find({ where: { propertyId } });
    return {
      open: tickets.filter((ticket) => ticket.status === MaintenanceTicketStatus.OPEN).length,
      inProgress: tickets.filter((ticket) => ticket.status === MaintenanceTicketStatus.IN_PROGRESS).length,
      resolved: tickets.filter((ticket) => ticket.status === MaintenanceTicketStatus.RESOLVED).length,
      highPriority: tickets.filter((ticket) => ticket.priority === MaintenanceTicketPriority.HIGH).length,
    };
  }

  async create(propertyId: string, dto: CreateMaintenanceTicketDto, reportedByUserId: string): Promise<MaintenanceTicketResponseDto> {
    await this.ensureRoom(propertyId, dto.roomId ?? null);
    await this.ensureUser(propertyId, reportedByUserId);
    const ticket = await this.ticketsRepository.save(this.ticketsRepository.create({
      propertyId,
      roomId: dto.roomId ?? null,
      reportedByUserId,
      assignedToUserId: null,
      title: dto.title,
      description: dto.description?.trim() || null,
      category: dto.category,
      priority: dto.priority ?? MaintenanceTicketPriority.NORMAL,
      status: MaintenanceTicketStatus.OPEN,
      reportedAt: new Date(),
      resolvedAt: null,
      resolutionNote: null,
    }));
    return this.findOne(propertyId, ticket.id);
  }

  async findOne(propertyId: string, ticketId: string): Promise<MaintenanceTicketResponseDto> {
    return MaintenanceMapper.toResponse(await this.findTicket(propertyId, ticketId));
  }

  async update(propertyId: string, ticketId: string, dto: UpdateMaintenanceTicketDto): Promise<MaintenanceTicketResponseDto> {
    const ticket = await this.findTicket(propertyId, ticketId, false);
    Object.assign(ticket, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
    });
    await this.ticketsRepository.save(ticket);
    return this.findOne(propertyId, ticketId);
  }

  async assign(propertyId: string, ticketId: string, dto: AssignMaintenanceTicketDto): Promise<MaintenanceTicketResponseDto> {
    const ticket = await this.findTicket(propertyId, ticketId, false);
    await this.ensureUser(propertyId, dto.assignedToUserId);
    if ([MaintenanceTicketStatus.RESOLVED, MaintenanceTicketStatus.CANCELLED].includes(ticket.status)) {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Closed tickets cannot be assigned' });
    }
    ticket.assignedToUserId = dto.assignedToUserId;
    ticket.status = MaintenanceTicketStatus.IN_PROGRESS;
    await this.ticketsRepository.save(ticket);
    return this.findOne(propertyId, ticketId);
  }

  async resolve(propertyId: string, ticketId: string, dto: ResolveMaintenanceTicketDto): Promise<MaintenanceTicketResponseDto> {
    const ticket = await this.findTicket(propertyId, ticketId, false);
    if (ticket.status === MaintenanceTicketStatus.CANCELLED) {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Cancelled tickets cannot be resolved' });
    }
    ticket.status = MaintenanceTicketStatus.RESOLVED;
    ticket.resolvedAt = new Date();
    ticket.resolutionNote = dto.resolutionNote?.trim() || null;
    await this.ticketsRepository.save(ticket);
    return this.findOne(propertyId, ticketId);
  }

  async cancel(propertyId: string, ticketId: string): Promise<MaintenanceTicketResponseDto> {
    const ticket = await this.findTicket(propertyId, ticketId, false);
    if (ticket.status === MaintenanceTicketStatus.RESOLVED) {
      throw new BadRequestException({ code: 'INVALID_STATE', message: 'Resolved tickets cannot be cancelled' });
    }
    ticket.status = MaintenanceTicketStatus.CANCELLED;
    await this.ticketsRepository.save(ticket);
    return this.findOne(propertyId, ticketId);
  }

  private async findTicket(propertyId: string, ticketId: string, relations = true): Promise<MaintenanceTicketEntity> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId, propertyId },
      relations: relations ? ['room'] : undefined,
    });
    if (!ticket) throw new NotFoundException({ code: 'MAINTENANCE_TICKET_NOT_FOUND', message: 'Maintenance ticket was not found' });
    return ticket;
  }

  private async ensureRoom(propertyId: string, roomId: string | null): Promise<void> {
    if (!roomId) return;
    const room = await this.roomsRepository.findOne({ where: { id: roomId, propertyId } });
    if (!room) throw new NotFoundException({ code: 'ROOM_NOT_FOUND', message: 'Room was not found' });
  }

  private async ensureUser(propertyId: string, userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: [{ id: userId, propertyId }, { id: userId, propertyId: IsNull() }] });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User was not found' });
  }
}
