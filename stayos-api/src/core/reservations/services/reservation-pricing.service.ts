import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RateResolverService } from '../../rates/rate-resolver.service';
import { RatesService } from '../../rates/rates.service';

export interface CommercialInput {
  propertyId: string;
  ratePlanId: string | null;
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  childAges?: number[];
}

export interface CommercialResult {
  ratePlanId: string | null;
  rateSnapshot: Record<string, unknown>;
}

const SNAPSHOT_VERSION = 1;

/**
 * Builds the immutable commercial snapshot committed onto a reservation at
 * CONFIRMED. Pricing-only: it never touches inventory, rooms, folios, taxes,
 * invoices, or payments. If an explicit rate plan is invalid/inapplicable the
 * underlying resolver throws (caller's transaction rolls back). When no valid
 * plan is available it commits an explicit UNPRICED state — never 0.00.
 */
@Injectable()
export class ReservationPricingService {
  constructor(
    private readonly rateResolver: RateResolverService,
    private readonly ratesService: RatesService,
  ) {}

  /**
   * The single authoritative resolution of a reservation's EFFECTIVE rate plan,
   * reused for both commercial snapshotting and restriction-scope evaluation:
   * explicit applicable plan when supplied, else the property's default
   * applicable plan, else null (roomType-level baseline only).
   */
  async resolveEffectiveRatePlanId(input: {
    propertyId: string;
    roomTypeId: string;
    ratePlanId: string | null;
  }, manager?: EntityManager): Promise<string | null> {
    if (input.ratePlanId) return input.ratePlanId;
    const defaultPlan = await this.ratesService.findDefaultApplicableRatePlan(
      input.propertyId,
      input.roomTypeId,
      manager,
    );
    return defaultPlan?.id ?? null;
  }

  async buildCommercialSnapshot(input: CommercialInput, manager?: EntityManager): Promise<CommercialResult> {
    const ratePlanId = await this.resolveEffectiveRatePlanId({
      propertyId: input.propertyId,
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId,
    }, manager);

    if (!ratePlanId) {
      return {
        ratePlanId: null,
        rateSnapshot: {
          version: SNAPSHOT_VERSION,
          pricingStatus: 'UNPRICED',
          reason: 'NO_APPLICABLE_RATE_PLAN',
          snapshotAt: new Date().toISOString(),
          roomTypeId: input.roomTypeId,
          occupancy: { adults: input.adults, children: (input.childAges ?? []).length },
        },
      };
    }

    const resolved = await this.rateResolver.resolve({
      propertyId: input.propertyId,
      ratePlanId,
      roomTypeId: input.roomTypeId,
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      adults: input.adults,
      childAges: input.childAges,
    }, manager);

    return {
      ratePlanId,
      rateSnapshot: {
        version: SNAPSHOT_VERSION,
        pricingStatus: 'PRICED',
        snapshotAt: new Date().toISOString(),
        ratePlan: { id: resolved.ratePlanId, code: resolved.ratePlanCode },
        roomTypeId: resolved.roomTypeId,
        mealPlan: resolved.mealPlan,
        refundable: resolved.refundable,
        occupancy: resolved.occupancy,
        nights: resolved.nights,
        totals: resolved.totals,
        policies: resolved.policies,
        childPricing: resolved.childPricing,
      },
    };
  }
}
