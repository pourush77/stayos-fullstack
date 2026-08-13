import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypesService } from '../room-types/room-types.service';
import { RatePlanStatus } from './domain/rate-plan-status.enum';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RoomTypeDailyRateEntity } from './infrastructure/room-type-daily-rate.entity';
import { RatesService } from './rates.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const propertyId = '4075c8fa-f36e-4f40-a3ef-2e9dbb1f0670';
const otherPropertyId = '5075c8fa-f36e-4f40-a3ef-2e9dbb1f0671';
const roomTypeId = '6075c8fa-f36e-4f40-a3ef-2e9dbb1f0672';
const ratePlanId = '7075c8fa-f36e-4f40-a3ef-2e9dbb1f0673';

const ratePlanEntity: RatePlanEntity = {
  id: ratePlanId,
  propertyId,
  property: undefined as never,
  code: 'BAR',
  name: 'Best Available Rate',
  description: null,
  isDefault: true,
  status: RatePlanStatus.ACTIVE,
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

describe('RatesService', () => {
  let service: RatesService;
  let ratePlansRepository: MockRepository<RatePlanEntity>;
  let dailyRatesRepository: MockRepository<RoomTypeDailyRateEntity>;
  const propertiesService = { findOne: jest.fn() };
  const roomTypesService = { findOne: jest.fn() };

  beforeEach(async () => {
    ratePlansRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    dailyRatesRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };
    propertiesService.findOne.mockResolvedValue({ id: propertyId });
    roomTypesService.findOne.mockResolvedValue({ id: roomTypeId, propertyId });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatesService,
        { provide: getRepositoryToken(RatePlanEntity), useValue: ratePlansRepository },
        { provide: getRepositoryToken(RoomTypeDailyRateEntity), useValue: dailyRatesRepository },
        { provide: PropertiesService, useValue: propertiesService },
        { provide: RoomTypesService, useValue: roomTypesService },
      ],
    }).compile();

    service = module.get(RatesService);
  });

  describe('createRatePlan', () => {
    it('creates a rate plan under a property', async () => {
      ratePlansRepository.create?.mockReturnValue(ratePlanEntity);
      ratePlansRepository.save?.mockResolvedValue(ratePlanEntity);

      await expect(
        service.createRatePlan(propertyId, { code: 'BAR', name: 'Best Available Rate' }),
      ).resolves.toEqual(ratePlanEntity);
    });

    it('rejects a duplicate rate plan code within the same property', async () => {
      const driverError = Object.assign(new Error('duplicate'), { code: '23505' });
      ratePlansRepository.create?.mockReturnValue(ratePlanEntity);
      ratePlansRepository.save?.mockRejectedValue(new QueryFailedError('', [], driverError));

      await expect(
        service.createRatePlan(propertyId, { code: 'BAR', name: 'Best Available Rate' }),
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
        service.createRatePlan(otherPropertyId, { code: 'BAR', name: 'Best Available Rate' }),
      ).resolves.toMatchObject({ propertyId: otherPropertyId, code: 'BAR' });
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
      ).resolves.toMatchObject({ isDefault: true });

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
      ).resolves.toMatchObject({ propertyId: otherPropertyId, isDefault: true });
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
      const driverError = Object.assign(new Error('duplicate'), { code: '23505' });
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
      dailyRatesRepository.create?.mockReturnValue({ ...dailyRateEntity, amount: '0.00' });
      dailyRatesRepository.save?.mockResolvedValue({ ...dailyRateEntity, amount: '0.00' });

      await expect(
        service.createDailyRate(propertyId, {
          roomTypeId,
          ratePlanId,
          stayDate: '2026-08-16',
          amount: '0.00',
        }),
      ).resolves.toMatchObject({ amount: '0.00' });
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
          dailyRatesRepository.create?.mockReturnValue({ ...dailyRateEntity, amount });
          dailyRatesRepository.save?.mockResolvedValue({ ...dailyRateEntity, amount });

          await expect(
            service.createDailyRate(propertyId, {
              roomTypeId,
              ratePlanId,
              stayDate: '2026-08-16',
              amount,
            }),
          ).resolves.toMatchObject({ amount });
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
});
