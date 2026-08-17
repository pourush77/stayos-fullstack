import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { ActivityEventEntity } from '../../activity/infrastructure/activity-event.entity';
import { AuditEventEntity } from '../../audit/infrastructure/audit-event.entity';
import { ApiErrorCode } from '../../../common/errors/api-error-code.enum';
import { GuestEntity } from '../../guests/infrastructure/guest.entity';
import { RoomTypeEntity } from '../../room-types/infrastructure/room-type.entity';
import { RoomOperationalStatus } from '../../rooms/domain/room-operational-status.enum';
import { RoomEntity } from '../../rooms/infrastructure/room.entity';
import { calculateTotals } from '../../billing/billing.mapper';
import { FolioChargeType } from '../../billing/domain/folio-charge-type.enum';
import { FolioStatus } from '../../billing/domain/folio-status.enum';
import { FolioChargeEntity } from '../../billing/infrastructure/folio-charge.entity';
import { FolioEntity } from '../../billing/infrastructure/folio.entity';
import { TaxService } from '../../rates/tax.service';
import { AssignRoomDto } from '../dto/assign-room.dto';
import { ExtendReservationDto } from '../dto/extend-reservation.dto';
import { MoveRoomDto } from '../dto/move-room.dto';
import { ReservationWorkflowResponseDto } from '../dto/reservation-workflow-response.dto';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';
import { ReservationEntity } from '../infrastructure/reservation.entity';
import { ReservationsMapper } from '../reservations.mapper';
import { RoomsMapper } from '../../rooms/rooms.mapper';
import { CheckInService } from './check-in.service';
import { PolicyResolverService } from '../../policies/policy-resolver.service';
import { assertReservationTransition } from '../domain/reservation-transitions';
import {
  ReservationInventoryEntitlement,
  getReservationInventoryEntitlement,
} from '../domain/reservation-inventory';
import { diffEntitlements } from '../domain/reservation-inventory-transition';
import { AvailabilityService } from '../../inventory/availability.service';
import { ReservationPricingService } from './reservation-pricing.service';
import { ReservationRateSnapshotService } from './reservation-rate-snapshot.service';
import { ReservationRateSnapshotTrigger } from '../domain/reservation-rate-snapshot-trigger.enum';
import { expandStayNights } from '../../inventory/domain/inventory-nights';

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
    private readonly taxService: TaxService,
    private readonly policyResolver: PolicyResolverService,
    private readonly availabilityService: AvailabilityService,
    private readonly reservationPricingService: ReservationPricingService,
    private readonly reservationRateSnapshotService: ReservationRateSnapshotService,
  ) {}

  async confirm(
    propertyId: string,
    reservationId: string,
    actorContext: WorkflowActorContext = {},
  ): Promise<ReservationEntity> {
    return this.dataSource.transaction(async (manager) => {
      const reservationRepository = manager.getRepository(ReservationEntity);
      const reservation = await this.findReservation(reservationRepository, propertyId, reservationId);

      assertReservationTransition(reservation.status, ReservationStatus.CONFIRMED);
      const previousState = this.reservationAuditState(reservation);

      reservation.status = ReservationStatus.CONFIRMED;
      await this.applyPolicyTaxSnapshot(reservation);

      // Freeze the commercial snapshot as version 1 at confirm (idempotent:
      // a reservation created directly as CONFIRMED already holds version 1).
      await this.reservationRateSnapshotService.recordInitialVersion(manager, reservation, {
        propertyId,
        ratePlanId: reservation.ratePlanId,
        roomTypeId: reservation.roomTypeId,
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        adults: reservation.adults,
        childAges: reservation.childAges,
      });

      const updated = await reservationRepository.save(reservation);

      await this.createLifecycleEvents(manager, {
        propertyId,
        action: 'RESERVATION_CONFIRMED',
        previousState,
        nextState: this.reservationAuditState(updated),
        activityType: 'RESERVATION_CONFIRMED',
        activityTitle: 'Reservation confirmed',
        activityDescription: `Reservation ${updated.reservationCode} confirmed.`,
        reservation: updated,
        actorId: actorContext.actorId ?? null,
      });

      return updated;
    });
  }

  async cancel(
    propertyId: string,
    reservationId: string,
    reason: string | null,
    actorContext: WorkflowActorContext = {},
  ): Promise<ReservationEntity> {
    return this.terminate(
      propertyId,
      reservationId,
      ReservationStatus.CANCELLED,
      'RESERVATION_CANCELLED',
      'Reservation cancelled',
      reason,
      actorContext,
    );
  }

  async markNoShow(
    propertyId: string,
    reservationId: string,
    reason: string | null,
    actorContext: WorkflowActorContext = {},
  ): Promise<ReservationEntity> {
    return this.terminate(
      propertyId,
      reservationId,
      ReservationStatus.NO_SHOW,
      'RESERVATION_NO_SHOW',
      'Reservation marked as no-show',
      reason,
      actorContext,
    );
  }

  private async terminate(
    propertyId: string,
    reservationId: string,
    target: ReservationStatus,
    action: string,
    title: string,
    reason: string | null,
    actorContext: WorkflowActorContext,
  ): Promise<ReservationEntity> {
    return this.dataSource.transaction(async (manager) => {
      const reservationRepository = manager.getRepository(ReservationEntity);
      const reservation = await this.findReservation(reservationRepository, propertyId, reservationId);

      assertReservationTransition(reservation.status, target);
      const previousState = this.reservationAuditState(reservation);

      // Capture the entitlement being released BEFORE the status flips terminal.
      const releasedEntitlement = getReservationInventoryEntitlement(reservation);
      const wasReserved = reservation.inventoryReserved;

      reservation.status = target;
      reservation.inventoryReserved = false;
      // NOTE: physical roomId is intentionally NOT cleared here — assignment is
      // separate from inventory. Inventory entitlement is released via the hook
      // below (driven by the terminal status), not by clearing roomId.
      const updated = await reservationRepository.save(reservation);

      await this.releaseInventoryEntitlement(manager, updated, releasedEntitlement, wasReserved);

      await this.createLifecycleEvents(manager, {
        propertyId,
        action,
        previousState,
        nextState: this.reservationAuditState(updated),
        activityType: action,
        activityTitle: title,
        activityDescription: reason?.trim()
          ? `${title}: ${reason.trim()}`
          : `${title} (${updated.reservationCode}).`,
        reservation: updated,
        actorId: actorContext.actorId ?? null,
        metadata: { reason: reason?.trim() || null },
      });

      return updated;
    });
  }

  /**
   * Canonical inventory-release path for consuming -> non-consuming transitions
   * (cancel / no-show / check-out). Decrements the room-type/date availability
   * ledger for the released entitlement AND records the auditable
   * RESERVATION_INVENTORY_RELEASED event. Release is driven by the terminal
   * status transition, NOT by clearing the physical roomId. The transition
   * guard (assertReservationTransition / ensureReservationStatus) upstream makes
   * this run exactly once per reservation, so it can never double-release.
   */
  private async releaseInventoryEntitlement(
    manager: EntityManager,
    reservation: ReservationEntity,
    entitlement: ReservationInventoryEntitlement,
    wasReserved: boolean,
  ): Promise<void> {
    // Only restore inventory that was actually reserved by THIS reservation.
    // The marker makes release idempotent/paired: cancelling a never-reserved
    // (legacy / backfill-skipped oversold) reservation cannot phantom-decrement.
    if (entitlement.consuming && wasReserved) {
      await this.availabilityService.restore(
        {
          propertyId: reservation.propertyId,
          roomTypeId: entitlement.roomTypeId,
          nights: expandStayNights(entitlement.arrivalDate, entitlement.departureDate),
          units: 1,
        },
        manager,
      );
    }

    const auditRepository = manager.getRepository(AuditEventEntity);
    await auditRepository.save(
      auditRepository.create({
        propertyId: reservation.propertyId,
        entityType: 'ReservationInventory',
        entityId: reservation.id,
        action: 'RESERVATION_INVENTORY_RELEASED',
        previousState: { ...entitlement, consuming: true },
        nextState: { ...entitlement, consuming: false },
        metadata: {
          reservationCode: reservation.reservationCode,
          roomTypeId: entitlement.roomTypeId,
          arrivalDate: entitlement.arrivalDate,
          departureDate: entitlement.departureDate,
        },
      }),
    );
  }

  private async applyPolicyTaxSnapshot(reservation: ReservationEntity): Promise<void> {
    if (reservation.policySnapshot) return; // immutable once captured

    const deposit = await this.policyResolver.resolveGroupDepositInput(reservation.propertyId);
    const tax = await this.taxService.calculateForProperty(reservation.propertyId, 0);
    const capturedAt = new Date().toISOString();

    reservation.policySnapshot = { groupDeposit: deposit, capturedAt };
    reservation.taxSnapshot = {
      taxName: tax.taxName,
      taxPercentage: tax.taxPercentage,
      taxEnabled: tax.taxEnabled,
      capturedAt,
    };
  }

  private async createLifecycleEvents(
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
      actorId: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const auditRepository = manager.getRepository(AuditEventEntity);
    const activityRepository = manager.getRepository(ActivityEventEntity);
    const metadata = { reservationCode: input.reservation.reservationCode, ...(input.metadata ?? {}) };

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

      const guestRepository = manager.getRepository(GuestEntity);
      const [room, guest] = await Promise.all([
        this.findRoom(roomRepository, reservation.roomId),
        guestRepository.findOne({ where: { id: reservation.guestId, propertyId } }),
      ]);
      this.ensureRoomBelongsToProperty(room, propertyId);
      await this.ensureFolioSettledForCheckout(manager, reservation);
      await this.settleFolioForCheckout(manager, reservation);

      // Capture the entitlement BEFORE the status flips to the non-consuming
      // CHECKED_OUT so it releases exactly the nights the stay held.
      const releasedEntitlement = getReservationInventoryEntitlement(reservation);
      const wasReserved = reservation.inventoryReserved;

      const previousState = this.workflowAuditState(reservation, room);
      reservation.status = ReservationStatus.CHECKED_OUT;
      reservation.inventoryReserved = false;
      room.operationalStatus = RoomOperationalStatus.NEEDS_CLEANING;
      room.operationalStatusReason = 'CHECKOUT';
      room.operationalStatusNote = 'Room marked for cleaning after checkout.';

      const [updatedReservation, updatedRoom] = await Promise.all([
        reservationRepository.save(reservation),
        roomRepository.save(room),
      ]);

      await this.releaseInventoryEntitlement(manager, updatedReservation, releasedEntitlement, wasReserved);

      await this.createEvents(manager, {
        propertyId,
        action: 'RESERVATION_CHECKED_OUT',
        previousState,
        nextState: this.workflowAuditState(updatedReservation, updatedRoom),
        activityType: 'GUEST_CHECKED_OUT',
        activityTitle: 'Guest checked out',
        activityDescription: `${guest?.displayName ?? 'Guest'} checked out from Room ${updatedRoom.roomNumber}. Room marked for cleaning.`,
        reservation: updatedReservation,
        room: updatedRoom,
        actorId: actorContext.actorId ?? null,
      });

      return this.toWorkflowResponse(updatedReservation, updatedRoom);
    });
  }

  async extendStay(
    propertyId: string,
    reservationId: string,
    dto: ExtendReservationDto,
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
        'Only checked-in reservations can be extended',
      );

      if (dto.departureDate <= reservation.departureDate) {
        throw this.badRequest(
          ApiErrorCode.VALIDATION_ERROR,
          'New departure date must be after the current departure date',
        );
      }

      if (!reservation.roomId) {
        throw this.badRequest(
          ApiErrorCode.ROOM_NOT_FOUND,
          'Reservation must have an assigned room before extending stay',
        );
      }

      const room = await this.findRoom(roomRepository, reservation.roomId);
      this.ensureRoomBelongsToProperty(room, propertyId);

      const previousState = this.workflowAuditState(reservation, room);
      const previousDepartureDate = reservation.departureDate;
      reservation.departureDate = dto.departureDate;
      await this.ensureNoOverlappingAssignment(reservationRepository, reservation, room);

      const updatedReservation = await reservationRepository.save(reservation);

      // Entitlement diff: same roomType, extend departure -> reserve ONLY the
      // newly added nights [previousDeparture, newDeparture). Unavailable nights
      // roll back the whole extension (dates + charge + inventory). Only touch
      // inventory when this reservation actually holds a ledger entitlement.
      if (updatedReservation.inventoryReserved) {
        const entitlementDiff = diffEntitlements(
          {
            consuming: true,
            roomTypeId: updatedReservation.roomTypeId,
            nights: expandStayNights(updatedReservation.arrivalDate, previousDepartureDate),
          },
          {
            consuming: true,
            roomTypeId: updatedReservation.roomTypeId,
            nights: expandStayNights(updatedReservation.arrivalDate, updatedReservation.departureDate),
          },
        );
        await this.availabilityService.applyDelta(
          {
            propertyId,
            toRelease: entitlementDiff.toRelease,
            toReserve: entitlementDiff.toReserve,
            units: 1,
          },
          manager,
        );
      }

      await this.postExtensionSnapshotVersion(manager, updatedReservation);

      await this.createEvents(manager, {
        propertyId,
        action: 'RESERVATION_STAY_EXTENDED',
        previousState,
        nextState: this.workflowAuditState(updatedReservation, room),
        activityType: 'STAY_EXTENDED',
        activityTitle: 'Stay extended',
        activityDescription: `Reservation ${reservation.reservationCode} extended from ${previousDepartureDate} to ${updatedReservation.departureDate}.`,
        reservation: updatedReservation,
        room,
        actorId: actorContext.actorId ?? null,
      });

      return this.toWorkflowResponse(updatedReservation, room);
    });
  }

  async moveRoom(
    propertyId: string,
    reservationId: string,
    dto: MoveRoomDto,
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

      if (reservation.status !== ReservationStatus.CHECKED_IN) {
        throw this.badRequest(ApiErrorCode.INVALID_STATE, 'Only checked-in stays can be moved');
      }

      if (!reservation.roomId) {
        throw this.badRequest(
          ApiErrorCode.ROOM_NOT_ASSIGNED,
          'Reservation must have an assigned room before moving',
        );
      }

      if (reservation.roomId === dto.roomId) {
        throw this.badRequest(ApiErrorCode.SAME_ROOM, 'Target room must be different');
      }

      const [oldRoom, targetRoom] = await Promise.all([
        this.findRoom(roomRepository, reservation.roomId),
        this.findRoom(roomRepository, dto.roomId),
      ]);
      this.ensureRoomBelongsToProperty(oldRoom, propertyId);
      this.ensureRoomBelongsToProperty(targetRoom, propertyId);

      if (targetRoom.operationalStatus !== RoomOperationalStatus.READY) {
        throw this.badRequest(ApiErrorCode.ROOM_UNAVAILABLE, 'Target room must be ready');
      }

      const previousState = this.moveRoomAuditState(reservation, oldRoom, targetRoom);
      reservation.roomId = targetRoom.id;
      await this.ensureNoOverlappingAssignment(
        reservationRepository,
        reservation,
        targetRoom,
        ApiErrorCode.ROOM_OVERLAP,
      );

      this.applySourceRoomStateAfterMove(oldRoom, dto.reason);

      targetRoom.operationalStatus = RoomOperationalStatus.OCCUPIED;
      targetRoom.operationalStatusReason = null;
      targetRoom.operationalStatusNote = null;

      const [updatedReservation, updatedOldRoom, updatedTargetRoom] = await Promise.all([
        reservationRepository.save(reservation),
        roomRepository.save(oldRoom),
        roomRepository.save(targetRoom),
      ]);

      await this.createEvents(manager, {
        propertyId,
        action: 'RESERVATION_ROOM_MOVED',
        previousState,
        nextState: this.moveRoomAuditState(updatedReservation, updatedOldRoom, updatedTargetRoom),
        activityType: 'ROOM_MOVED',
        activityTitle: 'Room moved',
        activityDescription: `Reservation ${reservation.reservationCode} moved from Room ${updatedOldRoom.roomNumber} to Room ${updatedTargetRoom.roomNumber}.`,
        reservation: updatedReservation,
        room: updatedTargetRoom,
        actorId: actorContext.actorId ?? null,
        metadata: {
          fromRoomId: updatedOldRoom.id,
          fromRoomNumber: updatedOldRoom.roomNumber,
          reason: dto.reason?.trim() || null,
        },
      });

      return this.toWorkflowResponse(updatedReservation, updatedTargetRoom);
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

  private applySourceRoomStateAfterMove(room: RoomEntity, reason?: string): void {
    if (this.isOperationallyUnavailable(room.operationalStatus)) {
      return;
    }

    room.operationalStatus = RoomOperationalStatus.NEEDS_CLEANING;
    room.operationalStatusReason = 'ROOM_MOVE';
    room.operationalStatusNote = reason?.trim()
      ? `Guest moved rooms. Reason: ${reason.trim()}`
      : 'Guest moved rooms. Room marked for cleaning.';
  }

  private isOperationallyUnavailable(status: RoomOperationalStatus): boolean {
    return [
      RoomOperationalStatus.MAINTENANCE,
      RoomOperationalStatus.OUT_OF_SERVICE,
      RoomOperationalStatus.OUT_OF_ORDER,
    ].includes(status);
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
    code: ApiErrorCode = ApiErrorCode.ROOM_ALREADY_ASSIGNED,
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
        code,
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
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const auditRepository = manager.getRepository(AuditEventEntity);
    const activityRepository = manager.getRepository(ActivityEventEntity);
    const metadata = {
      reservationCode: input.reservation.reservationCode,
      roomId: input.room.id,
      roomNumber: input.room.roomNumber,
      ...(input.metadata ?? {}),
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

  /**
   * Re-prices the full (extended) stay through the authoritative resolver and
   * records a new immutable commercial snapshot version (trigger
   * STAY_EXTENSION). Replaces the previous ad-hoc folio charge / hard-coded
   * nightly-rate fallback: NO independent pricing source lives here. Folio
   * posting for the added nights is deferred to Phase 1D, which will consume
   * this snapshot version.
   */
  private async postExtensionSnapshotVersion(
    manager: EntityManager,
    reservation: ReservationEntity,
  ): Promise<void> {
    await this.reservationRateSnapshotService.amend(
      manager,
      reservation,
      {
        propertyId: reservation.propertyId,
        ratePlanId: reservation.ratePlanId,
        roomTypeId: reservation.roomTypeId,
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        adults: reservation.adults,
        childAges: reservation.childAges,
      },
      ReservationRateSnapshotTrigger.STAY_EXTENSION,
    );
    await manager.getRepository(ReservationEntity).save(reservation);
  }

  private async ensureFolioSettledForCheckout(
    manager: EntityManager,
    reservation: ReservationEntity,
  ): Promise<void> {
    const folioRepository = manager.getRepository(FolioEntity);
    const folio = await folioRepository.findOne({
      where: { propertyId: reservation.propertyId, reservationId: reservation.id },
      relations: { charges: true, payments: true },
    });
    if (!folio) return;

    const totals = calculateTotals(folio.charges ?? [], folio.payments ?? []);
    const balance = Number(totals.balance);
    if (balance > 0.01) {
      throw this.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        `Folio has an outstanding balance of ${totals.balance}. Collect payment before checkout.`,
      );
    }
  }

  private async settleFolioForCheckout(
    manager: EntityManager,
    reservation: ReservationEntity,
  ): Promise<void> {
    const folioRepository = manager.getRepository(FolioEntity);
    const folio = await folioRepository.findOne({
      where: { propertyId: reservation.propertyId, reservationId: reservation.id },
      relations: { charges: true, payments: true },
    });
    if (!folio || folio.status !== FolioStatus.OPEN) return;

    const totals = calculateTotals(folio.charges ?? [], folio.payments ?? []);
    const balance = Number(totals.balance);
    const paid = Number(totals.paid);
    if (balance <= 0.01 && paid > 0) {
      await folioRepository.update(
        { id: folio.id },
        { status: FolioStatus.SETTLED, settledAt: new Date(), updatedAt: new Date() },
      );
    }
  }

  private calculateNights(arrivalDate: string, departureDate: string): number {
    const arrival = new Date(`${arrivalDate}T00:00:00.000Z`);
    const departure = new Date(`${departureDate}T00:00:00.000Z`);
    const ms = departure.getTime() - arrival.getTime();
    return Math.max(0, Math.round(ms / 86_400_000));
  }

  private moveRoomAuditState(
    reservation: ReservationEntity,
    oldRoom: RoomEntity,
    targetRoom: RoomEntity,
  ): Record<string, unknown> {
    return {
      reservation: this.reservationAuditState(reservation),
      oldRoom: {
        id: oldRoom.id,
        operationalStatus: oldRoom.operationalStatus,
        operationalStatusReason: oldRoom.operationalStatusReason,
      },
      targetRoom: {
        id: targetRoom.id,
        operationalStatus: targetRoom.operationalStatus,
        operationalStatusReason: targetRoom.operationalStatusReason,
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
