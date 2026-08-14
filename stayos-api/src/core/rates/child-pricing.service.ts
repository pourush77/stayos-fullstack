import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChildPricingMode } from './domain/child-pricing-mode.enum';
import { ChildAgeBandEntity } from './infrastructure/child-age-band.entity';
import { GuestPricingPolicyEntity } from './infrastructure/guest-pricing-policy.entity';

export type ChildPricingLine = {
  age: number;
  pricingMode: ChildPricingMode | 'ABOVE_MAXIMUM_CHILD_AGE';
  label: string;
  amount: number;
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
  ): Promise<ChildPricingResult> {
    const policy = await this.getActivePolicy(propertyId);
    if (!policy?.ageBasedChildPricingEnabled || childAges.length === 0) {
      return { lines: [], total: 0, limitations: [] };
    }

    const bands = await this.childAgeBandsRepository.find({
      where: { guestPricingPolicyId: policy.id, isActive: true },
      order: { minAge: 'ASC', displayOrder: 'ASC' },
    });

    const lines: ChildPricingLine[] = [];
    const limitations = new Set<string>();

    for (const age of childAges) {
      this.validateAge(age);

      if (age > policy.maximumChildAge) {
        lines.push({
          age,
          pricingMode: 'ABOVE_MAXIMUM_CHILD_AGE',
          label: 'Adult pricing',
          amount: 0,
        });
        limitations.add('No adult/additional-occupant pricing mechanism exists yet.');
        continue;
      }

      const matches = bands.filter((band) => age >= band.minAge && age <= band.maxAge);
      if (matches.length !== 1) {
        throw new BadRequestException(`Child age ${age} must resolve to exactly one age band`);
      }

      const band = matches[0];
      const amount = this.calculateBandAmount(band, nights, nightlyRoomRate);
      if (band.pricingMode === ChildPricingMode.ADULT_PRICING) {
        limitations.add('No adult/additional-occupant pricing mechanism exists yet.');
      }

      lines.push({
        age,
        pricingMode: band.pricingMode,
        label: band.label,
        amount,
      });
    }

    return {
      lines,
      total: lines.reduce((sum, line) => sum + line.amount, 0),
      limitations: [...limitations],
    };
  }

  private async getActivePolicy(propertyId: string): Promise<GuestPricingPolicyEntity | null> {
    return this.guestPricingPoliciesRepository.findOne({
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

  private calculateBandAmount(
    band: ChildAgeBandEntity,
    nights: number,
    nightlyRoomRate: number,
  ): number {
    switch (band.pricingMode) {
      case ChildPricingMode.FREE:
      case ChildPricingMode.ADULT_PRICING:
        return 0;
      case ChildPricingMode.FIXED_PER_NIGHT:
        return Number(band.fixedAmount ?? 0) * nights;
      case ChildPricingMode.PERCENT_OF_ROOM_RATE:
        return nightlyRoomRate * nights * (Number(band.percentage ?? 0) / 100);
      default:
        return 0;
    }
  }
}
