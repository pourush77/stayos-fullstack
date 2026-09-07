import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { BusinessDateService } from '../properties/services/business-date.service';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { ReservationRateSnapshotEntity } from '../reservations/infrastructure/reservation-rate-snapshot.entity';
import { ReservationRateSnapshotStatus } from '../reservations/domain/reservation-rate-snapshot-status.enum';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { ReservationPaymentStatus } from '../reservations/domain/reservation-payment-status.enum';
import { AccommodationPostingMode } from '../reservations/domain/accommodation-posting-mode.enum';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import { FolioEntity } from './infrastructure/folio.entity';
import { FolioStatus } from './domain/folio-status.enum';
import { FolioPaymentMethod } from './domain/folio-payment-method.enum';
import { FolioPaymentType } from './domain/folio-payment-type.enum';
import { CreateFolioChargeDto } from './dto/create-folio-charge.dto';
import { CreateFolioPaymentDto } from './dto/create-folio-payment.dto';
import { CreateFolioRefundDto } from './dto/create-folio-refund.dto';
import { calculateTotals } from './billing.mapper';
import { toCents, fromCents } from './domain/money';
import { FolioChargeStatus } from './domain/folio-charge-status.enum';
import { ChildPricingService } from '../rates/child-pricing.service';
import { FolioChargeType } from './domain/folio-charge-type.enum';
import { GstService } from '../rates/gst.service';
import { PlaceOfSupply, TaxSnapshot } from '../rates/domain/gst.types';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(FolioEntity)
    private readonly foliosRepository: Repository<FolioEntity>,
    @InjectRepository(FolioChargeEntity)
    private readonly chargesRepository: Repository<FolioChargeEntity>,
    @InjectRepository(FolioPaymentEntity)
    private readonly paymentsRepository: Repository<FolioPaymentEntity>,
    @InjectRepository(ReservationEntity)
    private readonly reservationsRepository: Repository<ReservationEntity>,
    @InjectRepository(ReservationRateSnapshotEntity)
    private readonly snapshotsRepository: Repository<ReservationRateSnapshotEntity>,
    private readonly propertiesService: PropertiesService,
    private readonly dataSource: DataSource,
    private readonly childPricingService: ChildPricingService,
    private readonly businessDateService: BusinessDateService,
    private readonly gstService: GstService,
  ) {}

  async listFolios(propertyId: string, status?: FolioStatus): Promise<FolioEntity[]> {
    await this.propertiesService.findOne(propertyId);
    const qb = this.foliosRepository
      .createQueryBuilder('folio')
      .leftJoinAndSelect('folio.guest', 'guest')
      .leftJoinAndSelect('folio.reservation', 'reservation')
      .leftJoinAndSelect('folio.charges', 'charges')
      .leftJoinAndSelect('folio.payments', 'payments')
      .where('folio.propertyId = :propertyId', { propertyId });
    if (status) qb.andWhere('folio.status = :status', { status });
    qb.orderBy('folio.createdAt', 'DESC');
    return qb.getMany();
  }

  async getFolio(propertyId: string, folioId: string): Promise<FolioEntity> {
    await this.propertiesService.findOne(propertyId);
    const folio = await this.foliosRepository.findOne({
      where: { id: folioId, propertyId },
      relations: {
        property: true,
        guest: true,
        reservation: { room: true },
        charges: true,
        payments: true,
      },
    });
    if (!folio) throw new NotFoundException(`Folio ${folioId} was not found`);
    return folio;
  }

  async getOrCreateFolioForReservation(
    propertyId: string,
    reservationId: string,
  ): Promise<FolioEntity> {
    await this.propertiesService.findOne(propertyId);
    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId, propertyId },
    });
    if (!reservation) throw new NotFoundException(`Reservation ${reservationId} was not found`);

    const existing = await this.foliosRepository.findOne({
      where: { reservationId, propertyId },
      relations: { guest: true, reservation: true, charges: true, payments: true },
    });
    if (existing) return this.getFolio(propertyId, existing.id);

    const folioNumber = await this.nextFolioNumber(propertyId);
    const activeSnapshot = await this.loadActiveSnapshot(reservationId);
    const folio = await this.dataSource.transaction(async (manager) => {
      const created = await manager.getRepository(FolioEntity).save(
        manager.getRepository(FolioEntity).create({
          propertyId,
          reservationId,
          guestId: reservation.guestId,
          folioNumber,
          status: FolioStatus.OPEN,
          currency: 'INR',
        }),
      );
      if (this.usesUpfrontFullStayPosting(reservation)) {
        await this.generateRoomChargesFromSnapshot(
          manager,
          created.id,
          propertyId,
          reservation,
          activeSnapshot,
        );
      }
      return created;
    });

    return this.getFolio(propertyId, folio.id);
  }

  private async loadActiveSnapshot(
    reservationId: string,
  ): Promise<ReservationRateSnapshotEntity | null> {
    return this.snapshotsRepository.findOne({
      where: { reservationId, status: ReservationRateSnapshotStatus.ACTIVE },
    });
  }

  private usesUpfrontFullStayPosting(reservation: ReservationEntity): boolean {
    return reservation.accommodationPostingMode === AccommodationPostingMode.UPFRONT_FULL_STAY;
  }

  private assertCanUseFullStayRoomChargeFlow(reservation: ReservationEntity): void {
    if (reservation.accommodationPostingMode === AccommodationPostingMode.NIGHTLY_V1) {
      throw new ConflictException({
        code: 'NIGHTLY_POSTING_MODE_FULL_STAY_RECONCILE_BLOCKED',
        message:
          'NIGHTLY_V1 reservations cannot use legacy full-stay room-charge reconciliation before nightly posting is implemented.',
      });
    }
  }

  /**
   * Posts ROOM charge(s) from the reservation's ACTIVE commercial snapshot —
   * billing CONSUMES the snapshot's priced totals (never recomputes rates). Each
   * charge carries rate_snapshot_id + version for a provable audit link. An
   * UNPRICED snapshot (or none, or zero total) posts NOTHING — no fabricated ₹0
   * ROOM charge. Runs on the caller's transaction manager (no nested txn / no
   * extra pool connection).
   */
  private async generateRoomChargesFromSnapshot(
    manager: EntityManager,
    folioId: string,
    propertyId: string,
    reservation: ReservationEntity,
    activeSnapshot: ReservationRateSnapshotEntity | null,
    actorUserId?: string | null,
  ): Promise<void> {
    if (!activeSnapshot) return;
    const snap = (activeSnapshot.snapshot ?? {}) as {
      pricingStatus?: string;
      ratePlan?: { code?: string; name?: string };
      nights?: unknown[];
      totals?: { grandTotal?: string };
    };
    if (snap.pricingStatus !== 'PRICED') return;

    const grandTotalCents = toCents(snap.totals?.grandTotal);
    if (grandTotalCents <= 0) return;

    const nights =
      Array.isArray(snap.nights) && snap.nights.length > 0
        ? snap.nights.length
        : this.calculateNights(reservation.arrivalDate, reservation.departureDate);
    const unitCents = nights > 0 ? Math.round(grandTotalCents / nights) : grandTotalCents;
    // GST on accommodation: place of supply is legally the hotel's location, so
    // ROOM is ALWAYS intra-state (CGST + SGST). The per-night rate drives the
    // tariff-slab match; the full stay total is the taxable value.
    const gst = await this.gstService.computeTax(
      {
        propertyId,
        chargeType: FolioChargeType.ROOM,
        taxableAmountCents: grandTotalCents,
        slabBasisAmount: unitCents / 100,
        placeOfSupply: PlaceOfSupply.INTRA_STATE,
        // Time of supply for accommodation is the stay, so GST rule resolution
        // uses the arrival date (advance bookings honor a rule that becomes
        // effective before check-in), then freezes it on the charge.
        chargeDate: new Date(reservation.arrivalDate),
      },
      manager,
    );

    await manager.getRepository(FolioChargeEntity).save(
      manager.getRepository(FolioChargeEntity).create({
        folioId,
        type: FolioChargeType.ROOM,
        status: FolioChargeStatus.POSTED,
        rateSnapshotId: activeSnapshot.id,
        rateSnapshotVersion: activeSnapshot.version,
        description: this.buildRoomChargeDescription(snap, nights, activeSnapshot.version),
        quantity: nights,
        unitAmount: fromCents(unitCents),
        amount: fromCents(grandTotalCents),
        taxAmount: gst.totalTax,
        hsnSac: gst.hsnSac,
        taxSnapshot: gst.applied ? this.toStoredSnapshot(gst) : null,
        chargedAt: new Date(),
        businessDate: this.businessDateService.getAuthoritativeDate(
          await this.propertiesService.findOne(propertyId),
        ),
        createdByUserId: actorUserId ?? null,
      }),
    );
  }

  private buildRoomChargeDescription(
    snap: { ratePlan?: { code?: string; name?: string } },
    nights: number,
    snapshotVersion: number,
  ): string {
    const planName = snap.ratePlan?.name?.trim();
    const planCode = snap.ratePlan?.code?.trim();
    const planLabel = planName
      ? planCode && !planName.includes(planCode)
        ? `${planName} (${planCode})`
        : planName
      : planCode;
    const stayLabel = `${nights} night${nights === 1 ? '' : 's'}`;
    return planLabel
      ? `Room charges · ${planLabel} · ${stayLabel} (snapshot v${snapshotVersion})`
      : `Room charges - ${stayLabel} (snapshot v${snapshotVersion})`;
  }

  private toStoredSnapshot(gst: TaxSnapshot): TaxSnapshot {
    return {
      hsnSac: gst.hsnSac,
      taxableValue: gst.taxableValue,
      placeOfSupply: gst.placeOfSupply,
      totalRate: gst.totalRate,
      totalTax: gst.totalTax,
      components: gst.components,
      taxRuleId: gst.taxRuleId,
      ruleEffectiveFrom: gst.ruleEffectiveFrom,
    };
  }

  /**
   * Negates a frozen tax snapshot for a REVERSAL row so aggregate GST
   * (CGST/SGST/IGST) nets to zero against the original, preserving full audit.
   */
  private negateTaxSnapshot(snap: TaxSnapshot | null): TaxSnapshot | null {
    if (!snap) return null;
    const neg = (v: string): string => fromCents(-toCents(v));
    return {
      ...snap,
      taxableValue: neg(snap.taxableValue),
      totalTax: neg(snap.totalTax),
      components: snap.components.map((c) => ({ ...c, amount: neg(c.amount) })),
    };
  }

  /**
   * Reconciles an OPEN folio's snapshot-driven ROOM charges against the
   * reservation's CURRENT ACTIVE snapshot using reverse + repost (1D-b). Only
   * touches snapshot-driven ROOM charges (rate_snapshot_id NOT NULL); legacy/
   * manual charges are never touched. Idempotent: if the live POSTED
   * snapshot-driven charges already reference the ACTIVE version, it's a no-op.
   * Transactional + cents-safe. No inventory/pricing side effects.
   */
  async reconcileRoomChargesForReservation(
    propertyId: string,
    reservationId: string,
    actorUserId?: string | null,
  ): Promise<FolioEntity> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId, propertyId },
    });
    if (!reservation) throw new NotFoundException(`Reservation ${reservationId} was not found`);
    const existingFolio = await this.foliosRepository.findOne({
      where: { reservationId, propertyId },
    });
    if (!existingFolio) throw new NotFoundException('No folio exists for this reservation');
    const folio = await this.getFolio(propertyId, existingFolio.id);
    if (folio.status !== FolioStatus.OPEN) {
      throw new BadRequestException('Cannot reconcile a folio that is not OPEN');
    }

    const active = await this.loadActiveSnapshot(reservationId);
    if (!active || (active.snapshot as { pricingStatus?: string })?.pricingStatus !== 'PRICED') {
      // Nothing to repost from; leave existing charges untouched.
      return folio;
    }
    this.assertCanUseFullStayRoomChargeFlow(reservation);
    await this.dataSource.transaction((manager) =>
      this.reconcileRoomChargesOnManager(manager, propertyId, reservationId, actorUserId),
    );
    return this.getFolio(propertyId, folio.id);
  }

  /**
   * Manager-aware reconcile core. Runs on the CALLER's transaction (no nested
   * txn / no extra pool connection) so a reservation amendment + snapshot
   * version + inventory delta + folio reconcile all commit or roll back
   * together. Idempotent no-op when the live POSTED snapshot-driven ROOM charges
   * already reference the ACTIVE snapshot version. Only touches snapshot-linked
   * ROOM charges (rate_snapshot_id NOT NULL); legacy/manual charges untouched.
   * Safe to call unconditionally after any amendment — it self-detects work.
   */
  async reconcileRoomChargesOnManager(
    manager: EntityManager,
    propertyId: string,
    reservationId: string,
    actorUserId?: string | null,
  ): Promise<void> {
    const folioRepo = manager.getRepository(FolioEntity);
    const existingFolio = await folioRepo.findOne({ where: { reservationId, propertyId } });
    if (!existingFolio || existingFolio.status !== FolioStatus.OPEN) return; // no folio / not OPEN => nothing

    const reservation = await manager
      .getRepository(ReservationEntity)
      .findOne({ where: { id: reservationId, propertyId } });
    if (!reservation) return;
    this.assertCanUseFullStayRoomChargeFlow(reservation);

    const active = await manager.getRepository(ReservationRateSnapshotEntity).findOne({
      where: { reservationId, status: ReservationRateSnapshotStatus.ACTIVE },
    });
    if (!active || (active.snapshot as { pricingStatus?: string })?.pricingStatus !== 'PRICED')
      return;

    const repo = manager.getRepository(FolioChargeEntity);
    const livePosted = await repo.find({
      where: {
        folioId: existingFolio.id,
        type: FolioChargeType.ROOM,
        status: FolioChargeStatus.POSTED,
      },
    });
    const snapshotDriven = livePosted.filter((c) => c.rateSnapshotId != null);
    if (
      snapshotDriven.length > 0 &&
      snapshotDriven.every((c) => c.rateSnapshotVersion === active.version)
    ) {
      return; // idempotent: already at ACTIVE version
    }

    for (const original of snapshotDriven) {
      await repo.save(
        repo.create({
          folioId: existingFolio.id,
          type: original.type,
          status: FolioChargeStatus.REVERSAL,
          reversalOfChargeId: original.id,
          rateSnapshotId: original.rateSnapshotId,
          rateSnapshotVersion: original.rateSnapshotVersion,
          description: `Reversal: ${original.description}`.slice(0, 160),
          quantity: original.quantity,
          unitAmount: fromCents(-toCents(original.unitAmount)),
          amount: fromCents(-toCents(original.amount)),
          taxAmount: fromCents(-toCents(original.taxAmount)),
          hsnSac: original.hsnSac,
          taxSnapshot: this.negateTaxSnapshot(original.taxSnapshot),
          chargedAt: new Date(),
          businessDate: this.businessDateService.getAuthoritativeDate(
            await this.propertiesService.findOne(propertyId),
          ),
          createdByUserId: actorUserId ?? null,
        }),
      );
      await repo.update({ id: original.id }, { status: FolioChargeStatus.REVERSED });
    }
    await this.generateRoomChargesFromSnapshot(
      manager,
      existingFolio.id,
      propertyId,
      reservation,
      active,
      actorUserId,
    );
    await folioRepo.update({ id: existingFolio.id }, { updatedAt: new Date() });
  }

  /**
   * Accommodation-posting-mode-aware reconciliation seam for INTERNAL reservation
   * amendments (commercial update + stay extension). Dispatches on the
   * reservation's posting mode:
   *  - UPFRONT_FULL_STAY: existing legacy reverse+repost full-stay reconciliation
   *    (behavior unchanged).
   *  - NIGHTLY_V1: financial NO-OP. Already-posted nightly ROOM charges are
   *    accounting history and must never be reversed/mutated/regenerated here; the
   *    amendment only supersedes the rate snapshot, and future service nights are
   *    posted by Night Audit from the new ACTIVE snapshot. Never posts nightly
   *    charges (Night Audit is the sole posting authority).
   * Deliberately NOT wired into the public manual reconcile endpoint, which keeps
   * failing fast for NIGHTLY_V1 via reconcileRoomChargesOnManager.
   */
  async reconcileAccommodationRoomChargesOnManager(
    manager: EntityManager,
    propertyId: string,
    reservationId: string,
    actorUserId?: string | null,
  ): Promise<void> {
    const reservation = await manager
      .getRepository(ReservationEntity)
      .findOne({ where: { id: reservationId, propertyId } });
    if (!reservation) return;
    if (reservation.accommodationPostingMode === AccommodationPostingMode.NIGHTLY_V1) {
      // Nightly history is immutable; amendment performs no ROOM ledger mutation.
      return;
    }
    await this.reconcileRoomChargesOnManager(manager, propertyId, reservationId, actorUserId);
  }

  async postNightlyAccommodationCharge(
    propertyId: string,
    reservationId: string,
    serviceDate: string,
    actorUserId?: string | null,
  ): Promise<FolioChargeEntity> {
    return this.dataSource.transaction((manager) =>
      this.postNightlyAccommodationChargeOnManager(
        manager,
        propertyId,
        reservationId,
        serviceDate,
        actorUserId,
      ),
    );
  }

  async postNightlyAccommodationChargeOnManager(
    manager: EntityManager,
    propertyId: string,
    reservationId: string,
    serviceDate: string,
    actorUserId?: string | null,
  ): Promise<FolioChargeEntity> {
    this.assertCalendarDate(serviceDate, 'serviceDate');
    const property = await this.propertiesService.findOne(propertyId);
    const reservationRepo = manager.getRepository(ReservationEntity);
    const folioRepo = manager.getRepository(FolioEntity);
    const snapshotRepo = manager.getRepository(ReservationRateSnapshotEntity);
    const chargeRepo = manager.getRepository(FolioChargeEntity);

    const reservation = await reservationRepo.findOne({ where: { id: reservationId, propertyId } });
    if (!reservation) throw new NotFoundException(`Reservation ${reservationId} was not found`);
    if (reservation.accommodationPostingMode !== AccommodationPostingMode.NIGHTLY_V1) {
      throw new BadRequestException('Nightly accommodation posting requires NIGHTLY_V1 mode');
    }
    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException('Nightly accommodation posting requires CHECKED_IN status');
    }
    if (serviceDate < reservation.arrivalDate || serviceDate >= reservation.departureDate) {
      throw new BadRequestException('serviceDate must be within the reservation stay dates');
    }

    const activeSnapshot = await snapshotRepo.findOne({
      where: { reservationId, status: ReservationRateSnapshotStatus.ACTIVE },
    });
    if (
      !activeSnapshot ||
      (activeSnapshot.snapshot as { pricingStatus?: string })?.pricingStatus !== 'PRICED'
    ) {
      throw new BadRequestException('Active priced rate snapshot is required');
    }

    const snap = activeSnapshot.snapshot as {
      ratePlan?: { code?: string; name?: string };
      nights?: Array<{
        date?: string;
        roomRate?: string;
        extraAdultCharge?: string;
        childCharge?: string;
        nightTotal?: string;
      }>;
    };
    const night = Array.isArray(snap.nights)
      ? snap.nights.find((candidate) => candidate.date === serviceDate)
      : undefined;
    if (!night) throw new BadRequestException('Active rate snapshot has no matching service night');

    const nightTotalCents = this.parsePositiveCents(String(night.nightTotal ?? ''), 'Nightly amount');
    const componentTotalCents =
      toCents(night.roomRate ?? '0') +
      toCents(night.extraAdultCharge ?? '0') +
      toCents(night.childCharge ?? '0');
    if (componentTotalCents !== nightTotalCents) {
      throw new BadRequestException('Snapshot nightly amount is inconsistent with nightly components');
    }

    let folio = await folioRepo.findOne({
      where: { reservationId, propertyId },
      relations: { property: true, guest: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (folio && folio.status !== FolioStatus.OPEN) {
      throw new BadRequestException('Cannot post nightly accommodation to a folio that is not OPEN');
    }
    if (!folio) {
      const folioNumber = await this.nextFolioNumber(propertyId);
      folio = await folioRepo.save(
        folioRepo.create({
          propertyId,
          reservationId,
          guestId: reservation.guestId,
          folioNumber,
          status: FolioStatus.OPEN,
          currency: 'INR',
        }),
      );
      folio = await folioRepo.findOne({
        where: { id: folio.id },
        relations: { property: true, guest: true },
      });
    }
    if (!folio) throw new NotFoundException('Unable to obtain folio for reservation');

    const idempotencyKey = this.buildNightlyAccommodationIdempotencyKey(
      propertyId,
      reservationId,
      activeSnapshot.id,
      activeSnapshot.version,
      serviceDate,
    );
    const existing = await chargeRepo.findOne({ where: { folioId: folio.id, idempotencyKey } });
    if (existing) return existing;

    const gst = await this.gstService.computeTax(
      {
        propertyId,
        chargeType: FolioChargeType.ROOM,
        taxableAmountCents: nightTotalCents,
        slabBasisAmount: nightTotalCents / 100,
        placeOfSupply: PlaceOfSupply.INTRA_STATE,
        chargeDate: new Date(serviceDate),
      },
      manager,
    );

    const charge = chargeRepo.create({
      folioId: folio.id,
      type: FolioChargeType.ROOM,
      status: FolioChargeStatus.POSTED,
      rateSnapshotId: activeSnapshot.id,
      rateSnapshotVersion: activeSnapshot.version,
      description: this.buildNightlyRoomChargeDescription(snap, serviceDate, activeSnapshot.version),
      quantity: 1,
      unitAmount: fromCents(nightTotalCents),
      amount: fromCents(nightTotalCents),
      taxAmount: gst.totalTax,
      hsnSac: gst.hsnSac,
      taxSnapshot: gst.applied ? this.toStoredSnapshot(gst) : null,
      chargedAt: new Date(),
      businessDate: this.businessDateService.getAuthoritativeDate(property),
      serviceDate,
      idempotencyKey,
      createdByUserId: actorUserId ?? null,
    });

    try {
      const saved = await chargeRepo.save(charge);
      await folioRepo.update({ id: folio.id }, { updatedAt: new Date() });
      return saved;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const duplicate = await chargeRepo.findOne({ where: { folioId: folio.id, idempotencyKey } });
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  private buildNightlyAccommodationIdempotencyKey(
    propertyId: string,
    reservationId: string,
    rateSnapshotId: string,
    rateSnapshotVersion: number,
    serviceDate: string,
  ): string {
    return `room-night:v1:property:${propertyId}:reservation:${reservationId}:snapshot:${rateSnapshotId}:version:${rateSnapshotVersion}:night:${serviceDate}`;
  }

  private buildNightlyRoomChargeDescription(
    snap: { ratePlan?: { code?: string; name?: string } },
    serviceDate: string,
    snapshotVersion: number,
  ): string {
    return `${this.buildRoomChargeDescription(snap, 1, snapshotVersion)} - ${serviceDate}`;
  }

  /**
   * Guard: a commercial amendment that WOULD create a new pricing snapshot must
   * not proceed against a financially closed (SETTLED) folio, because billing
   * can no longer reconcile it — reconcileRoomChargesOnManager only touches OPEN
   * folios, so the settled folio would silently drift onto a stale snapshot
   * version. We hard-block with a controlled domain 409 instead of reopening or
   * mutating settled history. VOID folios and OPEN folios do not block; a
   * reservation with no folio is always allowed. Centralized + manager-aware so
   * a future authorized reopen / credit-note workflow (Phase 1D-d/1F) can relax
   * this single rule without touching every amendment call site.
   */
  async assertCommercialAmendmentAllowedOnManager(
    manager: EntityManager,
    propertyId: string,
    reservationId: string,
  ): Promise<void> {
    const folio = await manager
      .getRepository(FolioEntity)
      .findOne({ where: { reservationId, propertyId } });
    if (folio && folio.status === FolioStatus.SETTLED) {
      throw new ConflictException({
        code: 'FOLIO_SETTLED_AMENDMENT_BLOCKED',
        message:
          'Cannot amend commercial terms while the folio is settled. Reopen the folio or issue a credit note first.',
      });
    }
  }

  async addCharge(
    propertyId: string,
    folioId: string,
    dto: CreateFolioChargeDto,
    actorUserId?: string | null,
  ): Promise<FolioEntity> {
    const folio = await this.getFolio(propertyId, folioId);
    if (folio.status !== FolioStatus.OPEN) {
      throw new BadRequestException('Cannot add charges to a folio that is not OPEN');
    }
    const quantity = dto.quantity ?? 1;
    const unit = parseFloat(dto.unitAmount);
    if (!Number.isFinite(unit)) throw new BadRequestException('unitAmount must be numeric');
    const amount = unit * quantity;
    const amountCents = Math.round(amount * 100);
    const chargedAt = dto.chargedAt ? new Date(dto.chargedAt) : new Date();

    // Tax resolution: an explicit taxAmount is honored as a manual override (no
    // GST snapshot). Otherwise the GST engine computes the breakdown for this
    // line's charge type. Place of supply defaults to the guest-vs-property
    // state comparison, or an explicit override on the DTO.
    let taxAmount = '0.00';
    let hsnSac: string | null = null;
    let taxSnapshot: TaxSnapshot | null = null;
    if (dto.taxAmount != null) {
      const explicit = parseFloat(dto.taxAmount);
      if (!Number.isFinite(explicit)) throw new BadRequestException('taxAmount must be numeric');
      taxAmount = explicit.toFixed(2);
      hsnSac = dto.hsnSac?.trim() || null;
    } else {
      const placeOfSupply =
        (dto.placeOfSupply as PlaceOfSupply | undefined) ??
        this.gstService.resolvePlaceOfSupply(
          folio.property?.state,
          folio.property?.stateCode,
          folio.guest?.state,
        );
      const gst = await this.gstService.computeTax({
        propertyId,
        chargeType: dto.type,
        taxableAmountCents: amountCents,
        slabBasisAmount: unit,
        placeOfSupply,
        chargeDate: chargedAt,
        hsnSacOverride: dto.hsnSac?.trim() || null,
      });
      taxAmount = gst.totalTax;
      hsnSac = gst.hsnSac;
      taxSnapshot = gst.applied ? this.toStoredSnapshot(gst) : null;
    }

    const charge = this.chargesRepository.create({
      folioId,
      type: dto.type,
      description: dto.description,
      quantity,
      unitAmount: unit.toFixed(2),
      amount: amount.toFixed(2),
      taxAmount,
      hsnSac,
      taxSnapshot,
      chargedAt,
      businessDate: this.businessDateService.getAuthoritativeDate(folio.property),
      createdByUserId: actorUserId ?? null,
    });
    await this.chargesRepository.save(charge);
    await this.foliosRepository.update({ id: folioId }, { updatedAt: new Date() });
    return this.getFolio(propertyId, folioId);
  }

  /**
   * Posts an ad-hoc charge (e.g. an early check-in / late checkout policy fee)
   * on the CALLER's transaction manager — no nested transaction. Reuses the GST
   * engine like addCharge. Idempotent per (folio, type, description): if a
   * matching POSTED charge already exists it is a safe no-op, so a retried
   * check-in/checkout never double-charges.
   */
  async postPolicyChargeOnManager(
    manager: EntityManager,
    propertyId: string,
    reservationId: string,
    input: { type: FolioChargeType; description: string; unitAmount: string },
    actorUserId?: string | null,
  ): Promise<void> {
    const amountCents = Math.round(parseFloat(input.unitAmount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return;

    const chargeRepo = manager.getRepository(FolioChargeEntity);
    const folioRepo = manager.getRepository(FolioEntity);

    let folio = await folioRepo.findOne({
      where: { reservationId, propertyId },
      relations: { property: true, guest: true },
    });
    if (folio && folio.status !== FolioStatus.OPEN) return;

    if (!folio) {
      const reservation = await manager
        .getRepository(ReservationEntity)
        .findOne({ where: { id: reservationId, propertyId } });
      if (!reservation) throw new NotFoundException(`Reservation ${reservationId} was not found`);
      const folioNumber = await this.nextFolioNumber(propertyId);
      const activeSnapshot = await manager
        .getRepository(ReservationRateSnapshotEntity)
        .findOne({ where: { reservationId, status: 'ACTIVE' as never } });
      folio = await folioRepo.save(
        folioRepo.create({
          propertyId,
          reservationId,
          guestId: reservation.guestId,
          folioNumber,
          status: FolioStatus.OPEN,
          currency: 'INR',
        }),
      );
      if (this.usesUpfrontFullStayPosting(reservation)) {
        await this.generateRoomChargesFromSnapshot(
          manager,
          folio.id,
          propertyId,
          reservation,
          activeSnapshot,
        );
      }
      folio = await folioRepo.findOne({
        where: { id: folio.id },
        relations: { property: true, guest: true },
      });
    }

    const existing = await chargeRepo.findOne({
      where: {
        folioId: folio!.id,
        type: input.type,
        description: input.description,
        status: FolioChargeStatus.POSTED,
      },
    });
    if (existing) return; // idempotent / retry-safe

    const placeOfSupply = this.gstService.resolvePlaceOfSupply(
      folio!.property?.state,
      folio!.property?.stateCode,
      folio!.guest?.state,
    );
    const gst = await this.gstService.computeTax(
      {
        propertyId,
        chargeType: input.type,
        taxableAmountCents: amountCents,
        slabBasisAmount: amountCents / 100,
        placeOfSupply,
        chargeDate: new Date(),
      },
      manager,
    );

    await chargeRepo.save(
      chargeRepo.create({
        folioId: folio!.id,
        type: input.type,
        status: FolioChargeStatus.POSTED,
        description: input.description,
        quantity: 1,
        unitAmount: fromCents(amountCents),
        amount: fromCents(amountCents),
        taxAmount: gst.totalTax,
        hsnSac: gst.hsnSac,
        taxSnapshot: gst.applied ? this.toStoredSnapshot(gst) : null,
        chargedAt: new Date(),
        businessDate: this.businessDateService.getAuthoritativeDate(folio!.property),
        createdByUserId: actorUserId ?? null,
      }),
    );
    await folioRepo.update({ id: folio!.id }, { updatedAt: new Date() });
  }

  /**
   * Reverses a POSTED charge WITHOUT destroying history: flips the original to
   * REVERSED and inserts a REVERSAL row with negated amount/tax pointing at it.
   * Totals net to zero for the pair (calculateTotals sums all rows). Idempotent:
   * re-voiding an already-REVERSED charge is a safe no-op. Transaction-safe.
   */
  async voidCharge(
    propertyId: string,
    folioId: string,
    chargeId: string,
    reason: string,
    actorUserId?: string | null,
  ): Promise<FolioEntity> {
    const folio = await this.getFolio(propertyId, folioId);
    if (folio.status !== FolioStatus.OPEN) {
      throw new BadRequestException('Cannot void charges on a folio that is not OPEN');
    }
    const original = (folio.charges ?? []).find((c) => c.id === chargeId);
    if (!original) throw new NotFoundException(`Charge ${chargeId} was not found on this folio`);

    if (original.status === FolioChargeStatus.REVERSED) {
      return folio; // idempotent no-op
    }
    if (original.status === FolioChargeStatus.REVERSAL) {
      throw new BadRequestException('A reversal row cannot itself be voided');
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(FolioChargeEntity);
      await repo.save(
        repo.create({
          folioId,
          type: original.type,
          status: FolioChargeStatus.REVERSAL,
          reversalOfChargeId: original.id,
          description: `Reversal: ${original.description}${reason ? ` (${reason})` : ''}`.slice(
            0,
            160,
          ),
          quantity: original.quantity,
          unitAmount: (-toCents(original.unitAmount) / 100).toFixed(2),
          amount: (-toCents(original.amount) / 100).toFixed(2),
          taxAmount: (-toCents(original.taxAmount) / 100).toFixed(2),
          hsnSac: original.hsnSac,
          taxSnapshot: this.negateTaxSnapshot(original.taxSnapshot),
          chargedAt: new Date(),
          businessDate: this.businessDateService.getAuthoritativeDate(folio.property),
          createdByUserId: actorUserId ?? null,
        }),
      );
      await repo.update({ id: original.id }, { status: FolioChargeStatus.REVERSED });
      await manager.getRepository(FolioEntity).update({ id: folioId }, { updatedAt: new Date() });
    });
    return this.getFolio(propertyId, folioId);
  }

  async addPayment(
    propertyId: string,
    folioId: string,
    dto: CreateFolioPaymentDto,
    actorUserId?: string | null,
  ): Promise<FolioEntity> {
    const property = await this.propertiesService.findOne(propertyId);
    const amountCents = this.parsePositiveCents(dto.amount, 'Payment amount');
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    // Transaction + row lock serializes concurrent payments on the same folio.
    // This is important because the outstanding balance must be checked against
    // the latest committed financial state before accepting another payment.
    return this.dataSource.transaction(async (manager) => {
      const folio = await this.lockFolio(manager, propertyId, folioId);

      if (folio.status !== FolioStatus.OPEN) {
        throw new BadRequestException(
          `Cannot record payments on a ${folio.status.toLowerCase()} folio`,
        );
      }

      const paymentsRepo = manager.getRepository(FolioPaymentEntity);

      // Preserve idempotency semantics before validating the current balance.
      // A retry of an already-successful request must return the existing result
      // rather than fail because that original payment reduced the balance.
      if (dto.idempotencyKey) {
        const existing = await paymentsRepo.findOne({
          where: { folioId, idempotencyKey: dto.idempotencyKey },
        });

        if (existing) {
          return this.getFolioOnManager(manager, propertyId, folioId);
        }
      }

      // StayOS does not currently support guest-credit / overpayment balances.
      // Validate against the live balance while holding the folio row lock so
      // concurrent payment attempts cannot both consume the same outstanding
      // amount.
      const totals = await this.computeTotalsOnManager(manager, folioId);
      const outstandingCents = toCents(totals.balance);

      if (outstandingCents <= 0) {
        throw new BadRequestException('This folio has no outstanding balance');
      }

      if (amountCents > outstandingCents) {
        throw new BadRequestException(
          `Payment amount cannot exceed the outstanding balance of ${fromCents(outstandingCents)}`,
        );
      }

      const paymentBusinessDate = this.businessDateService.getAuthoritativeDate(property);

      const payment = paymentsRepo.create({
        folioId,
        type: FolioPaymentType.PAYMENT,
        method: dto.method,
        amount: fromCents(amountCents),
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        idempotencyKey: dto.idempotencyKey ?? null,
        receivedAt,
        businessDate: paymentBusinessDate,
        receivedByUserId: actorUserId ?? null,
      });

      try {
        await paymentsRepo.save(payment);
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          return this.getFolioOnManager(manager, propertyId, folioId);
        }

        throw error;
      }

      await this.refreshReservationPaymentStatus(manager, propertyId, folio.reservationId);

      return this.getFolioOnManager(manager, propertyId, folioId);
    });
  }

  async addRefund(
    propertyId: string,
    folioId: string,
    dto: CreateFolioRefundDto,
    actorUserId?: string | null,
  ): Promise<FolioEntity> {
    const property = await this.propertiesService.findOne(propertyId);
    const amountCents = this.parsePositiveCents(dto.amount, 'Refund amount');
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    return this.dataSource.transaction(async (manager) => {
      const folio = await this.lockFolio(manager, propertyId, folioId);
      if (folio.status !== FolioStatus.OPEN) {
        throw new BadRequestException(
          `Cannot record refunds on a ${folio.status.toLowerCase()} folio`,
        );
      }
      const paymentsRepo = manager.getRepository(FolioPaymentEntity);
      const refundBusinessDate = this.businessDateService.getAuthoritativeDate(property);

      if (dto.idempotencyKey) {
        const existing = await paymentsRepo.findOne({
          where: { folioId, idempotencyKey: dto.idempotencyKey },
        });
        if (existing) return this.getFolioOnManager(manager, propertyId, folioId);
      }

      const original = await paymentsRepo.findOne({
        where: { id: dto.originalPaymentId, folioId },
      });
      if (!original || original.type !== FolioPaymentType.PAYMENT) {
        throw new NotFoundException('Original payment was not found on this folio');
      }

      // Cap: a refund cannot exceed the original payment less what has already
      // been refunded against it (also prevents double refunds).
      const priorRefunds = await paymentsRepo.find({
        where: { folioId, reversalOfPaymentId: original.id },
      });
      const originalCents = toCents(original.amount);
      const alreadyRefundedCents = priorRefunds.reduce(
        (s, r) => s + Math.abs(toCents(r.amount)),
        0,
      );
      const remainingCents = originalCents - alreadyRefundedCents;
      if (amountCents > remainingCents) {
        throw new BadRequestException(
          `Refund exceeds refundable amount for this payment (remaining ${fromCents(remainingCents)})`,
        );
      }

      const refund = paymentsRepo.create({
        folioId,
        type: FolioPaymentType.REFUND,
        method: dto.method ?? original.method,
        amount: fromCents(-amountCents),
        reversalOfPaymentId: original.id,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        idempotencyKey: dto.idempotencyKey ?? null,
        receivedAt,
        businessDate: refundBusinessDate,
        receivedByUserId: actorUserId ?? null,
      });
      try {
        await paymentsRepo.save(refund);
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          return this.getFolioOnManager(manager, propertyId, folioId);
        }
        throw error;
      }

      await this.refreshReservationPaymentStatus(manager, propertyId, folio.reservationId);
      return this.getFolioOnManager(manager, propertyId, folioId);
    });
  }

  async settleFolio(propertyId: string, folioId: string): Promise<FolioEntity> {
    await this.propertiesService.findOne(propertyId);
    return this.dataSource.transaction(async (manager) => {
      const folio = await this.lockFolio(manager, propertyId, folioId);
      if (folio.status === FolioStatus.SETTLED)
        return this.getFolioOnManager(manager, propertyId, folioId);
      if (folio.status === FolioStatus.VOID) {
        throw new BadRequestException('Voided folios cannot be settled');
      }
      const totals = await this.computeTotalsOnManager(manager, folioId);
      const balanceCents = toCents(totals.balance);
      // Settlement requires an EXACTLY zero balance.
      if (balanceCents > 0) {
        throw new BadRequestException(`Folio has an outstanding balance of ${totals.balance}`);
      }
      if (balanceCents < 0) {
        throw new BadRequestException(
          `Folio has an unrefunded credit balance of ${totals.creditBalance}. Refund the excess before settlement.`,
        );
      }
      await manager
        .getRepository(FolioEntity)
        .update({ id: folioId }, { status: FolioStatus.SETTLED, settledAt: new Date() });
      await manager
        .getRepository(ReservationEntity)
        .update(
          { id: folio.reservationId, propertyId },
          { paymentStatus: ReservationPaymentStatus.PAID },
        );
      return this.getFolioOnManager(manager, propertyId, folioId);
    });
  }

  /** Locks the bare folio row FOR UPDATE (no relations, to avoid outer-join lock errors). */
  private async lockFolio(
    manager: EntityManager,
    propertyId: string,
    folioId: string,
  ): Promise<FolioEntity> {
    const folio = await manager.getRepository(FolioEntity).findOne({
      where: { id: folioId, propertyId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!folio) throw new NotFoundException(`Folio ${folioId} was not found`);
    return folio;
  }

  private async getFolioOnManager(
    manager: EntityManager,
    propertyId: string,
    folioId: string,
  ): Promise<FolioEntity> {
    const folio = await manager.getRepository(FolioEntity).findOne({
      where: { id: folioId, propertyId },
      relations: {
        property: true,
        guest: true,
        reservation: { room: true },
        charges: true,
        payments: true,
      },
    });
    if (!folio) throw new NotFoundException(`Folio ${folioId} was not found`);
    return folio;
  }

  async getFolioTotals(propertyId: string, folioId: string) {
    const folio = await this.getFolio(propertyId, folioId);

    return calculateTotals(folio.charges ?? [], folio.payments ?? []);
  }

  private async computeTotalsOnManager(manager: EntityManager, folioId: string) {
    const [charges, payments] = await Promise.all([
      manager.getRepository(FolioChargeEntity).find({ where: { folioId } }),
      manager.getRepository(FolioPaymentEntity).find({ where: { folioId } }),
    ]);
    return calculateTotals(charges, payments);
  }

  private async refreshReservationPaymentStatus(
    manager: EntityManager,
    propertyId: string,
    reservationId: string,
  ): Promise<void> {
    const totals = await this.computeTotalsOnManager(
      manager,
      (await manager.getRepository(FolioEntity).findOne({ where: { reservationId, propertyId } }))!
        .id,
    );
    const balanceCents = toCents(totals.balance);
    const paidCents = toCents(totals.paid);
    let paymentStatus: ReservationPaymentStatus = ReservationPaymentStatus.PAYMENT_DUE;
    if (balanceCents <= 0 && paidCents > 0) paymentStatus = ReservationPaymentStatus.PAID;
    else if (paidCents > 0) paymentStatus = ReservationPaymentStatus.PARTIALLY_PAID;
    await manager
      .getRepository(ReservationEntity)
      .update({ id: reservationId, propertyId }, { paymentStatus });
  }

  private parsePositiveCents(value: string, label: string): number {
    const amount = parseFloat(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(`${label} must be positive`);
    }
    return Math.round(amount * 100);
  }

  private assertCalendarDate(value: string, label: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${label} must be a YYYY-MM-DD date`);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${label} must be a valid calendar date`);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === '23505';
  }

  private calculateNights(arrival: string, departure: string): number {
    const arr = new Date(arrival);
    const dep = new Date(departure);
    if (Number.isNaN(arr.getTime()) || Number.isNaN(dep.getTime())) return 0;
    return Math.max(0, Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private async nextFolioNumber(propertyId: string): Promise<string> {
    // Atomic per-property counter (own auto-committed statement, before any
    // transaction) — collision-safe under concurrency, no count()+1 race. Gaps
    // on rollback are acceptable and never produce a duplicate.
    const rows: Array<{ last_value: string | number }> = await this.dataSource.query(
      `INSERT INTO folio_number_counters (property_id, last_value)
       VALUES ($1, 1)
       ON CONFLICT (property_id)
       DO UPDATE SET last_value = folio_number_counters.last_value + 1, updated_at = now()
       RETURNING last_value`,
      [propertyId],
    );
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const seq = String(rows[0].last_value).padStart(5, '0');
    return `FO${yy}${mm}${dd}-${seq}`;
  }

  // Reservation status update helpers reserved for future workflow integration.

  async getOverviewSummary(propertyId: string): Promise<{
    openFolios: number;
    settledFolios: number;
    voidFolios: number;
    outstandingBalance: string;
    todayRevenue: string;
    monthRevenue: string;
  }> {
    await this.propertiesService.findOne(propertyId);
    const folios = await this.foliosRepository.find({
      where: { propertyId },
      relations: { charges: true, payments: true },
    });

    let openFolios = 0;
    let settledFolios = 0;
    let voidFolios = 0;
    let outstandingBalance = 0;
    let todayRevenue = 0;
    let monthRevenue = 0;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    for (const folio of folios) {
      if (folio.status === FolioStatus.OPEN) openFolios += 1;
      else if (folio.status === FolioStatus.SETTLED) settledFolios += 1;
      else voidFolios += 1;

      const totals = calculateTotals(folio.charges, folio.payments);
      const balance = parseFloat(totals.balance);
      if (balance > 0) outstandingBalance += balance;

      for (const payment of folio.payments ?? []) {
        const d = new Date(payment.receivedAt);
        const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const amount = parseFloat(payment.amount);
        if (!Number.isFinite(amount)) continue;
        if (dKey === todayKey) todayRevenue += amount;
        if (mKey === monthKey) monthRevenue += amount;
      }
    }

    return {
      openFolios,
      settledFolios,
      voidFolios,
      outstandingBalance: outstandingBalance.toFixed(2),
      todayRevenue: todayRevenue.toFixed(2),
      monthRevenue: monthRevenue.toFixed(2),
    };
  }
}
