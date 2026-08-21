import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PolicyResolverService } from '../policies/policy-resolver.service';
import { PropertyPolicyType } from '../policies/domain/property-policy-type.enum';
import { PropertyPolicyEntity } from '../policies/infrastructure/property-policy.entity';
import { RatePlanStatus } from './domain/rate-plan-status.enum';
import { MealPlan } from './domain/meal-plan.enum';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RatePlanRoomTypeEntity } from './infrastructure/rate-plan-room-type.entity';
import { RoomTypeDailyRateEntity } from './infrastructure/room-type-daily-rate.entity';
import { ChildPricingLine, ChildPricingService } from './child-pricing.service';

export interface ResolveRateInput {
  propertyId: string;
  ratePlanId: string;
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  childAges?: number[];
}

export type NightRateSource = 'DAILY_OVERRIDE' | 'BASE_RATE';

export interface ResolvedNight {
  date: string;
  source: NightRateSource;
  roomRate: string;
  extraAdultCharge: string;
  childCharge: string;
  nightTotal: string;
}

export interface ResolvedChildLine {
  age: number;
  category: string;
  source: string;
  amount: string;
}

export interface ResolvedRate {
  propertyId: string;
  ratePlanId: string;
  ratePlanCode: string;
  ratePlanName: string;
  roomTypeId: string;
  mealPlan: MealPlan;
  refundable: boolean;
  occupancy: {
    adults: number;
    children: number;
    baseOccupancy: number;
    extraAdults: number;
    adultPricedChildren: number;
    extraOccupantsCharged: number;
  };
  nights: ResolvedNight[];
  totals: { room: string; extraAdult: string; child: string; grandTotal: string };
  policies: Record<string, unknown>;
  childPricing: { lines: ResolvedChildLine[]; limitations: string[] };
}

const MS_PER_DAY = 86_400_000;
const centsToStr = (c: number): string => (c / 100).toFixed(2);
const strToCents = (s: string): number => Math.round(Number(s) * 100);

/**
 * Centralized, deterministic, READ-ONLY rate + policy resolver.
 * Never mutates reservations, inventory, room assignment, folios, taxes,
 * invoices, or payments. Money is computed in integer cents; rounding is
 * applied only at the per-line monetary boundary (nearest cent, half-up).
 */
@Injectable()
export class RateResolverService {
  constructor(
    @InjectRepository(RatePlanEntity)
    private readonly ratePlansRepository: Repository<RatePlanEntity>,
    @InjectRepository(RatePlanRoomTypeEntity)
    private readonly ratePlanRoomTypesRepository: Repository<RatePlanRoomTypeEntity>,
    @InjectRepository(RoomTypeDailyRateEntity)
    private readonly dailyRatesRepository: Repository<RoomTypeDailyRateEntity>,
    private readonly policyResolver: PolicyResolverService,
    private readonly childPricingService: ChildPricingService,
  ) {}

  async resolve(input: ResolveRateInput, manager?: EntityManager): Promise<ResolvedRate> {
    const nights = this.expandNights(input.arrivalDate, input.departureDate);
    const childAges = input.childAges ?? [];

    // Reuse the caller's transaction connection for all reads when a manager is
    // supplied (reservation create/amend), else fall back to the injected
    // repositories. Prevents connection-pool exhaustion under concurrent
    // creates without changing pricing semantics.
    const ratePlansRepo = manager ? manager.getRepository(RatePlanEntity) : this.ratePlansRepository;
    const ratePlanRoomTypesRepo = manager
      ? manager.getRepository(RatePlanRoomTypeEntity)
      : this.ratePlanRoomTypesRepository;
    const dailyRatesRepo = manager
      ? manager.getRepository(RoomTypeDailyRateEntity)
      : this.dailyRatesRepository;

    const ratePlan = await ratePlansRepo.findOne({
      where: { id: input.ratePlanId, propertyId: input.propertyId },
    });
    if (!ratePlan) {
      throw new NotFoundException(
        `Rate plan ${input.ratePlanId} was not found for property ${input.propertyId}`,
      );
    }
    if (ratePlan.status !== RatePlanStatus.ACTIVE) {
      throw new BadRequestException(`Rate plan ${ratePlan.code} is not active`);
    }

    const applicability = await ratePlanRoomTypesRepo.findOne({
      where: {
        propertyId: input.propertyId,
        ratePlanId: input.ratePlanId,
        roomTypeId: input.roomTypeId,
      },
    });
    if (!applicability) {
      throw new BadRequestException(
        `Rate plan ${ratePlan.code} is not applicable to room type ${input.roomTypeId}`,
      );
    }

    const baseOccupancy = applicability.baseOccupancy;
    const baseRateCents = strToCents(applicability.baseRate);
    const extraAdultCents = strToCents(applicability.extraAdultCharge);
    const extraChildRupees = Number(applicability.extraChildCharge ?? '0');

    const overrides = await dailyRatesRepo.find({
      where: {
        propertyId: input.propertyId,
        ratePlanId: input.ratePlanId,
        roomTypeId: input.roomTypeId,
      },
    });
    const overrideByDate = new Map(overrides.map((o) => [o.stayDate, o.amount]));

    const limitations = new Set<string>();
    const resolvedNights: ResolvedNight[] = [];
    const perChildCents = new Array<number>(childAges.length).fill(0);
    let classification: ChildPricingLine[] = [];
    let roomTotal = 0;
    let extraAdultTotal = 0;
    let childTotal = 0;

    for (const date of nights) {
      const override = overrideByDate.get(date);
      const source: NightRateSource = override != null ? 'DAILY_OVERRIDE' : 'BASE_RATE';
      const roomRateCents = override != null ? strToCents(override) : baseRateCents;
      if (!Number.isFinite(roomRateCents)) {
        throw new BadRequestException(`No valid rate could be resolved for ${date}`);
      }

      // Child classification + band charges, per night (nights=1) so
      // PERCENT_OF_ROOM_RATE uses that night's room rate and
      // RATE_PLAN_EXTRA_CHILD uses this rate plan's per-child charge.
      const childResult = await this.childPricingService.resolveChildPricing(
        input.propertyId,
        childAges,
        1,
        roomRateCents / 100,
        extraChildRupees,
        manager,
      );
      classification = childResult.lines;
      childResult.limitations.forEach((l) => limitations.add(l));

      // Adult-priced children (ADULT_PRICING band / above max age) are NOT
      // charged in the child bucket — they consume an occupant slot and are
      // billed via the rate plan's extra-adult charge (single mechanism, no
      // double-charge).
      let nightChildCents = 0;
      childResult.lines.forEach((line, k) => {
        if (!line.isAdultPriced) {
          const cents = Math.round(line.amount * 100);
          perChildCents[k] += cents;
          nightChildCents += cents;
        }
      });

      const adultPricedCount = childResult.lines.filter((l) => l.isAdultPriced).length;
      const extraOccupants = Math.max(0, input.adults + adultPricedCount - baseOccupancy);
      const nightExtraAdultCents = extraOccupants * extraAdultCents;

      const nightTotalCents = roomRateCents + nightExtraAdultCents + nightChildCents;
      roomTotal += roomRateCents;
      extraAdultTotal += nightExtraAdultCents;
      childTotal += nightChildCents;

      resolvedNights.push({
        date,
        source,
        roomRate: centsToStr(roomRateCents),
        extraAdultCharge: centsToStr(nightExtraAdultCents),
        childCharge: centsToStr(nightChildCents),
        nightTotal: centsToStr(nightTotalCents),
      });
    }

    const policies = await this.resolvePolicies(input.propertyId, input.ratePlanId, manager);

    const realExtraAdults = Math.max(0, input.adults - baseOccupancy);
    const adultPricedChildren = classification.filter((l) => l.isAdultPriced).length;
    const extraOccupantsCharged = Math.max(0, input.adults + adultPricedChildren - baseOccupancy);
    const childPricingLines = this.buildChildPricingLines(
      classification,
      perChildCents,
      input.adults,
      baseOccupancy,
      extraAdultCents,
      nights.length,
    );

    return {
      propertyId: input.propertyId,
      ratePlanId: input.ratePlanId,
      ratePlanCode: ratePlan.code,
      ratePlanName: ratePlan.name,
      roomTypeId: input.roomTypeId,
      mealPlan: ratePlan.mealPlan,
      refundable: ratePlan.refundable,
      occupancy: {
        adults: input.adults,
        children: childAges.length,
        baseOccupancy,
        extraAdults: realExtraAdults,
        adultPricedChildren,
        extraOccupantsCharged,
      },
      nights: resolvedNights,
      totals: {
        room: centsToStr(roomTotal),
        extraAdult: centsToStr(extraAdultTotal),
        child: centsToStr(childTotal),
        grandTotal: centsToStr(roomTotal + extraAdultTotal + childTotal),
      },
      policies,
      childPricing: { lines: childPricingLines, limitations: [...limitations] },
    };
  }

  /**
   * Builds auditable per-child pricing lines. Band-priced children carry their
   * accumulated band amount; adult-priced children (ADULT_PRICING / over-age)
   * carry the extra-adult charge only when they fall beyond base occupancy
   * (adults fill base occupancy first), otherwise the base occupancy absorbs
   * them at zero — never double-charged.
   */
  private buildChildPricingLines(
    classification: ChildPricingLine[],
    perChildCents: number[],
    adults: number,
    baseOccupancy: number,
    extraAdultCents: number,
    nights: number,
  ): ResolvedChildLine[] {
    const lines: ResolvedChildLine[] = [];
    let adultPricedOrdinal = 0;

    classification.forEach((line, k) => {
      if (line.isAdultPriced) {
        const isExtra = adults + adultPricedOrdinal >= baseOccupancy;
        adultPricedOrdinal += 1;
        lines[k] = {
          age: line.age,
          category: line.pricingMode,
          source: isExtra ? 'EXTRA_ADULT' : 'BASE_OCCUPANCY_ABSORBED',
          amount: centsToStr(isExtra ? extraAdultCents * nights : 0),
        };
      } else {
        lines[k] = {
          age: line.age,
          category: line.pricingMode,
          source: line.source,
          amount: centsToStr(perChildCents[k]),
        };
      }
    });

    return lines;
  }

  private async resolvePolicies(
    propertyId: string,
    ratePlanId: string,
    manager?: EntityManager,
  ): Promise<Record<string, unknown>> {
    const types: PropertyPolicyType[] = [
      PropertyPolicyType.CANCELLATION,
      PropertyPolicyType.NO_SHOW,
      PropertyPolicyType.INDIVIDUAL_DEPOSIT,
      PropertyPolicyType.GROUP_DEPOSIT,
      PropertyPolicyType.EARLY_CHECK_IN,
      PropertyPolicyType.LATE_CHECKOUT,
    ];
    // Sequential (not Promise.all): when a transaction manager is supplied all
    // reads share ONE connection, which cannot run queries concurrently. Six
    // lightweight lookups — negligible cost, and behaviour is identical.
    const resolved: Array<PropertyPolicyEntity | null> = [];
    for (const t of types) {
      resolved.push(await this.policyResolver.resolve(propertyId, t, ratePlanId, manager));
    }
    const out: Record<string, unknown> = {};
    types.forEach((t, i) => {
      const p = resolved[i];
      out[t] = p
        ? { source: p.ratePlanId ? 'RATE_PLAN' : 'PROPERTY', isActive: p.isActive, policy: p }
        : null;
    });
    return out;
  }

  private expandNights(arrivalDate: string, departureDate: string): string[] {
    const start = Date.parse(`${arrivalDate}T00:00:00.000Z`);
    const end = Date.parse(`${departureDate}T00:00:00.000Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new BadRequestException('arrivalDate/departureDate must be valid ISO dates');
    }
    if (end <= start) {
      throw new BadRequestException('departureDate must be after arrivalDate');
    }
    const nights: string[] = [];
    for (let t = start; t < end; t += MS_PER_DAY) nights.push(new Date(t).toISOString().slice(0, 10));
    return nights;
  }
}
