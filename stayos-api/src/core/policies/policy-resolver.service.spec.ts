import { IsNull, Repository } from 'typeorm';
import { GroupBookingDepositPolicyType } from '../properties/domain/group-booking-deposit-policy-type.enum';
import { PropertyPolicyType } from './domain/property-policy-type.enum';
import { PropertyPolicyEntity } from './infrastructure/property-policy.entity';
import { PolicyResolverService } from './policy-resolver.service';

describe('PolicyResolverService', () => {
  const propertyId = 'prop-1';
  let repo: jest.Mocked<Pick<Repository<PropertyPolicyEntity>, 'findOne'>>;
  let service: PolicyResolverService;

  const defaultRow = {
    propertyId,
    policyType: PropertyPolicyType.GROUP_DEPOSIT,
    ratePlanId: null,
    isActive: true,
    depositMode: GroupBookingDepositPolicyType.PERCENTAGE,
    depositValue: '20.00',
  } as PropertyPolicyEntity;

  const overrideRow = {
    ...defaultRow,
    ratePlanId: 'rp-1',
    depositMode: GroupBookingDepositPolicyType.FIXED_AMOUNT,
    depositValue: '5000.00',
  } as PropertyPolicyEntity;

  beforeEach(() => {
    repo = { findOne: jest.fn() } as never;
    service = new PolicyResolverService(repo as never);
  });

  it('resolves the property default when no rate plan is supplied', async () => {
    repo.findOne.mockResolvedValueOnce(defaultRow);

    const input = await service.resolveGroupDepositInput(propertyId);

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { propertyId, policyType: PropertyPolicyType.GROUP_DEPOSIT, ratePlanId: IsNull() },
    });
    expect(input).toEqual({ type: GroupBookingDepositPolicyType.PERCENTAGE, value: 20 });
  });

  it('prefers the rate-plan override over the property default', async () => {
    repo.findOne.mockResolvedValueOnce(overrideRow);

    const input = await service.resolveGroupDepositInput(propertyId, 'rp-1');

    expect(input).toEqual({ type: GroupBookingDepositPolicyType.FIXED_AMOUNT, value: 5000 });
  });

  it('falls back to the property default when a rate-plan override is absent', async () => {
    repo.findOne
      .mockResolvedValueOnce(null) // no override
      .mockResolvedValueOnce(defaultRow); // property default

    const input = await service.resolveGroupDepositInput(propertyId, 'rp-1');

    expect(input).toEqual({ type: GroupBookingDepositPolicyType.PERCENTAGE, value: 20 });
  });

  it('returns a NONE deposit when no policy exists', async () => {
    repo.findOne.mockResolvedValue(null);

    const input = await service.resolveGroupDepositInput(propertyId);

    expect(input).toEqual({ type: GroupBookingDepositPolicyType.NONE, value: 0 });
  });

  it('returns a NONE deposit when the resolved policy is inactive', async () => {
    repo.findOne.mockResolvedValueOnce({ ...defaultRow, isActive: false } as PropertyPolicyEntity);

    const input = await service.resolveGroupDepositInput(propertyId);

    expect(input).toEqual({ type: GroupBookingDepositPolicyType.NONE, value: 0 });
  });
});
