import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { AssignRoomDto } from '../dto/assign-room.dto';
import { ReservationWorkflowResponseDto } from '../dto/reservation-workflow-response.dto';
import { ReservationStatus } from '../domain/reservation-status.enum';
import { ReservationEntity } from '../infrastructure/reservation.entity';
import { ReservationsMapper } from '../reservations.mapper';
import { RoomsMapper } from '../../rooms/rooms.mapper';
import { CheckInService } from './check-in.service';

const activeAssignmentStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

interface WorkflowActorContext {
  actorId?: string | null;
}

@Injectable()
export class ReservationWorkflowService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly checkInService: CheckInService,
  ) {}

  async assignRoom(
    propertyId: string,
    reservationId: string,
    assignRoomDto: AssignRoomDto,
    actorContext: WorkflowActorContext = {},
  ): Promise<ReservationWorkflowResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const reservationRepository = manager.getRepository(ReservationEntity);
      const roomRepository = manager.getRepository(RoomEntity);
      const roomTypeRepository = manager.getRepository(RoomTypeEntity);

      const reservation = await this.findReservation(
        reservationRepository,
        propertyId,
        reservationId,
      );

      this.ensureReservationAssignable(reservation);

      const room = await this.findRoom(roomRepository, assignRoomDto.roomId);
      this.ensureRoomBelongsToProperty(room, propertyId);
      this.ensureRoomAvailableForAssignment(room);
      this.ensureRoomTypeMatches(reservation, room);

      const roomType = await this.findRoomType(roomTypeRepository, reservation.roomTypeId);
      this.ensureCapacitySupportsReservation(reservation, roomType);
      await this.ensureNoOverlappingAssignment(reservationRepository, reservation, room);

      const previousRoom = reservation.roomId
        ? await this.findRoom(roomRepository, reservation.roomId)
        : null;

      const previousState = this.reservationAuditState(reservation);

      reservation.roomId = room.id;

      const updatedReservation = await reservationRepository.save(reservation);

      const isReassignment = Boolean(previousRoom && previousRoom.id !== room.id);

      await this.createEvents(manager, {
        propertyId,
        action: isReassignment ? 'RESERVATION_ROOM_CHANGED' : 'RESERVATION_ROOM_ASSIGNED',
        previousState,
        nextState: this.reservationAuditState(updatedReservation),
        activityType: isReassignment ? 'ROOM_CHANGED' : 'ROOM_ASSIGNED',
        activityTitle: isReassignment ? 'Room changed' : 'Room assigned',
        activityDescription: isReassignment
          ? `Reservation ${reservation.reservationCode} changed from Room ${previousRoom?.roomNumber} to Room ${room.roomNumber}.`
          : `Room ${room.roomNumber} assigned to reservation ${reservation.reservationCode}.`,
        reservation: updatedReservation,
        room,
        actorId: actorContext.actorId ?? null,
      });

      return this.toWorkflowResponse(updatedReservation, room);
    });
  }

  async unassignRoom(
    propertyId: string,
    reservationId: string,
    actorContext: WorkflowActorContext = {},
  ): Promise<ReservationWorkflowResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const reservationRepository = manager.getRepository(ReservationEntity);
      const roomRepository = manager.getRepository(RoomEntity);

      const reservation = await this.findReservation(
        reservationRepository,
        propertyId,
        reservationId,
      );

      this.ensureReservationAssignable(reservation);

      if (!reservation.roomId) {
        throw this.badRequest(
          ApiErrorCode.ROOM_NOT_FOUND,
          'Reservation does not have an assigned room',
        );
      }

      const room = await this.findRoom(roomRepository, reservation.roomId);
      this.ensureRoomBelongsToProperty(room, propertyId);

      const previousState = this.reservationAuditState(reservation);

      reservation.roomId = null;

      const updatedReservation = await reservationRepository.save(reservation);

      await this.createEvents(manager, {
        propertyId,
        action: 'RESERVATION_ROOM_UNASSIGNED',
        previousState,
        nextState: this.reservationAuditState(updatedReservation),
        activityType: 'ROOM_UNASSIGNED',
        activityTitle: 'Room assignment removed',
        activityDescription: `Room ${room.roomNumber} removed from reservation ${reservation.reservationCode}.`,
        reservation: updatedReservation,
        room,
        actorId: actorContext.actorId ?? null,
      });

      return this.toWorkflowResponse(updatedReservation, room);
    });
  }

  async checkIn(
    propertyId: string,
    reservationId: string,
    actorContext: WorkflowActorContext = {},
  ): Promise<ReservationWorkflowResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const reservationRepository = manager.getRepository(ReservationEntity);
      const roomRepository = manager.getRepository(RoomEntity);
      const guestRepository = manager.getRepository(GuestEntity);

      const reservation = await this.findReservation(
        reservationRepository,
        propertyId,
        reservationId,
      );
      this.ensureReservationStatus(
        reservation,
        ReservationStatus.CONFIRMED,
        ApiErrorCode.RESERVATION_NOT_CONFIRMED,
        'Only confirmed reservations can be checked in',
      );

      if (!reservation.roomId) {
        throw this.badRequest(
          ApiErrorCode.ROOM_NOT_FOUND,
          'Reservation must have an assigned room before check-in',
        );
      }

      const [room, guest] = await Promise.all([
        this.findRoom(roomRepository, reservation.roomId),
        guestRepository.findOne({ where: { id: reservation.guestId } }),
      ]);

      if (!guest) {
        throw new NotFoundException({
          code: ApiErrorCode.GUEST_NOT_FOUND,
          message: `Guest ${reservation.guestId} was not found`,
        });
      }

      this.ensureRoomBelongsToProperty(room, propertyId);
      const workspaceParts = await this.checkInService.loadWorkspaceParts(
        propertyId,
        reservationId,
        manager,
      );
      this.checkInService.validateFinalChecklist(workspaceParts);

      const previousState = this.workflowAuditState(reservation, room);
      reservation.status = ReservationStatus.CHECKED_IN;
      room.operationalStatus = RoomOperationalStatus.OCCUPIED;
      room.operationalStatusReason = null;
      room.operationalStatusNote = null;

      const [updatedReservation, updatedRoom] = await Promise.all([
        reservationRepository.save(reservation),
        roomRepository.save(room),
      ]);

      await this.createEvents(manager, {
        propertyId,
        action: 'RESERVATION_CHECKED_IN',
        previousState,
        nextState: this.workflowAuditState(updatedReservation, updatedRoom),
        activityType: 'GUEST_CHECKED_IN',
        activityTitle: 'Guest checked in',
        activityDescription: `${guest.displayName} checked into Room ${updatedRoom.roomNumber}.`,
        reservation: updatedReservation,
        room: updatedRoom,
        actorId: actorContext.actorId ?? null,
      });

      return this.toWorkflowResponse(updatedReservation, updatedRoom);
    });
  }

  async checkOut(
    propertyId: string,
    reservationId: string,
    actorContext: WorkflowActorContext = {},
  ): Promise<ReservationWorkflowResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const reservationRepository = manager.getRepository(ReservationEntity);
      const roomRepository = manager.getRepository(RoomEntity);

      const reservation = await this.findReservation(
        reservationRepository,
        propertyId,
        reservationId,
      );
      this.ensureReservationStatus(
        reservation,
        ReservationStatus.CHECKED_IN,
        ApiErrorCode.RESERVATION_NOT_CHECKED_IN,
        'Only checked-in reservations can be checked out',
      );

      if (!reservation.roomId) {
        throw this.badRequest(
          ApiErrorCode.ROOM_NOT_FOUND,
          'Reservation must have an assigned room before check-out',
        );
      }

      const room = await this.findRoom(roomRepository, reservation.roomId);
      this.ensureRoomBelongsToProperty(room, propertyId);

      const previousState = this.workflowAuditState(reservation, room);
      reservation.status = ReservationStatus.CHECKED_OUT;
      room.operationalStatus = RoomOperationalStatus.NEEDS_CLEANING;
      room.operationalStatusReason = 'CHECKOUT';
      room.operationalStatusNote = 'Room marked for cleaning after checkout.';

      const [updatedReservation, updatedRoom] = await Promise.all([
        reservationRepository.save(reservation),
        roomRepository.save(room),
      ]);

      await this.createEvents(manager, {
        propertyId,
        action: 'RESERVATION_CHECKED_OUT',
        previousState,
        nextState: this.workflowAuditState(updatedReservation, updatedRoom),
        activityType: 'GUEST_CHECKED_OUT',
        activityTitle: 'Guest checked out',
        activityDescription: `Room ${updatedRoom.roomNumber} marked for cleaning after checkout.`,
        reservation: updatedReservation,
        room: updatedRoom,
        actorId: actorContext.actorId ?? null,
      });

      return this.toWorkflowResponse(updatedReservation, updatedRoom);
    });
  }

  private async findReservation(
    repository: Repository<ReservationEntity>,
    propertyId: string,
    reservationId: string,
  ): Promise<ReservationEntity> {
    const reservation = await repository.findOne({ where: { id: reservationId, propertyId } });

    if (!reservation) {
      throw new NotFoundException({
        code: ApiErrorCode.RESERVATION_NOT_FOUND,
        message: `Reservation ${reservationId} was not found`,
      });
    }

    return reservation;
  }

  private async findRoom(repository: Repository<RoomEntity>, roomId: string): Promise<RoomEntity> {
    const room = await repository.findOne({ where: { id: roomId } });

    if (!room) {
      throw new NotFoundException({
        code: ApiErrorCode.ROOM_NOT_FOUND,
        message: `Room ${roomId} was not found`,
      });
    }

    return room;
  }

  private async findRoomType(
    repository: Repository<RoomTypeEntity>,
    roomTypeId: string,
  ): Promise<RoomTypeEntity> {
    const roomType = await repository.findOne({ where: { id: roomTypeId } });

    if (!roomType) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: `Room type ${roomTypeId} was not found`,
      });
    }

    return roomType;
  }

  private ensureReservationAssignable(reservation: ReservationEntity): void {
    if (![ReservationStatus.PENDING, ReservationStatus.CONFIRMED].includes(reservation.status)) {
      throw this.badRequest(
        ApiErrorCode.INVALID_RESERVATION_STATE_TRANSITION,
        'Only pending or confirmed reservations can be assigned a room',
      );
    }
  }

  private ensureReservationStatus(
    reservation: ReservationEntity,
    expectedStatus: ReservationStatus,
    code: ApiErrorCode,
    message: string,
  ): void {
    if (reservation.status !== expectedStatus) {
      throw this.badRequest(code, message);
    }
  }

  private ensureRoomBelongsToProperty(room: RoomEntity, propertyId: string): void {
    if (room.propertyId !== propertyId) {
      throw this.badRequest(ApiErrorCode.ROOM_NOT_FOUND, 'Room does not belong to this property');
    }
  }

  private ensureRoomAvailableForAssignment(room: RoomEntity): void {
    if (room.operationalStatus === RoomOperationalStatus.OCCUPIED) {
      throw this.badRequest(ApiErrorCode.ROOM_ALREADY_OCCUPIED, 'Room is already occupied');
    }

    if (room.operationalStatus === RoomOperationalStatus.OUT_OF_SERVICE) {
      throw this.badRequest(ApiErrorCode.ROOM_OUT_OF_SERVICE, 'Room is out of service');
    }

    if (room.operationalStatus === RoomOperationalStatus.OUT_OF_ORDER) {
      throw this.badRequest(ApiErrorCode.ROOM_OUT_OF_ORDER, 'Room is out of order');
    }

    this.ensureRoomReady(room);
  }

  private ensureRoomReady(room: RoomEntity): void {
    if (room.operationalStatus !== RoomOperationalStatus.READY) {
      throw this.badRequest(ApiErrorCode.ROOM_NOT_READY, 'Room must be ready');
    }
  }

  private ensureRoomTypeMatches(reservation: ReservationEntity, room: RoomEntity): void {
    if (room.roomTypeId !== reservation.roomTypeId) {
      throw this.badRequest(
        ApiErrorCode.ROOM_TYPE_MISMATCH,
        'Room type must match reservation room type',
      );
    }
  }

  private ensureCapacitySupportsReservation(
    reservation: ReservationEntity,
    roomType: RoomTypeEntity,
  ): void {
    const totalGuests = reservation.adults + reservation.children;

    if (
      totalGuests > roomType.maxOccupancy ||
      reservation.adults > roomType.maxAdults ||
      reservation.children > roomType.maxChildren
    ) {
      throw this.badRequest(
        ApiErrorCode.ROOM_CAPACITY_EXCEEDED,
        'Room capacity does not support reservation guest count',
      );
    }
  }

  private async ensureNoOverlappingAssignment(
    repository: Repository<ReservationEntity>,
    reservation: ReservationEntity,
    room: RoomEntity,
  ): Promise<void> {
    const overlapCount = await repository.count({
      where: {
        id: Not(reservation.id),
        propertyId: reservation.propertyId,
        roomId: room.id,
        status: In(activeAssignmentStatuses),
        arrivalDate: LessThan(reservation.departureDate),
        departureDate: MoreThan(reservation.arrivalDate),
      },
    });

    if (overlapCount > 0) {
      throw this.badRequest(
        ApiErrorCode.ROOM_ALREADY_ASSIGNED,
        'Room is already assigned to another active overlapping reservation',
      );
    }
  }

  private async createEvents(
    manager: EntityManager,
    input: {
      propertyId: string;
      action: string;
      previousState: Record<string, unknown>;
      nextState: Record<string, unknown>;
      activityType: string;
      activityTitle: string;
      activityDescription: string;
      reservation: ReservationEntity;
      room: RoomEntity;
      actorId: string | null;
    },
  ): Promise<void> {
    const auditRepository = manager.getRepository(AuditEventEntity);
    const activityRepository = manager.getRepository(ActivityEventEntity);
    const metadata = {
      reservationCode: input.reservation.reservationCode,
      roomId: input.room.id,
      roomNumber: input.room.roomNumber,
    };

    await Promise.all([
      auditRepository.save(
        auditRepository.create({
          propertyId: input.propertyId,
          actorId: input.actorId,
          entityType: 'Reservation',
          entityId: input.reservation.id,
          action: input.action,
          previousState: input.previousState,
          nextState: input.nextState,
          metadata,
        }),
      ),
      activityRepository.save(
        activityRepository.create({
          propertyId: input.propertyId,
          type: input.activityType,
          title: input.activityTitle,
          description: input.activityDescription,
          entityType: 'Reservation',
          entityId: input.reservation.id,
          metadata,
        }),
      ),
    ]);
  }

  private reservationAuditState(reservation: ReservationEntity): Record<string, unknown> {
    return {
      id: reservation.id,
      status: reservation.status,
      roomId: reservation.roomId,
    };
  }

  private workflowAuditState(
    reservation: ReservationEntity,
    room: RoomEntity,
  ): Record<string, unknown> {
    return {
      reservation: this.reservationAuditState(reservation),
      room: {
        id: room.id,
        operationalStatus: room.operationalStatus,
        operationalStatusReason: room.operationalStatusReason,
      },
    };
  }

  private toWorkflowResponse(
    reservation: ReservationEntity,
    room: RoomEntity,
  ): ReservationWorkflowResponseDto {
    return {
      reservation: ReservationsMapper.toResponse(reservation),
      room: RoomsMapper.toResponse(room),
    };
  }

  private badRequest(code: ApiErrorCode, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }
}
