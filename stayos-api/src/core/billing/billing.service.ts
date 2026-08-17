import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { ReservationRateSnapshotEntity } from '../reservations/infrastructure/reservation-rate-snapshot.entity';
import { ReservationRateSnapshotStatus } from '../reservations/domain/reservation-rate-snapshot-status.enum';
import { ReservationStatus } from '../reservations/domain/reservation-status.enum';
import { ReservationPaymentStatus } from '../reservations/domain/reservation-payment-status.enum';
import { FolioChargeEntity } from './infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from './infrastructure/folio-payment.entity';
import { FolioEntity } from './infrastructure/folio.entity';
import { FolioStatus } from './domain/folio-status.enum';
import { FolioPaymentMethod } from './domain/folio-payment-method.enum';
import { CreateFolioChargeDto } from './dto/create-folio-charge.dto';
import { CreateFolioPaymentDto } from './dto/create-folio-payment.dto';
import { calculateTotals } from './billing.mapper';
import { toCents, fromCents } from './domain/money';
import { FolioChargeStatus } from './domain/folio-charge-status.enum';
import { ChildPricingService } from '../rates/child-pricing.service';
import { FolioChargeType } from './domain/folio-charge-type.enum';
import { TaxService } from '../rates/tax.service';

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
    private readonly taxService: TaxService,
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
      relations: { property: true, guest: true, reservation: { room: true }, charges: true, payments: true },
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
      await this.generateRoomChargesFromSnapshot(manager, created.id, propertyId, reservation, activeSnapshot);
      return created;
    });

    return this.getFolio(propertyId, folio.id);
  }

  private async loadActiveSnapshot(reservationId: string): Promise<ReservationRateSnapshotEntity | null> {
    return this.snapshotsRepository.findOne({
      where: { reservationId, status: ReservationRateSnapshotStatus.ACTIVE },
    });
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
  ): Promise<void> {
    if (!activeSnapshot) return;
    const snap = (activeSnapshot.snapshot ?? {}) as {
      pricingStatus?: string;
      nights?: unknown[];
      totals?: { grandTotal?: string };
    };
    if (snap.pricingStatus !== 'PRICED') return;

    const grandTotalCents = toCents(snap.totals?.grandTotal);
    if (grandTotalCents <= 0) return;

    const nights = Array.isArray(snap.nights) && snap.nights.length > 0
      ? snap.nights.length
      : this.calculateNights(reservation.arrivalDate, reservation.departureDate);
    const unitCents = nights > 0 ? Math.round(grandTotalCents / nights) : grandTotalCents;
    const roomTax = await this.taxService.calculateForProperty(propertyId, grandTotalCents / 100);

    await manager.getRepository(FolioChargeEntity).save(
      manager.getRepository(FolioChargeEntity).create({
        folioId,
        type: FolioChargeType.ROOM,
        status: FolioChargeStatus.POSTED,
        rateSnapshotId: activeSnapshot.id,
        rateSnapshotVersion: activeSnapshot.version,
        description: `Room charges - ${nights} night${nights === 1 ? '' : 's'} (snapshot v${activeSnapshot.version})`,
        quantity: nights,
        unitAmount: fromCents(unitCents),
        amount: fromCents(grandTotalCents),
        taxAmount: roomTax.taxAmount,
        chargedAt: new Date(),
      }),
    );
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
    const reservation = await this.reservationsRepository.findOne({ where: { id: reservationId, propertyId } });
    if (!reservation) throw new NotFoundException(`Reservation ${reservationId} was not found`);
    const existingFolio = await this.foliosRepository.findOne({ where: { reservationId, propertyId } });
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

    const active = await manager.getRepository(ReservationRateSnapshotEntity).findOne({
      where: { reservationId, status: ReservationRateSnapshotStatus.ACTIVE },
    });
    if (!active || (active.snapshot as { pricingStatus?: string })?.pricingStatus !== 'PRICED') return;

    const repo = manager.getRepository(FolioChargeEntity);
    const livePosted = await repo.find({
      where: { folioId: existingFolio.id, type: FolioChargeType.ROOM, status: FolioChargeStatus.POSTED },
    });
    const snapshotDriven = livePosted.filter((c) => c.rateSnapshotId != null);
    if (snapshotDriven.length > 0 && snapshotDriven.every((c) => c.rateSnapshotVersion === active.version)) {
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
          chargedAt: new Date(),
          createdByUserId: actorUserId ?? null,
        }),
      );
      await repo.update({ id: original.id }, { status: FolioChargeStatus.REVERSED });
    }
    await this.generateRoomChargesFromSnapshot(manager, existingFolio.id, propertyId, reservation, active);
    await folioRepo.update({ id: existingFolio.id }, { updatedAt: new Date() });
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
    const taxAmount = dto.taxAmount ? parseFloat(dto.taxAmount) : 0;
    const chargedAt = dto.chargedAt ? new Date(dto.chargedAt) : new Date();

    const charge = this.chargesRepository.create({
      folioId,
      type: dto.type,
      description: dto.description,
      quantity,
      unitAmount: unit.toFixed(2),
      amount: amount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      chargedAt,
      createdByUserId: actorUserId ?? null,
    });
    await this.chargesRepository.save(charge);
    await this.foliosRepository.update({ id: folioId }, { updatedAt: new Date() });
    return this.getFolio(propertyId, folioId);
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
          description: `Reversal: ${original.description}${reason ? ` (${reason})` : ''}`.slice(0, 160),
          quantity: original.quantity,
          unitAmount: (-toCents(original.unitAmount) / 100).toFixed(2),
          amount: (-toCents(original.amount) / 100).toFixed(2),
          taxAmount: (-toCents(original.taxAmount) / 100).toFixed(2),
          chargedAt: new Date(),
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
    const folio = await this.getFolio(propertyId, folioId);
    if (folio.status === FolioStatus.VOID) {
      throw new BadRequestException('Cannot record payments on a voided folio');
    }
    const amount = parseFloat(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }
    const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

    const payment = this.paymentsRepository.create({
      folioId,
      method: dto.method,
      amount: amount.toFixed(2),
      reference: dto.reference ?? null,
      notes: dto.notes ?? null,
      receivedAt,
      receivedByUserId: actorUserId ?? null,
    });
    await this.paymentsRepository.save(payment);

    // Update reservation payment status based on totals
    const updatedFolio = await this.getFolio(propertyId, folioId);
    const totals = calculateTotals(updatedFolio.charges, updatedFolio.payments);
    const balanceCents = toCents(totals.balance);
    const paidCents = toCents(totals.paid);
    let paymentStatus: ReservationPaymentStatus = ReservationPaymentStatus.PAYMENT_DUE;
    if (balanceCents <= 0 && paidCents > 0) paymentStatus = ReservationPaymentStatus.PAID;
    else if (paidCents > 0) paymentStatus = ReservationPaymentStatus.PARTIALLY_PAID;
    await this.reservationsRepository.update(
      { id: updatedFolio.reservationId, propertyId },
      { paymentStatus },
    );

    return this.getFolio(propertyId, folioId);
  }

  async settleFolio(propertyId: string, folioId: string): Promise<FolioEntity> {
    const folio = await this.getFolio(propertyId, folioId);
    if (folio.status === FolioStatus.SETTLED) return folio;
    if (folio.status === FolioStatus.VOID) {
      throw new BadRequestException('Voided folios cannot be settled');
    }
    const totals = calculateTotals(folio.charges, folio.payments);
    const balanceCents = toCents(totals.balance);
    if (balanceCents > 0) {
      throw new BadRequestException(`Folio has an outstanding balance of ${totals.balance}`);
    }
    await this.foliosRepository.update(
      { id: folioId },
      { status: FolioStatus.SETTLED, settledAt: new Date() },
    );
    await this.reservationsRepository.update(
      { id: folio.reservationId, propertyId },
      { paymentStatus: ReservationPaymentStatus.PAID },
    );
    return this.getFolio(propertyId, folioId);
  }

  private calculateNights(arrival: string, departure: string): number {
    const arr = new Date(arrival);
    const dep = new Date(departure);
    if (Number.isNaN(arr.getTime()) || Number.isNaN(dep.getTime())) return 0;
    return Math.max(
      0,
      Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)),
    );
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
