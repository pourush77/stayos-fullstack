import { Injectable } from '@nestjs/common';
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

  async buildCommercialSnapshot(input: CommercialInput): Promise<CommercialResult> {
    let ratePlanId = input.ratePlanId;

    // Default-plan fallback only when caller omitted an explicit plan.
    if (!ratePlanId) {
      const defaultPlan = await this.ratesService.findDefaultApplicableRatePlan(
        input.propertyId,
        input.roomTypeId,
      );
      ratePlanId = defaultPlan?.id ?? null;
    }

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
    });

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
