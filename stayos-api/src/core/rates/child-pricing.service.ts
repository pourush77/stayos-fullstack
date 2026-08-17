import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ChildPricingMode } from './domain/child-pricing-mode.enum';
import { ChildAgeBandEntity } from './infrastructure/child-age-band.entity';
import { GuestPricingPolicyEntity } from './infrastructure/guest-pricing-policy.entity';

export type ChildPricingLine = {
  age: number;
  pricingMode: ChildPricingMode | 'ABOVE_MAXIMUM_CHILD_AGE';
  label: string;
  amount: number;
  /** True when the child consumes an occupant slot billed via extra-adult (not the child bucket). */
  isAdultPriced: boolean;
  /** Auditable source of this child's amount. */
  source: string;
};

export type ChildPricingResult = {
  lines: ChildPricingLine[];
  total: number;
  limitations: string[];
};

@Injectable()
export class ChildPricingService {
  constructor(
    @InjectRepository(GuestPricingPolicyEntity)
    private readonly guestPricingPoliciesRepository: Repository<GuestPricingPolicyEntity>,
    @InjectRepository(ChildAgeBandEntity)
    private readonly childAgeBandsRepository: Repository<ChildAgeBandEntity>,
  ) {}

  async validateReservationChildAges(
    propertyId: string,
    children: number,
    childAges?: number[] | null,
  ): Promise<void> {
    if (children <= 0) return;

    const policy = await this.getActivePolicy(propertyId);
    if (!policy?.ageBasedChildPricingEnabled) return;

    this.validateAgePayload(children, childAges);
    await this.resolveChildPricing(propertyId, childAges ?? [], 1, 0);
  }

  async resolveChildPricing(
    propertyId: string,
    childAges: number[],
    nights: number,
    nightlyRoomRate: number,
    extraChildChargePerNight = 0,
    manager?: EntityManager,
  ): Promise<ChildPricingResult> {
    const policy = await this.getActivePolicy(propertyId, manager);
    if (!policy?.ageBasedChildPricingEnabled || childAges.length === 0) {
      return { lines: [], total: 0, limitations: [] };
    }

    const bandsRepo = manager
      ? manager.getRepository(ChildAgeBandEntity)
      : this.childAgeBandsRepository;
    const bands = await bandsRepo.find({
      where: { guestPricingPolicyId: policy.id, isActive: true },
      order: { minAge: 'ASC', displayOrder: 'ASC' },
    });

    const lines: ChildPricingLine[] = [];
    const limitations = new Set<string>();

    for (const age of childAges) {
      this.validateAge(age);

      // Above the maximum child age => treated as an extra adult occupant,
      // billed via the rate plan's extra-adult charge (resolver-side), never
      // in the child bucket.
      if (age > policy.maximumChildAge) {
        lines.push({
          age,
          pricingMode: 'ABOVE_MAXIMUM_CHILD_AGE',
          label: 'Adult pricing',
          amount: 0,
          isAdultPriced: true,
          source: 'ABOVE_MAXIMUM_CHILD_AGE',
        });
        continue;
      }

      const matches = bands.filter((band) => age >= band.minAge && age <= band.maxAge);
      if (matches.length !== 1) {
        throw new BadRequestException(`Child age ${age} must resolve to exactly one age band`);
      }

      const band = matches[0];
      const isAdultPriced = band.pricingMode === ChildPricingMode.ADULT_PRICING;
      const amount = isAdultPriced
        ? 0
        : this.calculateBandAmount(band, nights, nightlyRoomRate, extraChildChargePerNight);

      lines.push({
        age,
        pricingMode: band.pricingMode,
        label: band.label,
        amount,
        isAdultPriced,
        source: isAdultPriced ? 'ADULT_PRICING' : this.bandSource(band.pricingMode),
      });
    }

    return {
      lines,
      total: lines.reduce((sum, line) => sum + line.amount, 0),
      limitations: [...limitations],
    };
  }

  private async getActivePolicy(
    propertyId: string,
    manager?: EntityManager,
  ): Promise<GuestPricingPolicyEntity | null> {
    const repo = manager
      ? manager.getRepository(GuestPricingPolicyEntity)
      : this.guestPricingPoliciesRepository;
    return repo.findOne({
      where: { propertyId, isActive: true },
    });
  }

  private validateAgePayload(children: number, childAges?: number[] | null): void {
    if (!Array.isArray(childAges)) {
      throw new BadRequestException('Child ages are required when children are selected');
    }

    if (childAges.length !== children) {
      throw new BadRequestException('Child ages must match the selected child count');
    }

    childAges.forEach((age) => this.validateAge(age));
  }

  private validateAge(age: number): void {
    if (!Number.isInteger(age) || age < 0) {
      throw new BadRequestException('Each child age must be a non-negative whole number');
    }
  }

  private bandSource(mode: ChildPricingMode): string {
    switch (mode) {
      case ChildPricingMode.FREE:
        return 'BAND_FREE';
      case ChildPricingMode.FIXED_PER_NIGHT:
        return 'BAND_FIXED_PER_NIGHT';
      case ChildPricingMode.PERCENT_OF_ROOM_RATE:
        return 'BAND_PERCENT_OF_ROOM_RATE';
      case ChildPricingMode.RATE_PLAN_EXTRA_CHILD:
        return 'RATE_PLAN_EXTRA_CHILD';
      default:
        return 'BAND';
    }
  }

  private calculateBandAmount(
    band: ChildAgeBandEntity,
    nights: number,
    nightlyRoomRate: number,
    extraChildChargePerNight: number,
  ): number {
    switch (band.pricingMode) {
      case ChildPricingMode.FREE:
      case ChildPricingMode.ADULT_PRICING:
        return 0;
      case ChildPricingMode.FIXED_PER_NIGHT:
        return Number(band.fixedAmount ?? 0) * nights;
      case ChildPricingMode.PERCENT_OF_ROOM_RATE:
        return nightlyRoomRate * nights * (Number(band.percentage ?? 0) / 100);
      case ChildPricingMode.RATE_PLAN_EXTRA_CHILD:
        return extraChildChargePerNight * nights;
      default:
        return 0;
    }
  }
}
