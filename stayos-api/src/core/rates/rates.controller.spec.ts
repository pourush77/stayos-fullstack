import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChildPricingMode } from './domain/child-pricing-mode.enum';
import { UpsertGuestPricingPolicyDto } from './dto/upsert-guest-pricing-policy.dto';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { RestrictionService } from './restriction.service';
import { TaxService } from './tax.service';

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';

const validDto: UpsertGuestPricingPolicyDto = {
  ageBasedChildPricingEnabled: true,
  maximumChildAge: 17,
  isActive: true,
  childAgeBands: [
    {
      label: 'Young Child',
      minAge: 0,
      maxAge: 5,
      pricingMode: ChildPricingMode.FREE,
    },
    {
      label: 'Child',
      minAge: 6,
      maxAge: 11,
      pricingMode: ChildPricingMode.FIXED_PER_NIGHT,
      fixedAmount: '800.00',
    },
    {
      label: 'Older Child',
      minAge: 12,
      maxAge: 17,
      pricingMode: ChildPricingMode.ADULT_PRICING,
    },
  ],
};

const policyResponse = {
  policy: {
    id: '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675',
    propertyId,
    ageBasedChildPricingEnabled: true,
    maximumChildAge: 17,
    isActive: true,
  },
  childAgeBands: [],
};

describe('RatesController', () => {
  let controller: RatesController;

  const ratesService = {
    getGuestPricingPolicy: jest.fn(),
    upsertGuestPricingPolicy: jest.fn(),
  };
  const taxService = {
    getPropertyTaxConfig: jest.fn(),
    upsertPropertyTaxConfig: jest.fn(),
  };
  const restrictionService = {
    listRestrictions: jest.fn(),
    upsertRestrictions: jest.fn(),
    deleteRestriction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RatesController],
      providers: [
        {
          provide: RatesService,
          useValue: ratesService,
        },
        {
          provide: TaxService,
          useValue: taxService,
        },
        {
          provide: RestrictionService,
          useValue: restrictionService,
        },
      ],
    }).compile();

    controller = module.get(RatesController);
  });

  describe('getGuestPricingPolicy', () => {
    it('returns the property guest pricing policy', async () => {
      ratesService.getGuestPricingPolicy.mockResolvedValue(policyResponse);

      await expect(controller.getGuestPricingPolicy(propertyId)).resolves.toEqual(policyResponse);

      expect(ratesService.getGuestPricingPolicy).toHaveBeenCalledWith(propertyId);
    });

    it('returns null when no pricing policy is configured', async () => {
      ratesService.getGuestPricingPolicy.mockResolvedValue(null);

      await expect(controller.getGuestPricingPolicy(propertyId)).resolves.toBeNull();

      expect(ratesService.getGuestPricingPolicy).toHaveBeenCalledWith(propertyId);
    });
  });

  describe('upsertGuestPricingPolicy', () => {
    it('forwards the complete policy to the service', async () => {
      ratesService.upsertGuestPricingPolicy.mockResolvedValue(policyResponse);

      await expect(controller.upsertGuestPricingPolicy(propertyId, validDto)).resolves.toEqual(
        policyResponse,
      );

      expect(ratesService.upsertGuestPricingPolicy).toHaveBeenCalledWith(propertyId, validDto);
    });

    it('propagates validation errors from the service', async () => {
      ratesService.upsertGuestPricingPolicy.mockRejectedValue(
        new BadRequestException('Child age bands contain a gap'),
      );

      await expect(
        controller.upsertGuestPricingPolicy(propertyId, validDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('property tax config', () => {
    it('returns the property tax config', async () => {
      const taxConfig = { propertyId, name: 'GST', percentage: '12.00', isActive: true };
      taxService.getPropertyTaxConfig.mockResolvedValue(taxConfig);

      await expect(controller.getPropertyTaxConfig(propertyId)).resolves.toEqual(taxConfig);
      expect(taxService.getPropertyTaxConfig).toHaveBeenCalledWith(propertyId);
    });

    it('updates the property tax config', async () => {
      const dto = { name: 'GST', percentage: '18.00', isActive: true };
      taxService.upsertPropertyTaxConfig.mockResolvedValue({ propertyId, ...dto });

      await expect(controller.upsertPropertyTaxConfig(propertyId, dto)).resolves.toEqual({
        propertyId,
        ...dto,
      });
      expect(taxService.upsertPropertyTaxConfig).toHaveBeenCalledWith(propertyId, dto);
    });
  });
});
