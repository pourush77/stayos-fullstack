import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { ReservationRateSnapshotStatus } from '../domain/reservation-rate-snapshot-status.enum';
import { ReservationRateSnapshotTrigger } from '../domain/reservation-rate-snapshot-trigger.enum';
import { ReservationRateSnapshotEntity } from '../infrastructure/reservation-rate-snapshot.entity';
import { ReservationEntity } from '../infrastructure/reservation.entity';
import { ReservationPricingService } from './reservation-pricing.service';

export interface CommercialKey {
  propertyId: string;
  ratePlanId: string | null;
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  childAges?: number[] | null;
}

export interface AmendResult {
  changed: boolean;
  version: number;
}

/**
 * Owns the immutable, versioned commercial-snapshot lifecycle for reservations.
 * All writes happen inside the caller's transaction (an EntityManager is
 * passed in) so snapshot versioning commits/rolls back atomically with the
 * reservation amendment. Pricing is delegated to ReservationPricingService /
 * RateResolverService — this service never re-implements pricing.
 */
@Injectable()
export class ReservationRateSnapshotService {
  constructor(private readonly pricing: ReservationPricingService) {}

  /**
   * Normalized commercial-input hash. Both the runtime and the backfill
   * migration compute this from the same fields with the same algorithm so a
   * no-op amendment is detectable. childAges are sorted ascending.
   */
  computeCommercialHash(key: CommercialKey): string {
    const childStr = [...(key.childAges ?? [])].sort((a, b) => a - b).join(',');
    const raw = `v1|${key.ratePlanId ?? 'NONE'}|${key.roomTypeId}|${key.arrivalDate}|${key.departureDate}|${key.adults}|${childStr}`;
    return createHash('md5').update(raw).digest('hex');
  }

  /**
   * Commits version 1 (INITIAL) for a reservation entering a priced state
   * (create-CONFIRMED / confirm). Idempotent: no-op if already versioned.
   * Sets the reservation mirror fields; the caller persists the reservation.
   */
  async recordInitialVersion(
    manager: EntityManager,
    reservation: ReservationEntity,
    key: CommercialKey,
    reason: string | null = null,
  ): Promise<void> {
    if (reservation.rateSnapshotVersion != null) return;

    const commercial = await this.pricing.buildCommercialSnapshot({
      propertyId: key.propertyId,
      ratePlanId: key.ratePlanId,
      roomTypeId: key.roomTypeId,
      arrivalDate: key.arrivalDate,
      departureDate: key.departureDate,
      adults: key.adults,
      childAges: key.childAges ?? undefined,
    });

    const repository = manager.getRepository(ReservationRateSnapshotEntity);
    await repository.save(
      repository.create({
        reservationId: reservation.id,
        propertyId: reservation.propertyId,
        version: 1,
        status: ReservationRateSnapshotStatus.ACTIVE,
        trigger: ReservationRateSnapshotTrigger.INITIAL,
        reason,
        ratePlanId: commercial.ratePlanId,
        commercialInputHash: this.computeCommercialHash({ ...key, ratePlanId: commercial.ratePlanId }),
        snapshot: commercial.rateSnapshot,
        effectiveFrom: new Date(),
        supersededAt: null,
        supersededByVersion: null,
      }),
    );

    reservation.ratePlanId = commercial.ratePlanId;
    reservation.rateSnapshot = commercial.rateSnapshot;
    reservation.rateSnapshotVersion = 1;
  }

  /**
   * Re-prices a commercial amendment. If the normalized inputs are unchanged
   * (commercial no-op) it makes NO change and returns changed=false. Otherwise
   * it supersedes the current ACTIVE row and inserts a new immutable version,
   * then updates the reservation mirror. The caller persists the reservation.
   */
  async amend(
    manager: EntityManager,
    reservation: ReservationEntity,
    key: CommercialKey,
    trigger: ReservationRateSnapshotTrigger,
    reason: string | null = null,
  ): Promise<AmendResult> {
    const repository = manager.getRepository(ReservationRateSnapshotEntity);
    const active = await repository.findOne({
      where: { reservationId: reservation.id, status: ReservationRateSnapshotStatus.ACTIVE },
    });

    if (active && active.commercialInputHash === this.computeCommercialHash(key)) {
      return { changed: false, version: active.version };
    }

    const commercial = await this.pricing.buildCommercialSnapshot({
      propertyId: key.propertyId,
      ratePlanId: key.ratePlanId,
      roomTypeId: key.roomTypeId,
      arrivalDate: key.arrivalDate,
      departureDate: key.departureDate,
      adults: key.adults,
      childAges: key.childAges ?? undefined,
    });

    const newVersion = (active?.version ?? 0) + 1;

    if (active) {
      active.status = ReservationRateSnapshotStatus.SUPERSEDED;
      active.supersededAt = new Date();
      active.supersededByVersion = newVersion;
      await repository.save(active);
    }

    await repository.save(
      repository.create({
        reservationId: reservation.id,
        propertyId: reservation.propertyId,
        version: newVersion,
        status: ReservationRateSnapshotStatus.ACTIVE,
        trigger,
        reason,
        ratePlanId: commercial.ratePlanId,
        commercialInputHash: this.computeCommercialHash({ ...key, ratePlanId: commercial.ratePlanId }),
        snapshot: commercial.rateSnapshot,
        effectiveFrom: new Date(),
        supersededAt: null,
        supersededByVersion: null,
      }),
    );

    reservation.ratePlanId = commercial.ratePlanId;
    reservation.rateSnapshot = commercial.rateSnapshot;
    reservation.rateSnapshotVersion = newVersion;
    return { changed: true, version: newVersion };
  }
}
