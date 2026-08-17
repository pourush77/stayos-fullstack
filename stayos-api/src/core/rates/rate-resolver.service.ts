import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicyResolverService } from '../policies/policy-resolver.service';
import { PropertyPolicyType } from '../policies/domain/property-policy-type.enum';
import { RatePlanStatus } from './domain/rate-plan-status.enum';
import { MealPlan } from './domain/meal-plan.enum';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RatePlanRoomTypeEntity } from './infrastructure/rate-plan-room-type.entity';
import { RoomTypeDailyRateEntity } from './infrastructure/room-type-daily-rate.entity';
import { ChildPricingService } from './child-pricing.service';

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

export interface ResolvedRate {
  propertyId: string;
  ratePlanId: string;
  ratePlanCode: string;
  roomTypeId: string;
  mealPlan: MealPlan;
  refundable: boolean;
  occupancy: { adults: number; children: number; baseOccupancy: number; extraAdults: number };
  nights: ResolvedNight[];
  totals: { room: string; extraAdult: string; child: string; grandTotal: string };
  policies: Record<string, unknown>;
  childPricing: { limitations: string[] };
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

  async resolve(input: ResolveRateInput): Promise<ResolvedRate> {
    const nights = this.expandNights(input.arrivalDate, input.departureDate);
    const childAges = input.childAges ?? [];

    const ratePlan = await this.ratePlansRepository.findOne({
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

    const applicability = await this.ratePlanRoomTypesRepository.findOne({
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
    const extraAdults = Math.max(0, input.adults - baseOccupancy);

    const overrides = await this.dailyRatesRepository.find({
      where: {
        propertyId: input.propertyId,
        ratePlanId: input.ratePlanId,
        roomTypeId: input.roomTypeId,
      },
    });
    const overrideByDate = new Map(overrides.map((o) => [o.stayDate, o.amount]));

    const limitations = new Set<string>();
    const resolvedNights: ResolvedNight[] = [];
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

      const nightExtraAdultCents = extraAdults * extraAdultCents;

      // Child charges delegated to the existing child-pricing behaviour, per
      // night (nights=1) so PERCENT_OF_ROOM_RATE uses that night's room rate.
      const childResult = await this.childPricingService.resolveChildPricing(
        input.propertyId,
        childAges,
        1,
        roomRateCents / 100,
      );
      const nightChildCents = Math.round(childResult.total * 100);
      childResult.limitations.forEach((l) => limitations.add(l));

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

    const policies = await this.resolvePolicies(input.propertyId, input.ratePlanId);

    return {
      propertyId: input.propertyId,
      ratePlanId: input.ratePlanId,
      ratePlanCode: ratePlan.code,
      roomTypeId: input.roomTypeId,
      mealPlan: ratePlan.mealPlan,
      refundable: ratePlan.refundable,
      occupancy: { adults: input.adults, children: childAges.length, baseOccupancy, extraAdults },
      nights: resolvedNights,
      totals: {
        room: centsToStr(roomTotal),
        extraAdult: centsToStr(extraAdultTotal),
        child: centsToStr(childTotal),
        grandTotal: centsToStr(roomTotal + extraAdultTotal + childTotal),
      },
      policies,
      childPricing: { limitations: [...limitations] },
    };
  }

  private async resolvePolicies(
    propertyId: string,
    ratePlanId: string,
  ): Promise<Record<string, unknown>> {
    const types: PropertyPolicyType[] = [
      PropertyPolicyType.CANCELLATION,
      PropertyPolicyType.NO_SHOW,
      PropertyPolicyType.INDIVIDUAL_DEPOSIT,
      PropertyPolicyType.GROUP_DEPOSIT,
      PropertyPolicyType.EARLY_CHECK_IN,
      PropertyPolicyType.LATE_CHECKOUT,
    ];
    const resolved = await Promise.all(
      types.map((t) => this.policyResolver.resolve(propertyId, t, ratePlanId)),
    );
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
