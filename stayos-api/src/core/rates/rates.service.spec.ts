import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypesService } from '../room-types/room-types.service';
import { ChildPricingMode } from './domain/child-pricing-mode.enum';
import { RatePlanStatus } from './domain/rate-plan-status.enum';
import { MealPlan } from './domain/meal-plan.enum';
import { ChildAgeBandEntity } from './infrastructure/child-age-band.entity';
import { GuestPricingPolicyEntity } from './infrastructure/guest-pricing-policy.entity';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RatePlanRoomTypeEntity } from './infrastructure/rate-plan-room-type.entity';
import { RoomTypeDailyRateEntity } from './infrastructure/room-type-daily-rate.entity';
import { RatesService } from './rates.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const otherPropertyId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';
const roomTypeId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const ratePlanId = '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673';
const guestPricingPolicyId = '9075c8fa-f36e-4f40-a3ef-2e9dbb1f0675';

const ratePlanEntity: RatePlanEntity = {
  id: ratePlanId,
  propertyId,
  property: undefined as never,
  code: 'BAR',
  name: 'Best Available Rate',
  description: null,
  isDefault: true,
  status: RatePlanStatus.ACTIVE,
  mealPlan: MealPlan.ROOM_ONLY,
  refundable: true,
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};

const dailyRateEntity: RoomTypeDailyRateEntity = {
  id: '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674',
  propertyId,
  property: undefined as never,
  roomTypeId,
  roomType: undefined as never,
  ratePlanId,
  ratePlan: undefined as never,
  stayDate: '2026-08-16',
  amount: '5000.00',
  createdAt: new Date('2026-06-30T00:00:00.000Z'),
  updatedAt: new Date('2026-06-30T00:00:00.000Z'),
};

const guestPricingPolicyEntity: GuestPricingPolicyEntity = {
  id: guestPricingPolicyId,
  propertyId,
  property: undefined as never,
  ageBasedChildPricingEnabled: true,
  maximumChildAge: 17,
  isActive: true,
  createdAt: new Date('2026-08-14T00:00:00.000Z'),
  updatedAt: new Date('2026-08-14T00:00:00.000Z'),
};

const childAgeBands: ChildAgeBandEntity[] = [
  {
    id: 'a075c8fa-f36e-4f40-a3ef-2e9dbb1f0676',
    guestPricingPolicyId,
    guestPricingPolicy: undefined as never,
    label: 'Young Child',
    minAge: 0,
    maxAge: 5,
    pricingMode: ChildPricingMode.FREE,
    fixedAmount: null,
    percentage: null,
    displayOrder: 0,
    isActive: true,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
  },
  {
    id: 'b075c8fa-f36e-4f40-a3ef-2e9dbb1f0677',
    guestPricingPolicyId,
    guestPricingPolicy: undefined as never,
    label: 'Child',
    minAge: 6,
    maxAge: 11,
    pricingMode: ChildPricingMode.FIXED_PER_NIGHT,
    fixedAmount: '800.00',
    percentage: null,
    displayOrder: 1,
    isActive: true,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
  },
  {
    id: 'c075c8fa-f36e-4f40-a3ef-2e9dbb1f0678',
    guestPricingPolicyId,
    guestPricingPolicy: undefined as never,
    label: 'Older Child',
    minAge: 12,
    maxAge: 17,
    pricingMode: ChildPricingMode.ADULT_PRICING,
    fixedAmount: null,
    percentage: null,
    displayOrder: 2,
    isActive: true,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
  },
];

describe('RatesService', () => {
  let service: RatesService;

  let ratePlansRepository: MockRepository<RatePlanEntity>;
  let dailyRatesRepository: MockRepository<RoomTypeDailyRateEntity>;
  let ratePlanRoomTypesRepository: MockRepository<RatePlanRoomTypeEntity>;
  let guestPricingPoliciesRepository: MockRepository<GuestPricingPolicyEntity>;
  let childAgeBandsRepository: MockRepository<ChildAgeBandEntity>;

  let transactionalPolicyRepository: MockRepository<GuestPricingPolicyEntity>;
  let transactionalBandRepository: MockRepository<ChildAgeBandEntity>;

  const propertiesService = {
    findOne: jest.fn(),
  };

  const roomTypesService = {
    findOne: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    ratePlansRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
    };

    dailyRatesRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };

    ratePlanRoomTypesRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => v),
      delete: jest.fn(),
    };

    guestPricingPoliciesRepository = {
      findOne: jest.fn(),
    };

    childAgeBandsRepository = {
      find: jest.fn(),
    };

    transactionalPolicyRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    transactionalBandRepository = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    propertiesService.findOne.mockReset();
    roomTypesService.findOne.mockReset();
    dataSource.transaction.mockReset();

    propertiesService.findOne.mockResolvedValue({ id: propertyId });
    roomTypesService.findOne.mockResolvedValue({
      id: roomTypeId,
      propertyId,
    });

    dataSource.transaction.mockImplementation(
      async (
        callback: (manager: {
          getRepository: (entity: unknown) => MockRepository;
        }) => Promise<unknown>,
      ) =>
        callback({
          getRepository: (entity: unknown) => {
            if (entity === GuestPricingPolicyEntity) {
              return transactionalPolicyRepository;
            }

            if (entity === ChildAgeBandEntity) {
              return transactionalBandRepository;
            }

            throw new Error('Unexpected repository requested');
          },
        }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatesService,
        {
          provide: getRepositoryToken(RatePlanEntity),
          useValue: ratePlansRepository,
        },
        {
          provide: getRepositoryToken(RoomTypeDailyRateEntity),
          useValue: dailyRatesRepository,
        },
        {
          provide: getRepositoryToken(RatePlanRoomTypeEntity),
          useValue: ratePlanRoomTypesRepository,
        },
        {
          provide: getRepositoryToken(GuestPricingPolicyEntity),
          useValue: guestPricingPoliciesRepository,
        },
        {
          provide: getRepositoryToken(ChildAgeBandEntity),
          useValue: childAgeBandsRepository,
        },
        {
          provide: PropertiesService,
          useValue: propertiesService,
        },
        {
          provide: RoomTypesService,
          useValue: roomTypesService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get(RatesService);
  });

  describe('createRatePlan', () => {
    it('creates a rate plan under a property', async () => {
      ratePlansRepository.create?.mockReturnValue(ratePlanEntity);
      ratePlansRepository.save?.mockResolvedValue(ratePlanEntity);

      await expect(
        service.createRatePlan(propertyId, {
          code: 'BAR',
          name: 'Best Available Rate',
        }),
      ).resolves.toEqual(ratePlanEntity);
    });

    it('rejects a duplicate rate plan code within the same property', async () => {
      const driverError = Object.assign(new Error('duplicate'), {
        code: '23505',
      });

      ratePlansRepository.create?.mockReturnValue(ratePlanEntity);
      ratePlansRepository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));

      await expect(
        service.createRatePlan(propertyId, {
          code: 'BAR',
          name: 'Best Available Rate',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows the same rate plan code for a different property', async () => {
      ratePlansRepository.create?.mockReturnValue({
        ...ratePlanEntity,
        propertyId: otherPropertyId,
      });

      ratePlansRepository.save?.mockResolvedValue({
        ...ratePlanEntity,
        propertyId: otherPropertyId,
      });

      await expect(
        service.createRatePlan(otherPropertyId, {
          code: 'BAR',
          name: 'Best Available Rate',
        }),
      ).resolves.toMatchObject({
        propertyId: otherPropertyId,
        code: 'BAR',
      });
    });

    it('rejects a second default rate plan for the same property', async () => {
      const driverError = Object.assign(new Error('duplicate'), {
        code: '23505',
        constraint: 'UQ_rate_plans_property_default',
      });

      ratePlansRepository.create?.mockReturnValue(ratePlanEntity);
      ratePlansRepository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));

      await expect(
        service.createRatePlan(propertyId, {
          code: 'BAR2',
          name: 'Second Best Available Rate',
          isDefault: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows a default rate plan for different properties', async () => {
      ratePlansRepository.create?.mockReturnValue(ratePlanEntity);
      ratePlansRepository.save?.mockResolvedValue(ratePlanEntity);

      await expect(
        service.createRatePlan(propertyId, {
          code: 'BAR',
          name: 'Best Available Rate',
          isDefault: true,
        }),
      ).resolves.toMatchObject({
        isDefault: true,
      });

      ratePlansRepository.create?.mockReturnValue({
        ...ratePlanEntity,
        propertyId: otherPropertyId,
      });

      ratePlansRepository.save?.mockResolvedValue({
        ...ratePlanEntity,
        propertyId: otherPropertyId,
      });

      await expect(
        service.createRatePlan(otherPropertyId, {
          code: 'BAR',
          name: 'Best Available Rate',
          isDefault: true,
        }),
      ).resolves.toMatchObject({
        propertyId: otherPropertyId,
        isDefault: true,
      });
    });
  });

  describe('rate plan room-type pricing (1C-b1)', () => {
    beforeEach(() => {
      ratePlansRepository.findOne?.mockResolvedValue(ratePlanEntity);
    });

    it('upserts base pricing for a (rate plan, room type)', async () => {
      ratePlanRoomTypesRepository.findOne?.mockResolvedValue(null);

      const result = await service.upsertRatePlanRoomType(propertyId, ratePlanId, {
        roomTypeId,
        baseOccupancy: 2,
        baseRate: '5000.00',
        extraAdultCharge: '1500.00',
      });

      expect(result).toMatchObject({
        propertyId,
        ratePlanId,
        roomTypeId,
        baseOccupancy: 2,
        baseRate: '5000.00',
        extraAdultCharge: '1500.00',
        extraChildCharge: '0',
      });
    });

    it('rejects a negative/invalid base rate', async () => {
      await expect(
        service.upsertRatePlanRoomType(propertyId, ratePlanId, {
          roomTypeId,
          baseOccupancy: 2,
          baseRate: '-5',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a base occupancy below 1', async () => {
      await expect(
        service.upsertRatePlanRoomType(propertyId, ratePlanId, {
          roomTypeId,
          baseOccupancy: 0,
          baseRate: '5000.00',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when removing a room type not on the plan', async () => {
      ratePlanRoomTypesRepository.delete?.mockResolvedValue({ affected: 0 });
      await expect(
        service.removeRatePlanRoomType(propertyId, ratePlanId, roomTypeId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateRatePlan (1C-b1)', () => {
    it('merges updatable fields and persists', async () => {
      ratePlansRepository.findOne?.mockResolvedValue(ratePlanEntity);
      ratePlansRepository.merge?.mockImplementation((base, patch) => ({ ...base, ...patch }));
      ratePlansRepository.save?.mockImplementation(async (v) => v);

      const result = await service.updateRatePlan(propertyId, ratePlanId, {
        status: RatePlanStatus.INACTIVE,
        refundable: false,
      });

      expect(result).toMatchObject({ status: RatePlanStatus.INACTIVE, refundable: false });
    });
  });

  describe('createDailyRate', () => {
    beforeEach(() => {
      ratePlansRepository.findOne?.mockResolvedValue(ratePlanEntity);
    });

    it('allows one rate for a room type + rate plan + stay date', async () => {
      dailyRatesRepository.create?.mockReturnValue(dailyRateEntity);
      dailyRatesRepository.save?.mockResolvedValue(dailyRateEntity);

      await expect(
        service.createDailyRate(propertyId, {
          roomTypeId,
          ratePlanId,
          stayDate: '2026-08-16',
          amount: '5000.00',
        }),
      ).resolves.toEqual(dailyRateEntity);
    });

    it('rejects a duplicate room type + rate plan + stay date rate', async () => {
      const driverError = Object.assign(new Error('duplicate'), {
        code: '23505',
      });

      dailyRatesRepository.create?.mockReturnValue(dailyRateEntity);
      dailyRatesRepository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));

      await expect(
        service.createDailyRate(propertyId, {
          roomTypeId,
          ratePlanId,
          stayDate: '2026-08-16',
          amount: '5000.00',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows a zero rate', async () => {
      dailyRatesRepository.create?.mockReturnValue({
        ...dailyRateEntity,
        amount: '0.00',
      });

      dailyRatesRepository.save?.mockResolvedValue({
        ...dailyRateEntity,
        amount: '0.00',
      });

      await expect(
        service.createDailyRate(propertyId, {
          roomTypeId,
          ratePlanId,
          stayDate: '2026-08-16',
          amount: '0.00',
        }),
      ).resolves.toMatchObject({
        amount: '0.00',
      });
    });

    it('rejects a room type that belongs to a different property', async () => {
      roomTypesService.findOne.mockRejectedValueOnce(
        new NotFoundException(`Room type ${roomTypeId} was not found`),
      );

      await expect(
        service.createDailyRate(propertyId, {
          roomTypeId,
          ratePlanId,
          stayDate: '2026-08-16',
          amount: '5000.00',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(dailyRatesRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a rate plan that belongs to a different property', async () => {
      ratePlansRepository.findOne?.mockResolvedValueOnce(undefined);

      await expect(
        service.createDailyRate(propertyId, {
          roomTypeId,
          ratePlanId,
          stayDate: '2026-08-16',
          amount: '5000.00',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(dailyRatesRepository.save).not.toHaveBeenCalled();
    });

    describe('amount format validation', () => {
      it.each(['0', '0.00', '5000', '5000.5', '5000.50'])(
        'accepts a valid decimal amount "%s"',
        async (amount) => {
          dailyRatesRepository.create?.mockReturnValue({
            ...dailyRateEntity,
            amount,
          });

          dailyRatesRepository.save?.mockResolvedValue({
            ...dailyRateEntity,
            amount,
          });

          await expect(
            service.createDailyRate(propertyId, {
              roomTypeId,
              ratePlanId,
              stayDate: '2026-08-16',
              amount,
            }),
          ).resolves.toMatchObject({
            amount,
          });
        },
      );

      it.each([
        ['-1', 'negative'],
        ['abc', 'alphabetic'],
        ['', 'blank'],
        ['12.345', 'more than 2 decimal places'],
        ['1e5', 'exponent notation'],
        ['12345678901.00', 'more than 10 integer digits (numeric(12,2) overflow)'],
      ])('rejects "%s" (%s) before hitting the database', async (amount) => {
        await expect(
          service.createDailyRate(propertyId, {
            roomTypeId,
            ratePlanId,
            stayDate: '2026-08-16',
            amount,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(dailyRatesRepository.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('getGuestPricingPolicy', () => {
    it('returns null when a property has no guest pricing policy', async () => {
      guestPricingPoliciesRepository.findOne?.mockResolvedValue(null);

      await expect(service.getGuestPricingPolicy(propertyId)).resolves.toBeNull();
    });

    it('returns the policy with ordered child age bands', async () => {
      guestPricingPoliciesRepository.findOne?.mockResolvedValue(guestPricingPolicyEntity);

      childAgeBandsRepository.find?.mockResolvedValue(childAgeBands);

      await expect(service.getGuestPricingPolicy(propertyId)).resolves.toEqual({
        policy: guestPricingPolicyEntity,
        childAgeBands,
      });

      expect(childAgeBandsRepository.find).toHaveBeenCalledWith({
        where: {
          guestPricingPolicyId,
        },
        order: {
          minAge: 'ASC',
          displayOrder: 'ASC',
        },
      });
    });
  });

  describe('upsertGuestPricingPolicy', () => {
    const validInput = {
      maximumChildAge: 17,
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

    beforeEach(() => {
      transactionalPolicyRepository.findOne?.mockResolvedValue(null);
      transactionalPolicyRepository.create?.mockReturnValue(guestPricingPolicyEntity);
      transactionalPolicyRepository.save?.mockResolvedValue(guestPricingPolicyEntity);

      transactionalBandRepository.delete?.mockResolvedValue({
        affected: 0,
        raw: [],
      });

      transactionalBandRepository.create?.mockImplementation(
        (value: Partial<ChildAgeBandEntity>) => value as ChildAgeBandEntity,
      );

      transactionalBandRepository.save?.mockImplementation(async (bands: ChildAgeBandEntity[]) =>
        bands.map((band, index) => ({
          ...band,
          id: `generated-band-${index}`,
          createdAt: new Date('2026-08-14T00:00:00.000Z'),
          updatedAt: new Date('2026-08-14T00:00:00.000Z'),
        })),
      );
    });

    it('creates a valid property guest pricing policy atomically', async () => {
      const result = await service.upsertGuestPricingPolicy(propertyId, validInput);

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);

      expect(transactionalPolicyRepository.save).toHaveBeenCalled();

      expect(transactionalBandRepository.delete).toHaveBeenCalledWith({
        guestPricingPolicyId,
      });

      expect(transactionalBandRepository.save).toHaveBeenCalled();

      expect(result.policy).toEqual(guestPricingPolicyEntity);
      expect(result.childAgeBands).toHaveLength(3);
    });

    it('accepts a RATE_PLAN_EXTRA_CHILD band (amount comes from the rate plan, not the band)', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            { label: 'Rate Plan Child', minAge: 0, maxAge: 17, pricingMode: ChildPricingMode.RATE_PLAN_EXTRA_CHILD },
          ],
        }),
      ).resolves.toBeDefined();
      expect(transactionalBandRepository.save).toHaveBeenCalled();
    });

    it('rejects a RATE_PLAN_EXTRA_CHILD band that defines fixedAmount or percentage', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            { label: 'Bad', minAge: 0, maxAge: 11, pricingMode: ChildPricingMode.RATE_PLAN_EXTRA_CHILD, fixedAmount: '500.00' },
          ],
        }),
      ).rejects.toThrow(/must not define fixedAmount or percentage/);
    });

    it('updates an existing property policy instead of creating a second one', async () => {
      transactionalPolicyRepository.findOne?.mockResolvedValue({
        ...guestPricingPolicyEntity,
      });

      transactionalPolicyRepository.save?.mockImplementation(
        async (policy: GuestPricingPolicyEntity) => policy,
      );

      await service.upsertGuestPricingPolicy(propertyId, {
        ...validInput,
        maximumChildAge: 16,
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
            maxAge: 16,
            pricingMode: ChildPricingMode.ADULT_PRICING,
          },
        ],
      });

      expect(transactionalPolicyRepository.create).not.toHaveBeenCalled();

      expect(transactionalPolicyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          maximumChildAge: 16,
        }),
      );
    });

    it('rejects bands that do not start at age 0', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            {
              label: 'Child',
              minAge: 2,
              maxAge: 17,
              pricingMode: ChildPricingMode.FREE,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a gap between child age bands', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            {
              label: 'Young Child',
              minAge: 0,
              maxAge: 5,
              pricingMode: ChildPricingMode.FREE,
            },
            {
              label: 'Child',
              minAge: 8,
              maxAge: 17,
              pricingMode: ChildPricingMode.FIXED_PER_NIGHT,
              fixedAmount: '800.00',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects overlapping child age bands', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            {
              label: 'Young Child',
              minAge: 0,
              maxAge: 7,
              pricingMode: ChildPricingMode.FREE,
            },
            {
              label: 'Child',
              minAge: 6,
              maxAge: 17,
              pricingMode: ChildPricingMode.FIXED_PER_NIGHT,
              fixedAmount: '800.00',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects child age bands that do not cover maximumChildAge', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
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
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects a child age band that exceeds maximumChildAge', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 11,
          childAgeBands: [
            {
              label: 'Child',
              minAge: 0,
              maxAge: 17,
              pricingMode: ChildPricingMode.FREE,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects negative child ages', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            {
              label: 'Invalid',
              minAge: -1,
              maxAge: 17,
              pricingMode: ChildPricingMode.FREE,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a maximum child age that is not a whole non-negative number', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: -1,
          childAgeBands: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17.5,
          childAgeBands: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires fixedAmount for FIXED_PER_NIGHT', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            {
              label: 'Child',
              minAge: 0,
              maxAge: 17,
              pricingMode: ChildPricingMode.FIXED_PER_NIGHT,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects malformed fixedAmount values', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            {
              label: 'Child',
              minAge: 0,
              maxAge: 17,
              pricingMode: ChildPricingMode.FIXED_PER_NIGHT,
              fixedAmount: '12.345',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('does not allow FREE pricing to carry fixedAmount or percentage', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            {
              label: 'Free Child',
              minAge: 0,
              maxAge: 17,
              pricingMode: ChildPricingMode.FREE,
              fixedAmount: '100.00',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires percentage for PERCENT_OF_ROOM_RATE', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          maximumChildAge: 17,
          childAgeBands: [
            {
              label: 'Child',
              minAge: 0,
              maxAge: 17,
              pricingMode: ChildPricingMode.PERCENT_OF_ROOM_RATE,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each(['101', '100.01', '-1', 'abc', '20.123', '1e2'])(
      'rejects invalid percentage "%s"',
      async (percentage) => {
        await expect(
          service.upsertGuestPricingPolicy(propertyId, {
            maximumChildAge: 17,
            childAgeBands: [
              {
                label: 'Child',
                minAge: 0,
                maxAge: 17,
                pricingMode: ChildPricingMode.PERCENT_OF_ROOM_RATE,
                percentage,
              },
            ],
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it.each(['0', '0.00', '20', '20.5', '20.50', '100', '100.00'])(
      'accepts valid percentage "%s"',
      async (percentage) => {
        transactionalPolicyRepository.create?.mockReturnValue(guestPricingPolicyEntity);

        await expect(
          service.upsertGuestPricingPolicy(propertyId, {
            maximumChildAge: 17,
            childAgeBands: [
              {
                label: 'Child',
                minAge: 0,
                maxAge: 17,
                pricingMode: ChildPricingMode.PERCENT_OF_ROOM_RATE,
                percentage,
              },
            ],
          }),
        ).resolves.toBeDefined();
      },
    );

    it('allows age-based child pricing to be disabled with no age bands', async () => {
      transactionalPolicyRepository.create?.mockReturnValue({
        ...guestPricingPolicyEntity,
        ageBasedChildPricingEnabled: false,
      });

      transactionalPolicyRepository.save?.mockResolvedValue({
        ...guestPricingPolicyEntity,
        ageBasedChildPricingEnabled: false,
      });

      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          ageBasedChildPricingEnabled: false,
          maximumChildAge: 17,
          childAgeBands: [],
        }),
      ).resolves.toMatchObject({
        policy: {
          ageBasedChildPricingEnabled: false,
        },
        childAgeBands: [],
      });

      expect(transactionalBandRepository.save).not.toHaveBeenCalled();
    });

    it('rejects age bands when age-based child pricing is disabled', async () => {
      await expect(
        service.upsertGuestPricingPolicy(propertyId, {
          ageBasedChildPricingEnabled: false,
          maximumChildAge: 17,
          childAgeBands: [
            {
              label: 'Child',
              minAge: 0,
              maxAge: 17,
              pricingMode: ChildPricingMode.FREE,
            },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('verifies the property before saving the policy', async () => {
      propertiesService.findOne.mockRejectedValueOnce(
        new NotFoundException(`Property ${propertyId} was not found`),
      );

      await expect(service.upsertGuestPricingPolicy(propertyId, validInput)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
