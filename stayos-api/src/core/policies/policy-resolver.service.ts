import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GroupBookingDepositPolicyType } from '../properties/domain/group-booking-deposit-policy-type.enum';
import { DepositPolicyInput } from './domain/normalize-deposit-policy';
import { PropertyPolicyType } from './domain/property-policy-type.enum';
import { PropertyPolicyEntity } from './infrastructure/property-policy.entity';

/**
 * Foundation policy resolver implementing the hierarchy:
 *   Rate Plan override -> Property default.
 * Rate plans are not built here; the resolver simply prefers a rate-plan-scoped
 * row when a ratePlanId is supplied and falls back to the property default.
 */
@Injectable()
export class PolicyResolverService {
  constructor(
    @InjectRepository(PropertyPolicyEntity)
    private readonly policiesRepository: Repository<PropertyPolicyEntity>,
  ) {}

  async resolve(
    propertyId: string,
    policyType: PropertyPolicyType,
    ratePlanId: string | null = null,
  ): Promise<PropertyPolicyEntity | null> {
    if (ratePlanId) {
      const override = await this.policiesRepository.findOne({
        where: { propertyId, policyType, ratePlanId },
      });
      if (override) return override;
    }

    return this.policiesRepository.findOne({
      where: { propertyId, policyType, ratePlanId: IsNull() },
    });
  }

  /**
   * Resolves the effective deposit policy as a normalizer-ready input. Falls
   * back to a NONE deposit when no active policy exists.
   */
  async resolveDepositInput(
    propertyId: string,
    policyType: PropertyPolicyType,
    ratePlanId: string | null = null,
  ): Promise<DepositPolicyInput> {
    const policy = await this.resolve(propertyId, policyType, ratePlanId);

    if (!policy || !policy.isActive || !policy.depositMode) {
      return { type: GroupBookingDepositPolicyType.NONE, value: 0 };
    }

    return {
      type: policy.depositMode,
      value: policy.depositValue === null ? 0 : Number(policy.depositValue),
    };
  }

  resolveGroupDepositInput(
    propertyId: string,
    ratePlanId: string | null = null,
  ): Promise<DepositPolicyInput> {
    return this.resolveDepositInput(propertyId, PropertyPolicyType.GROUP_DEPOSIT, ratePlanId);
  }
}
