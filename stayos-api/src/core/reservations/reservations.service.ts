import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThan, Not, QueryFailedError, Repository, DataSource } from 'typeorm';
import {
  createPaginationMeta,
  PaginationMeta,
  PaginationQueryDto,
  paginateQuery,
} from '../../common/dto/pagination.dto';
import { ActivityEventEntity } from '../activity/infrastructure/activity-event.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypeEntity } from '../room-types/infrastructure/room-type.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationPaymentStatus } from './domain/reservation-payment-status.enum';
import { ReservationStatus } from './domain/reservation-status.enum';
import { ReservationSource } from './domain/reservation-source.enum';
import { GuestDocumentEntity } from './check-in-capture/guest-document.entity';
import { ReservationEntity } from './infrastructure/reservation.entity';
import { RoomOperationalStatus } from '../rooms/domain/room-operational-status.enum';
import { ChildPricingService } from '../rates/child-pricing.service';
import { AvailabilityService } from '../inventory/availability.service';
import { ReservationPricingService } from './services/reservation-pricing.service';
import { ReservationRateSnapshotService } from './services/reservation-rate-snapshot.service';
import { RestrictionService } from '../rates/restriction.service';
import { ReservationRateSnapshotTrigger } from './domain/reservation-rate-snapshot-trigger.enum';
import { expandStayNights } from '../inventory/domain/inventory-nights';
import {
  InventoryDelta,
  inventoryDeltaForTransition,
  diffEntitlements,
} from './domain/reservation-inventory-transition';
import { reservationConsumesInventory } from './domain/reservation-inventory';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum';

export interface PaginatedReservations {
  data: ReservationEntity[];
  pagination?: PaginationMeta;
}

const reservationSortColumns: Record<string, string> = {
  reservationCode: 'reservation.reservationCode',
  arrivalDate: 'reservation.arrivalDate',
  departureDate: 'reservation.departureDate',
  status: 'reservation.status',
  paymentStatus: 'reservation.paymentStatus',
  source: 'reservation.source',
  createdAt: 'reservation.createdAt',
  updatedAt: 'reservation.updatedAt',
};

const activeAssignmentStatuses = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(GuestEntity)
    private readonly guestsRepository: Repository<GuestEntity>,
    @InjectRepository(RoomTypeEntity)
    private readonly roomTypesRepository: Repository<RoomTypeEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(ActivityEventEntity)
    private readonly activityRepository: Repository<ActivityEventEntity>,
    @InjectRepository(GuestDocumentEntity)
    private readonly guestDocumentsRepository: Repository<GuestDocumentEntity>,
    private readonly propertiesService: PropertiesService,
    private readonly childPricingService: ChildPricingService,
    private readonly dataSource: DataSource,
    private readonly availabilityService: AvailabilityService,
    private readonly reservationPricingService: ReservationPricingService,
    private readonly reservationRateSnapshotService: ReservationRateSnapshotService,
    private readonly restrictionService: RestrictionService,
  ) {}

  async findAll(propertyId: string, query: PaginationQueryDto): Promise<PaginatedReservations> {
    await this.propertiesService.findOne(propertyId);

    const sortColumn = this.resolveSortColumn(query.sortBy);
    const sortOrder = query.sortOrder ?? 'ASC';
    const pagination = paginateQuery(query.page, query.limit);

    const qb = this.reservationsRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.guest', 'guest')
      .leftJoinAndSelect('reservation.roomType', 'roomType')
      .leftJoinAndSelect('reservation.room', 'room')
      .where('reservation.propertyId = :propertyId', { propertyId });

    if (query.search) {
      qb.andWhere(
        `(${[
          'reservation.reservationCode ILIKE :search',
          'guest.firstName ILIKE :search',
          'guest.lastName ILIKE :search',
          'guest.displayName ILIKE :search',
          'guest.phone ILIKE :search',
        ].join(' OR ')})`,
        { search: `%${query.search}%` },
      );
    }

    if (!pagination) {
      const data = await qb.orderBy(sortColumn, sortOrder).getMany();
      return { data };
    }

    const [data, total] = await qb
      .orderBy(sortColumn, sortOrder)
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .getManyAndCount();

    return {
      data,
      pagination: createPaginationMeta(pagination.page, pagination.limit, total),
    };
  }

  async findOne(propertyId: string, id: string): Promise<ReservationEntity> {
    await this.propertiesService.findOne(propertyId);

    const reservation = await this.reservationsRepository.findOne({
      where: { id, propertyId },
      relations: { guest: true, roomType: true, room: true },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} was not found`);
    }

    return reservation;
  }

  async getStayWorkspace(propertyId: string, id: string): Promise<Record<string, unknown>> {
    await this.propertiesService.findOne(propertyId);

    const reservation = await this.reservationsRepository.findOne({
      where: { id, propertyId },
      relations: { guest: true, room: { floor: true, roomType: true }, roomType: true },
    });

    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} was not found`);
    }

    const [activity, documents] = await Promise.all([
      this.activityRepository.find({
        where: { propertyId, entityType: 'RESERVATION', entityId: reservation.id },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.guestDocumentsRepository.find({
        where: { propertyId, reservationId: reservation.id },
        order: { createdAt: 'ASC' },
      }),
    ]);

    return {
      reservation,
      guest: reservation.guest,
      room: reservation.room,
      documents: documents.map((document) => ({
        id: document.id,
        documentKind: document.documentKind,
        side: document.side,
        status: 'Uploaded',
        uploadedAt: document.createdAt,
      })),
      activity: activity.map((event) => ({
        title: event.title,
        description: event.description,
        timestamp: event.createdAt,
        entity: {
          type: event.entityType,
          id: event.entityId,
        },
        metadata: event.metadata,
      })),
      payment: {
        status: reservation.paymentStatus,
        reviewed: reservation.paymentReviewed ?? false,
        method: reservation.paymentMethod ?? null,
      },
      allowedActions: {
        canCheckOut: reservation.status === ReservationStatus.CHECKED_IN,
        canExtendStay: reservation.status === ReservationStatus.CHECKED_IN,
        canMoveRoom: reservation.status === ReservationStatus.CHECKED_IN,
      },
      warnings: this.getStayWorkspaceWarnings(reservation),
    };
  }

  async create(
    propertyId: string,
    createReservationDto: CreateReservationDto,
  ): Promise<ReservationEntity> {
    await this.propertiesService.findOne(propertyId);

    // --- Idempotent external-identity fast path (1C-d2) ---
    // If this create carries an OTA/channel identity, a prior row with the same
    // (property, provider, externalReservationId) means this is a retry: an
    // equivalent payload returns the existing reservation (NO side effects), a
    // conflicting payload is rejected 409. Provider is required when an external
    // id is present (also enforced at the DTO level; guarded here defensively).
    const externalProvider = this.normalizeProvider(createReservationDto.sourceProvider);
    if (createReservationDto.externalReservationId) {
      if (!externalProvider) {
        throw new BadRequestException(
          'sourceProvider is required when externalReservationId is supplied',
        );
      }
      const existing = await this.findByExternalIdentity(
        propertyId,
        externalProvider,
        createReservationDto.externalReservationId,
      );
      if (existing) {
        return this.resolveIdempotentRetry(existing, createReservationDto, externalProvider);
      }
    }

    await this.validateDateRange(
      createReservationDto.arrivalDate,
      createReservationDto.departureDate,
    );

    const references = await this.validateReferences(propertyId, createReservationDto);
    await this.childPricingService.validateReservationChildAges(
      propertyId,
      createReservationDto.children ?? 0,
      createReservationDto.childAges,
    );
    await this.validateRoomAssignment({
      propertyId,
      room: references.room,
      roomType: references.roomType,
      arrivalDate: createReservationDto.arrivalDate,
      departureDate: createReservationDto.departureDate,
      adults: createReservationDto.adults,
      children: createReservationDto.children ?? 0,
    });

    const status = createReservationDto.status ?? ReservationStatus.CONFIRMED;
    const willReserve = inventoryDeltaForTransition(null, status) === InventoryDelta.RESERVE;
    const ratePlanId: string | null = createReservationDto.ratePlanId ?? null;

    // Collision-safe reservation code allocated via an atomic per-property
    // counter in its OWN auto-committed statement (before the main transaction)
    // so the counter row lock is held for ~1ms instead of the whole create —
    // the counter is never a serialization bottleneck. Concurrent creates each
    // receive a distinct value. A rolled-back create may leave a gap in the
    // sequence, which is acceptable (the old count()+1 scheme also gapped on
    // deletes) and never produces a duplicate.
    const reservationCode = await this.nextReservationCode(propertyId);

    try {
      return await this.dataSource.transaction(async (manager) => {
        // Restriction gate: validate the entire newly requested stay under the
        // EFFECTIVE rate plan (explicit -> default -> none/baseline) BEFORE any
        // write. A RESTRICTION_VIOLATION (422) here rolls back the whole
        // transaction => no reservation, no inventory, no snapshot. Validation
        // only — never mutates inventory/pricing.
        const effectiveRatePlanId = await this.reservationPricingService.resolveEffectiveRatePlanId({
          propertyId,
          roomTypeId: createReservationDto.roomTypeId,
          ratePlanId,
        }, manager);
        await this.restrictionService.assertStaySellable({
          propertyId,
          roomTypeId: createReservationDto.roomTypeId,
          ratePlanId: effectiveRatePlanId,
          arrivalDate: createReservationDto.arrivalDate,
          departureDate: createReservationDto.departureDate,
        }, manager);

        const reservationRepository = manager.getRepository(ReservationEntity);
        const reservation = reservationRepository.create({
          ...this.toCreatePersistenceFields(createReservationDto),
          propertyId,
          reservationCode,
          status,
          inventoryReserved: willReserve,
          ratePlanId,
          rateSnapshot: null,
          rateSnapshotVersion: null,
        });

        const saved = await reservationRepository.save(reservation);

        // Commercial commit rule: snapshot version 1 only when creating directly
        // into the committed CONFIRMED state. PENDING stays unsnapshotted until
        // confirm (pricing-commit != inventory-consume). Runs in THIS
        // transaction so an invalid rate plan rolls back the whole create.
        if (status === ReservationStatus.CONFIRMED) {
          await this.reservationRateSnapshotService.recordInitialVersion(manager, saved, {
            propertyId,
            ratePlanId,
            roomTypeId: saved.roomTypeId,
            arrivalDate: saved.arrivalDate,
            departureDate: saved.departureDate,
            adults: saved.adults,
            childAges: saved.childAges,
          });
          await reservationRepository.save(saved);
        }

        // Inventory is driven by the entitlement transition (none -> status),
        // NOT by the create action itself. Only entering a consuming status
        // reserves inventory, and it happens in THIS transaction so an
        // out-of-stock night rolls back the reservation write entirely.
        if (willReserve) {
          await this.availabilityService.reserve(
            {
              propertyId,
              roomTypeId: saved.roomTypeId,
              nights: expandStayNights(saved.arrivalDate, saved.departureDate),
              units: 1,
            },
            manager,
          );
        }

        return saved;
      });
    } catch (error) {
      // Concurrency convergence: a simultaneous request may have won the
      // external identity. The loser's INSERT then fails on a unique index —
      // either the external-identity index directly, OR the reservation_code
      // index (concurrent creates can compute the same code). In BOTH cases the
      // loser's transaction has fully rolled back (no reservation/inventory/
      // snapshot). Recover the winner by external identity and resolve
      // idempotently instead of surfacing a raw duplicate-key error.
      if (
        this.isUniqueViolation(error) &&
        externalProvider &&
        createReservationDto.externalReservationId
      ) {
        const winner = await this.findByExternalIdentity(
          propertyId,
          externalProvider,
          createReservationDto.externalReservationId,
        );
        if (winner) {
          return this.resolveIdempotentRetry(winner, createReservationDto, externalProvider);
        }
      }
      this.handlePersistenceError(error);
    }
  }

  async update(
    propertyId: string,
    id: string,
    updateReservationDto: UpdateReservationDto,
  ): Promise<ReservationEntity> {
    const reservation = await this.findOne(propertyId, id);

    const arrivalDate = updateReservationDto.arrivalDate ?? reservation.arrivalDate;
    const departureDate = updateReservationDto.departureDate ?? reservation.departureDate;
    const children = updateReservationDto.children ?? reservation.children;
    const childAges =
      updateReservationDto.childAges === undefined
        ? reservation.childAges
        : updateReservationDto.childAges;

    await this.validateDateRange(arrivalDate, departureDate);
    if ('children' in updateReservationDto || 'childAges' in updateReservationDto) {
      await this.childPricingService.validateReservationChildAges(propertyId, children, childAges);
    }

    const references = await this.validateReferences(propertyId, {
      guestId: updateReservationDto.guestId ?? reservation.guestId,
      roomTypeId: updateReservationDto.roomTypeId ?? reservation.roomTypeId,
      roomId:
        updateReservationDto.roomId === undefined
          ? (reservation.roomId ?? undefined)
          : updateReservationDto.roomId,
    });
    await this.validateRoomAssignment({
      propertyId,
      reservationId: reservation.id,
      room: references.room,
      roomType: references.roomType,
      arrivalDate,
      departureDate,
      adults: updateReservationDto.adults ?? reservation.adults,
      children,
    });

    try {
      const consuming = reservationConsumesInventory(reservation.status);
      const beforeRoomTypeId = reservation.roomTypeId;
      const beforeArrival = reservation.arrivalDate;
      const beforeDeparture = reservation.departureDate;
      const afterRoomTypeId = references.roomType.id;

      // Classify the edit as commercial (re-price + new snapshot version) or
      // operational (no version). ratePlanId/roomType/dates/occupancy are
      // commercial; guest/room/notes/etc are operational.
      const nextRatePlanId =
        'ratePlanId' in updateReservationDto
          ? (updateReservationDto.ratePlanId ?? null)
          : reservation.ratePlanId;
      const currentKey = {
        propertyId,
        ratePlanId: reservation.ratePlanId,
        roomTypeId: beforeRoomTypeId,
        arrivalDate: beforeArrival,
        departureDate: beforeDeparture,
        adults: reservation.adults,
        childAges: reservation.childAges,
      };
      const nextKey = {
        propertyId,
        ratePlanId: nextRatePlanId,
        roomTypeId: afterRoomTypeId,
        arrivalDate,
        departureDate,
        adults: updateReservationDto.adults ?? reservation.adults,
        childAges,
      };
      const commercialChanged =
        this.reservationRateSnapshotService.computeCommercialHash(currentKey) !==
        this.reservationRateSnapshotService.computeCommercialHash(nextKey);
      if (commercialChanged) {
        this.assertCommercialAmendmentAllowed(reservation.status);
      }
      // Resolve the EFFECTIVE rate plan for BOTH sides (explicit -> default ->
      // baseline) so restriction scope-change detection is symmetric: a null
      // ratePlanId that resolves to the same default plan is NOT a scope change
      // and stays change-aware (grandfathered nights preserved).
      const currentEffectiveRatePlanId = commercialChanged
        ? await this.reservationPricingService.resolveEffectiveRatePlanId({
            propertyId,
            roomTypeId: beforeRoomTypeId,
            ratePlanId: reservation.ratePlanId,
          })
        : reservation.ratePlanId;
      const nextEffectiveRatePlanId = commercialChanged
        ? await this.reservationPricingService.resolveEffectiveRatePlanId({
            propertyId,
            roomTypeId: afterRoomTypeId,
            ratePlanId: nextRatePlanId,
          })
        : reservation.ratePlanId;

      // Entitlement diff for date/roomType changes (status is NOT changed by
      // update). Only nights/roomType that disappear are released and only new
      // ones are reserved; unchanged nights are never touched.
      const diff = diffEntitlements(
        {
          consuming,
          roomTypeId: beforeRoomTypeId,
          nights: expandStayNights(beforeArrival, beforeDeparture),
        },
        {
          consuming,
          roomTypeId: afterRoomTypeId,
          nights: expandStayNights(arrivalDate, departureDate),
        },
      );

      await this.dataSource.transaction(async (manager) => {
        const reservationRepository = manager.getRepository(ReservationEntity);
        const updatedReservation = reservationRepository.merge(reservation, {
          ...this.toUpdatePersistenceFields(updateReservationDto),
        });

        // Keep loaded relation objects in sync with the scalar FKs so TypeORM
        // persists FK changes reliably (merge alone lets stale relations win).
        updatedReservation.guest = references.guest;
        updatedReservation.roomType = references.roomType;
        updatedReservation.room = references.room;
        updatedReservation.roomId = references.room ? references.room.id : null;

        await reservationRepository.save(updatedReservation);

        // Only mutate inventory when this reservation actually holds a ledger
        // entitlement (paired reserve/release). A never-reserved (legacy /
        // backfill-skipped) reservation is left untouched to avoid phantom drift.
        if (
          reservation.inventoryReserved &&
          (diff.toRelease.length > 0 || diff.toReserve.length > 0)
        ) {
          await this.availabilityService.applyDelta(
            { propertyId, toRelease: diff.toRelease, toReserve: diff.toReserve, units: 1 },
            manager,
          );
        }

        // Change-aware restriction gate: runs on ANY commercial change for a
        // sellable reservation (PENDING or CONFIRMED — CHECKED_IN/terminal are
        // rejected upstream by assertCommercialAmendmentAllowed), INDEPENDENT of
        // snapshot versioning. Validates only newly-introduced/re-scoped
        // entitlement (grandfathering unchanged historical nights). A 422
        // RESTRICTION_VIOLATION here rolls back the reservation + inventory +
        // snapshot together.
        if (commercialChanged) {
          await this.restrictionService.assertAmendmentSellable(
            { propertyId, roomTypeId: beforeRoomTypeId, ratePlanId: currentEffectiveRatePlanId, arrivalDate: beforeArrival, departureDate: beforeDeparture },
            { propertyId, roomTypeId: afterRoomTypeId, ratePlanId: nextEffectiveRatePlanId, arrivalDate, departureDate },
            manager,
          );
        }

        // Commercial amendment: re-price via the authoritative resolver and
        // record a new immutable snapshot version (only for reservations that
        // already hold an ACTIVE snapshot; PENDING stays deferred to confirm).
        // A commercial no-op creates no version. Runs in THIS transaction so
        // pricing + inventory + reservation commit/roll back together.
        if (commercialChanged && reservation.rateSnapshotVersion != null) {
          await this.reservationRateSnapshotService.amend(
            manager,
            updatedReservation,
            nextKey,
            this.commercialTrigger(currentKey, nextKey),
          );
          await reservationRepository.save(updatedReservation);
        }
      });

      // Re-fetch so the response reflects the persisted state (with relations).
      return await this.findOne(propertyId, id);
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  /**
   * Collision-safe, per-property reservation code allocator. Runs an atomic
   * upsert-increment on `reservation_code_counters` (one row per property) in
   * its OWN auto-committed statement: concurrent callers serialize on the
   * counter row only for that single statement and each receives a distinct
   * value. Preserves the human-readable format `HS{YYMMDD}-{NNNNN}`
   * (per-property running sequence, creation-date prefix). A create that later
   * rolls back may leave a gap — acceptable, and never a duplicate.
   */
  private async nextReservationCode(propertyId: string): Promise<string> {
    const rows: Array<{ last_value: string | number }> = await this.dataSource.query(
      `INSERT INTO reservation_code_counters (property_id, last_value)
       VALUES ($1, 1)
       ON CONFLICT (property_id)
       DO UPDATE SET last_value = reservation_code_counters.last_value + 1, updated_at = now()
       RETURNING last_value`,
      [propertyId],
    );
    const sequence = String(rows[0].last_value).padStart(5, '0');
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `HS${yy}${mm}${dd}-${sequence}`;
  }

  private async validateReferences(
    propertyId: string,
    references: { guestId: string; roomTypeId: string; roomId?: string | null },
  ): Promise<{ guest: GuestEntity; roomType: RoomTypeEntity; room: RoomEntity | null }> {
    const [guest, roomType, room] = await Promise.all([
      this.guestsRepository.findOne({ where: { id: references.guestId } }),
      this.roomTypesRepository.findOne({ where: { id: references.roomTypeId } }),
      references.roomId
        ? this.roomsRepository.findOne({ where: { id: references.roomId } })
        : Promise.resolve(null),
    ]);

    if (!guest) {
      throw new NotFoundException(`Guest ${references.guestId} was not found`);
    }

    if (!roomType) {
      throw new NotFoundException(`Room type ${references.roomTypeId} was not found`);
    }

    if (references.roomId && !room) {
      throw new NotFoundException(`Room ${references.roomId} was not found`);
    }

    if (
      guest.propertyId !== propertyId ||
      roomType.propertyId !== propertyId ||
      (room && room.propertyId !== propertyId)
    ) {
      throw new BadRequestException(
        'Reservation guest, room type, and room must belong to the same property',
      );
    }

    return { guest, roomType, room };
  }

  private async validateRoomAssignment(input: {
    propertyId: string;
    reservationId?: string;
    room: RoomEntity | null;
    roomType: RoomTypeEntity;
    arrivalDate: string;
    departureDate: string;
    adults: number;
    children: number;
  }): Promise<void> {
    if (!input.room) return;

    if (input.room.operationalStatus !== RoomOperationalStatus.READY) {
      throw new BadRequestException('Assigned room must be ready');
    }

    if (input.room.roomTypeId !== input.roomType.id) {
      throw new BadRequestException('Assigned room type must match reservation room type');
    }

    const totalGuests = input.adults + input.children;
    if (
      totalGuests > input.roomType.maxOccupancy ||
      input.adults > input.roomType.maxAdults ||
      input.children > input.roomType.maxChildren
    ) {
      throw new BadRequestException('Room capacity does not support reservation guest count');
    }

    const overlapCount = await this.reservationsRepository.count({
      where: {
        ...(input.reservationId ? { id: Not(input.reservationId) } : {}),
        propertyId: input.propertyId,
        roomId: input.room.id,
        status: In(activeAssignmentStatuses),
        arrivalDate: LessThan(input.departureDate),
        departureDate: MoreThan(input.arrivalDate),
      },
    });

    if (overlapCount > 0) {
      throw new BadRequestException(
        'Room is already assigned to another active overlapping reservation',
      );
    }
  }

  private async validateDateRange(arrivalDate: string, departureDate: string): Promise<void> {
    if (departureDate <= arrivalDate) {
      throw new BadRequestException('Departure date must be after arrival date');
    }
  }

  private resolveSortColumn(sortBy = 'arrivalDate'): string {
    const sortColumn = reservationSortColumns[sortBy];

    if (!sortColumn) {
      throw new BadRequestException(`Unsupported reservation sort field: ${sortBy}`);
    }

    return sortColumn;
  }

  private getStayWorkspaceWarnings(reservation: ReservationEntity): Record<string, unknown>[] {
    const warnings: Record<string, unknown>[] = [];

    if (reservation.paymentStatus === ReservationPaymentStatus.PAYMENT_DUE) {
      warnings.push({
        type: 'PAYMENT_DUE',
        title: 'Payment due',
        description: 'This stay has an outstanding payment status.',
      });
    }

    if (reservation.guest?.vipStatus) {
      warnings.push({
        type: 'VIP_GUEST',
        title: 'VIP guest',
        description: 'Review preferences and service notes before taking stay actions.',
      });
    }

    if (reservation.guest?.blacklistStatus) {
      warnings.push({
        type: 'GUEST_RESTRICTED',
        title: 'Guest restricted',
        description: 'Guest profile is flagged and needs manager review.',
      });
    }

    return warnings;
  }

  private toCreatePersistenceFields(dto: CreateReservationDto): Partial<ReservationEntity> {
    const fields = { ...dto } as CreateReservationDto & {
      reservationCode?: string;
    };
    delete fields.reservationCode;

    return {
      ...fields,
      source: dto.source ?? ReservationSource.FRONT_DESK,
      sourceProvider: this.normalizeProvider(dto.sourceProvider),
      externalReservationId: dto.externalReservationId ?? null,
      externalConfirmationId: dto.externalConfirmationId ?? null,
      children: dto.children ?? 0,
      childAges: dto.children && dto.children > 0 ? (dto.childAges ?? null) : null,
      roomId: dto.roomId ?? null,
      notes: dto.notes ?? null,
      specialRequests: dto.specialRequests?.trim() || 'None',
    };
  }

  private toUpdatePersistenceFields(dto: UpdateReservationDto): Partial<ReservationEntity> {
    const fields = { ...dto } as UpdateReservationDto & {
      reservationCode?: string;
    };
    delete fields.reservationCode;

    const persistenceFields: Partial<ReservationEntity> = { ...fields };

    for (const field of ['roomId', 'notes', 'specialRequests'] as const) {
      if (field in dto) {
        persistenceFields[field] = dto[field] ?? null;
      }
    }

    if ('children' in dto || 'childAges' in dto) {
      const children = dto.children;
      if (children === 0) persistenceFields.childAges = null;
      else if ('childAges' in dto) persistenceFields.childAges = dto.childAges ?? null;
    }

    return persistenceFields;
  }

  private assertCommercialAmendmentAllowed(status: ReservationStatus): void {
    if (status === ReservationStatus.PENDING || status === ReservationStatus.CONFIRMED) return;
    if (status === ReservationStatus.CHECKED_IN) {
      throw new BadRequestException(
        'Checked-in reservations can only be amended commercially via stay extension',
      );
    }
    throw new BadRequestException(
      `Commercial amendments are not allowed on a ${status} reservation`,
    );
  }

  private commercialTrigger(
    current: { ratePlanId: string | null; roomTypeId: string; arrivalDate: string; departureDate: string; adults: number; childAges?: number[] | null },
    next: { ratePlanId: string | null; roomTypeId: string; arrivalDate: string; departureDate: string; adults: number; childAges?: number[] | null },
  ): ReservationRateSnapshotTrigger {
    const changes: ReservationRateSnapshotTrigger[] = [];
    if (current.arrivalDate !== next.arrivalDate || current.departureDate !== next.departureDate) {
      changes.push(ReservationRateSnapshotTrigger.DATE_CHANGE);
    }
    if (current.roomTypeId !== next.roomTypeId) {
      changes.push(ReservationRateSnapshotTrigger.ROOM_TYPE_CHANGE);
    }
    if ((current.ratePlanId ?? null) !== (next.ratePlanId ?? null)) {
      changes.push(ReservationRateSnapshotTrigger.RATE_PLAN_CHANGE);
    }
    const curChild = [...(current.childAges ?? [])].sort((a, b) => a - b).join(',');
    const nextChild = [...(next.childAges ?? [])].sort((a, b) => a - b).join(',');
    if (current.adults !== next.adults || curChild !== nextChild) {
      changes.push(ReservationRateSnapshotTrigger.OCCUPANCY_CHANGE);
    }
    return changes.length === 1 ? changes[0] : ReservationRateSnapshotTrigger.AMENDMENT;
  }

  private normalizeProvider(value?: string | null): string | null {
    return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
  }

  /**
   * Loads the single reservation holding a given external identity within a
   * property (guaranteed at most one by the partial unique index). Returned
   * with relations so idempotent-retry responses match the normal create shape.
   */
  private async findByExternalIdentity(
    propertyId: string,
    provider: string,
    externalReservationId: string,
  ): Promise<ReservationEntity | null> {
    return this.reservationsRepository.findOne({
      where: { propertyId, sourceProvider: provider, externalReservationId },
      relations: { guest: true, roomType: true, room: true },
    });
  }

  /**
   * Material booking contract equivalence for idempotent external retries.
   * Compares ONLY the fields that define the external booking (roomType, dates,
   * guest, occupancy, source, provider, and ratePlan WHEN the retry supplies
   * it). Operational fields (roomId, notes, specialRequests, paymentStatus,
   * externalConfirmationId) are intentionally excluded — a retry differing only
   * on those is still the same booking.
   */
  private materialReservationEquivalent(
    existing: ReservationEntity,
    dto: CreateReservationDto,
    provider: string | null,
  ): boolean {
    const childAges = (ages?: number[] | null) =>
      [...(ages ?? [])].sort((a, b) => a - b).join(',');
    const ratePlanMatches =
      dto.ratePlanId === undefined
        ? true
        : (existing.ratePlanId ?? null) === (dto.ratePlanId ?? null);
    return (
      existing.roomTypeId === dto.roomTypeId &&
      existing.arrivalDate === dto.arrivalDate &&
      existing.departureDate === dto.departureDate &&
      existing.guestId === dto.guestId &&
      existing.adults === dto.adults &&
      existing.children === (dto.children ?? 0) &&
      childAges(existing.childAges) === childAges(dto.childAges) &&
      existing.source === (dto.source ?? ReservationSource.FRONT_DESK) &&
      (existing.sourceProvider ?? null) === (provider ?? null) &&
      ratePlanMatches
    );
  }

  /**
   * Idempotent-retry resolution: an equivalent payload returns the existing
   * reservation (NO new reservation/inventory/snapshot/event side effects); a
   * conflicting payload for the same external identity is rejected with 409
   * EXTERNAL_RESERVATION_CONFLICT. A second reservation is never created.
   */
  private async resolveIdempotentRetry(
    existing: ReservationEntity,
    dto: CreateReservationDto,
    provider: string | null,
  ): Promise<ReservationEntity> {
    if (this.materialReservationEquivalent(existing, dto, provider)) {
      return this.findOne(existing.propertyId, existing.id);
    }
    throw new ConflictException({
      code: ApiErrorCode.EXTERNAL_RESERVATION_CONFLICT,
      message:
        'A reservation with this external identity already exists with different booking details',
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    );
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };

      if (driverError.code === '23505') {
        throw new ConflictException('Reservation code already exists for property');
      }
    }

    throw error;
  }
}
