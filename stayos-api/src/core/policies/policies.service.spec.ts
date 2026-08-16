import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { GroupBookingDepositPolicyType } from '../properties/domain/group-booking-deposit-policy-type.enum';
import { PropertiesService } from '../properties/properties.service';
import { RatePlanEntity } from '../rates/infrastructure/rate-plan.entity';
import { PolicyChargeMode } from './domain/policy-charge-mode.enum';
import { PropertyPolicyType } from './domain/property-policy-type.enum';
import { PropertyPolicyEntity } from './infrastructure/property-policy.entity';
import { PoliciesService } from './policies.service';

describe('PoliciesService', () => {
  const propertyId = '11111111-1111-1111-1111-111111111111';
  let repo: jest.Mocked<Pick<Repository<PropertyPolicyEntity>, 'findOne' | 'find' | 'create' | 'save'>>;
  let ratePlanRepo: jest.Mocked<Pick<Repository<RatePlanEntity>, 'findOne'>>;
  let propertiesService: Pick<PropertiesService, 'findOne'>;
  let service: PoliciesService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v: Partial<PropertyPolicyEntity>) => ({ ...v }) as PropertyPolicyEntity),
      save: jest.fn((v: PropertyPolicyEntity) => Promise.resolve(v)),
    } as never;
    ratePlanRepo = { findOne: jest.fn().mockResolvedValue(null) } as never;
    propertiesService = { findOne: jest.fn().mockResolvedValue({ id: propertyId }) };
    service = new PoliciesService(repo as never, ratePlanRepo as never, propertiesService as never);
  });

  it('persists a group deposit policy reusing the deposit normalizer', async () => {
    const result = await service.upsert(propertyId, PropertyPolicyType.GROUP_DEPOSIT, {
      depositMode: GroupBookingDepositPolicyType.FIXED_AMOUNT,
      depositValue: 5000,
    });
    expect(result.depositMode).toBe(GroupBookingDepositPolicyType.FIXED_AMOUNT);
    expect(result.depositValue).toBe('5000.00');
    expect(result.chargeMode).toBeNull();
  });

  it('normalizes an individual deposit NONE with no value', async () => {
    const result = await service.upsert(propertyId, PropertyPolicyType.INDIVIDUAL_DEPOSIT, {
      depositMode: GroupBookingDepositPolicyType.NONE,
    });
    expect(result.depositMode).toBe(GroupBookingDepositPolicyType.NONE);
    expect(result.depositValue).toBe('0.00');
  });

  it('rejects a deposit percentage above 100', async () => {
    await expect(
      service.upsert(propertyId, PropertyPolicyType.INDIVIDUAL_DEPOSIT, {
        depositMode: GroupBookingDepositPolicyType.PERCENTAGE,
        depositValue: 101,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects charge fields on a deposit policy', async () => {
    await expect(
      service.upsert(propertyId, PropertyPolicyType.GROUP_DEPOSIT, {
        depositMode: GroupBookingDepositPolicyType.NONE,
        chargeMode: PolicyChargeMode.PERCENTAGE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists a cancellation policy with a free-cancellation window', async () => {
    const result = await service.upsert(propertyId, PropertyPolicyType.CANCELLATION, {
      chargeMode: PolicyChargeMode.FIRST_NIGHT,
      cancellationCutoffHours: 24,
    });
    expect(result.chargeMode).toBe(PolicyChargeMode.FIRST_NIGHT);
    expect(result.chargeValue).toBe('0.00');
    expect(result.cancellationCutoffHours).toBe(24);
    expect(result.depositMode).toBeNull();
  });

  it('rejects an invalid cancellation percentage', async () => {
    await expect(
      service.upsert(propertyId, PropertyPolicyType.CANCELLATION, {
        chargeMode: PolicyChargeMode.PERCENTAGE,
        chargeValue: 150,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects FIRST_NIGHT for early check-in fees', async () => {
    await expect(
      service.upsert(propertyId, PropertyPolicyType.EARLY_CHECK_IN, {
        chargeMode: PolicyChargeMode.FIRST_NIGHT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists a late checkout fee with a grace window', async () => {
    const result = await service.upsert(propertyId, PropertyPolicyType.LATE_CHECKOUT, {
      chargeMode: PolicyChargeMode.FIXED_AMOUNT,
      chargeValue: 750,
      graceMinutes: 60,
    });
    expect(result.chargeMode).toBe(PolicyChargeMode.FIXED_AMOUNT);
    expect(result.chargeValue).toBe('750.00');
    expect(result.graceMinutes).toBe(60);
  });

  it('rejects a cancellation cut-off on a no-show policy', async () => {
    await expect(
      service.upsert(propertyId, PropertyPolicyType.NO_SHOW, {
        chargeMode: PolicyChargeMode.FIRST_NIGHT,
        cancellationCutoffHours: 12,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a negative value for a NONE deposit policy', async () => {
    await expect(
      service.upsert(propertyId, PropertyPolicyType.INDIVIDUAL_DEPOSIT, {
        depositMode: GroupBookingDepositPolicyType.NONE,
        depositValue: -5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a ratePlanId that does not belong to the property', async () => {
    ratePlanRepo.findOne.mockResolvedValue(null);
    await expect(
      service.upsert(propertyId, PropertyPolicyType.INDIVIDUAL_DEPOSIT, {
        depositMode: GroupBookingDepositPolicyType.NONE,
        ratePlanId: '22222222-2222-2222-2222-222222222222',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('accepts a ratePlanId that belongs to the property', async () => {
    ratePlanRepo.findOne.mockResolvedValue({ id: 'rp-1', propertyId } as RatePlanEntity);
    const result = await service.upsert(propertyId, PropertyPolicyType.INDIVIDUAL_DEPOSIT, {
      depositMode: GroupBookingDepositPolicyType.PERCENTAGE,
      depositValue: 10,
      ratePlanId: 'rp-1',
    });
    expect(result.ratePlanId).toBe('rp-1');
    expect(result.depositMode).toBe(GroupBookingDepositPolicyType.PERCENTAGE);
  });
});
