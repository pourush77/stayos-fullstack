import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypesService } from '../room-types/room-types.service';
import { ChildPricingMode } from './domain/child-pricing-mode.enum';
import { RatePlanStatus } from './domain/rate-plan-status.enum';
import { ChildAgeBandInput } from './dto/child-age-band.input';
import { CreateDailyRateInput } from './dto/create-daily-rate.input';
import {
  CreateRatePlanInput,
  UpdateRatePlanInput,
  UpsertRatePlanRoomTypeInput,
} from './dto/create-rate-plan.input';
import { UpsertGuestPricingPolicyInput } from './dto/upsert-guest-pricing-policy.input';
import { ChildAgeBandEntity } from './infrastructure/child-age-band.entity';
import { GuestPricingPolicyEntity } from './infrastructure/guest-pricing-policy.entity';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RatePlanRoomTypeEntity } from './infrastructure/rate-plan-room-type.entity';
import { RoomTypeDailyRateEntity } from './infrastructure/room-type-daily-rate.entity';

@Injectable()
export class RatesService {
  private static readonly AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
  private static readonly PERCENTAGE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

  constructor(
    @InjectRepository(RatePlanEntity)
    private readonly ratePlansRepository: Repository<RatePlanEntity>,
    @InjectRepository(RoomTypeDailyRateEntity)
    private readonly dailyRatesRepository: Repository<RoomTypeDailyRateEntity>,
    @InjectRepository(RatePlanRoomTypeEntity)
    private readonly ratePlanRoomTypesRepository: Repository<RatePlanRoomTypeEntity>,
    @InjectRepository(GuestPricingPolicyEntity)
    private readonly guestPricingPoliciesRepository: Repository<GuestPricingPolicyEntity>,
    @InjectRepository(ChildAgeBandEntity)
    private readonly childAgeBandsRepository: Repository<ChildAgeBandEntity>,
    private readonly propertiesService: PropertiesService,
    private readonly roomTypesService: RoomTypesService,
    private readonly dataSource: DataSource,
  ) {}

  async findRatePlans(propertyId: string): Promise<RatePlanEntity[]> {
    await this.propertiesService.findOne(propertyId);

    return this.ratePlansRepository.find({
      where: { propertyId },
      order: { name: 'ASC' },
    });
  }

  async findRatePlan(propertyId: string, id: string): Promise<RatePlanEntity> {
    await this.propertiesService.findOne(propertyId);

    const ratePlan = await this.ratePlansRepository.findOne({
      where: { id, propertyId },
    });

    if (!ratePlan) {
      throw new NotFoundException(`Rate plan ${id} was not found`);
    }

    return ratePlan;
  }

  async createRatePlan(propertyId: string, input: CreateRatePlanInput): Promise<RatePlanEntity> {
    await this.propertiesService.findOne(propertyId);

    try {
      const ratePlan = this.ratePlansRepository.create({
        ...input,
        propertyId,
        description: input.description ?? null,
        isDefault: input.isDefault ?? false,
      });

      return await this.ratePlansRepository.save(ratePlan);
    } catch (error) {
      this.handleRatePlanPersistenceError(error);
    }
  }

  async findDefaultApplicableRatePlan(
    propertyId: string,
    roomTypeId: string,
  ): Promise<RatePlanEntity | null> {
    const plan = await this.ratePlansRepository.findOne({
      where: { propertyId, isDefault: true, status: RatePlanStatus.ACTIVE },
    });
    if (!plan) return null;
    const applicable = await this.ratePlanRoomTypesRepository.findOne({
      where: { propertyId, ratePlanId: plan.id, roomTypeId },
    });
    return applicable ? plan : null;
  }

  async updateRatePlan(
    propertyId: string,
    id: string,
    input: UpdateRatePlanInput,
  ): Promise<RatePlanEntity> {
    const ratePlan = await this.findRatePlan(propertyId, id);

    try {
      const merged = this.ratePlansRepository.merge(ratePlan, {
        ...input,
        description: input.description === undefined ? ratePlan.description : input.description,
      });
      return await this.ratePlansRepository.save(merged);
    } catch (error) {
      this.handleRatePlanPersistenceError(error);
    }
  }

  async findRatePlanRoomTypes(
    propertyId: string,
    ratePlanId: string,
  ): Promise<RatePlanRoomTypeEntity[]> {
    await this.findRatePlan(propertyId, ratePlanId);
    return this.ratePlanRoomTypesRepository.find({
      where: { propertyId, ratePlanId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Create or update the base commercial terms for one (rate plan, room type).
   * Pricing only — never touches inventory.
   */
  async upsertRatePlanRoomType(
    propertyId: string,
    ratePlanId: string,
    input: UpsertRatePlanRoomTypeInput,
  ): Promise<RatePlanRoomTypeEntity> {
    await this.findRatePlan(propertyId, ratePlanId);
    await this.roomTypesService.findOne(propertyId, input.roomTypeId);
    this.validateAmount(input.baseRate);
    if (input.extraAdultCharge != null) this.validateAmount(input.extraAdultCharge);
    if (input.extraChildCharge != null) this.validateAmount(input.extraChildCharge);
    if (!Number.isInteger(input.baseOccupancy) || input.baseOccupancy < 1) {
      throw new BadRequestException('baseOccupancy must be a whole number >= 1');
    }

    const existing = await this.ratePlanRoomTypesRepository.findOne({
      where: { propertyId, ratePlanId, roomTypeId: input.roomTypeId },
    });

    const entity = this.ratePlanRoomTypesRepository.create({
      ...(existing ?? {}),
      propertyId,
      ratePlanId,
      roomTypeId: input.roomTypeId,
      baseOccupancy: input.baseOccupancy,
      baseRate: input.baseRate,
      extraAdultCharge: input.extraAdultCharge ?? existing?.extraAdultCharge ?? '0',
      extraChildCharge: input.extraChildCharge ?? existing?.extraChildCharge ?? '0',
    });

    return this.ratePlanRoomTypesRepository.save(entity);
  }

  async removeRatePlanRoomType(
    propertyId: string,
    ratePlanId: string,
    roomTypeId: string,
  ): Promise<void> {
    await this.findRatePlan(propertyId, ratePlanId);
    const result = await this.ratePlanRoomTypesRepository.delete({
      propertyId,
      ratePlanId,
      roomTypeId,
    });
    if (!result.affected) {
      throw new NotFoundException(
        `Rate plan ${ratePlanId} has no pricing for room type ${roomTypeId}`,
      );
    }
  }

  async findDailyRates(
    propertyId: string,
    ratePlanId: string,
    roomTypeId?: string,
  ): Promise<RoomTypeDailyRateEntity[]> {
    await this.findRatePlan(propertyId, ratePlanId);
    return this.dailyRatesRepository.find({
      where: { propertyId, ratePlanId, ...(roomTypeId ? { roomTypeId } : {}) },
      order: { stayDate: 'ASC' },
    });
  }

  async removeDailyRate(propertyId: string, id: string): Promise<void> {
    const result = await this.dailyRatesRepository.delete({ id, propertyId });
    if (!result.affected) {
      throw new NotFoundException(`Daily rate ${id} was not found`);
    }
  }

  // Property isolation is enforced here at the application level:
  // both room type and rate plan lookups are scoped by the same propertyId.
  async createDailyRate(
    propertyId: string,
    input: CreateDailyRateInput,
  ): Promise<RoomTypeDailyRateEntity> {
    await this.propertiesService.findOne(propertyId);
    await this.roomTypesService.findOne(propertyId, input.roomTypeId);
    await this.findRatePlan(propertyId, input.ratePlanId);
    this.validateAmount(input.amount);

    try {
      const dailyRate = this.dailyRatesRepository.create({
        propertyId,
        roomTypeId: input.roomTypeId,
        ratePlanId: input.ratePlanId,
        stayDate: input.stayDate,
        amount: input.amount,
      });

      return await this.dailyRatesRepository.save(dailyRate);
    } catch (error) {
      this.handlePersistenceError(
        error,
        'A daily rate already exists for this room type, rate plan, and stay date',
      );
    }
  }

  async getGuestPricingPolicy(propertyId: string): Promise<{
    policy: GuestPricingPolicyEntity;
    childAgeBands: ChildAgeBandEntity[];
  } | null> {
    await this.propertiesService.findOne(propertyId);

    const policy = await this.guestPricingPoliciesRepository.findOne({
      where: { propertyId },
    });

    if (!policy) return null;

    const childAgeBands = await this.childAgeBandsRepository.find({
      where: {
        guestPricingPolicyId: policy.id,
      },
      order: {
        minAge: 'ASC',
        displayOrder: 'ASC',
      },
    });

    return {
      policy,
      childAgeBands,
    };
  }

  /**
   * Saves the complete property-level guest pricing policy.
   *
   * Child age bands are replaced as one atomic set so StayOS can validate
   * complete age coverage before any partial configuration is persisted.
   */
  async upsertGuestPricingPolicy(
    propertyId: string,
    input: UpsertGuestPricingPolicyInput,
  ): Promise<{
    policy: GuestPricingPolicyEntity;
    childAgeBands: ChildAgeBandEntity[];
  }> {
    await this.propertiesService.findOne(propertyId);

    this.validateGuestPricingPolicy(input);

    return this.dataSource.transaction(async (manager) => {
      const policyRepository = manager.getRepository(GuestPricingPolicyEntity);
      const bandRepository = manager.getRepository(ChildAgeBandEntity);

      let policy = await policyRepository.findOne({
        where: { propertyId },
      });

      if (!policy) {
        policy = policyRepository.create({
          propertyId,
          ageBasedChildPricingEnabled: input.ageBasedChildPricingEnabled ?? true,
          maximumChildAge: input.maximumChildAge,
          isActive: input.isActive ?? true,
        });
      } else {
        policy.ageBasedChildPricingEnabled =
          input.ageBasedChildPricingEnabled ?? policy.ageBasedChildPricingEnabled;
        policy.maximumChildAge = input.maximumChildAge;
        policy.isActive = input.isActive ?? policy.isActive;
      }

      const savedPolicy = await policyRepository.save(policy);

      await bandRepository.delete({
        guestPricingPolicyId: savedPolicy.id,
      });

      const childAgeBands = input.childAgeBands.map((band, index) =>
        bandRepository.create({
          guestPricingPolicyId: savedPolicy.id,
          label: band.label.trim(),
          minAge: band.minAge,
          maxAge: band.maxAge,
          pricingMode: band.pricingMode,
          fixedAmount: band.fixedAmount ?? null,
          percentage: band.percentage ?? null,
          displayOrder: band.displayOrder ?? index,
          isActive: band.isActive ?? true,
        }),
      );

      const savedBands = childAgeBands.length > 0 ? await bandRepository.save(childAgeBands) : [];

      return {
        policy: savedPolicy,
        childAgeBands: savedBands.sort(
          (left, right) => left.minAge - right.minAge || left.displayOrder - right.displayOrder,
        ),
      };
    });
  }

  private validateGuestPricingPolicy(input: UpsertGuestPricingPolicyInput): void {
    if (!Number.isInteger(input.maximumChildAge) || input.maximumChildAge < 0) {
      throw new BadRequestException('maximumChildAge must be a non-negative whole number');
    }

    const ageBasedPricingEnabled = input.ageBasedChildPricingEnabled ?? true;

    if (!ageBasedPricingEnabled) {
      if (input.childAgeBands.length > 0) {
        throw new BadRequestException(
          'childAgeBands must be empty when age-based child pricing is disabled',
        );
      }

      return;
    }

    if (!input.childAgeBands.length) {
      throw new BadRequestException(
        'At least one child age band is required when age-based child pricing is enabled',
      );
    }

    input.childAgeBands.forEach((band) => this.validateChildAgeBand(band, input.maximumChildAge));

    const activeBands = input.childAgeBands
      .filter((band) => band.isActive !== false)
      .sort((left, right) => left.minAge - right.minAge);

    if (!activeBands.length) {
      throw new BadRequestException('At least one active child age band is required');
    }

    if (activeBands[0].minAge !== 0) {
      throw new BadRequestException(
        `Child age bands must start at age 0. Ages 0-${activeBands[0].minAge - 1} are not covered.`,
      );
    }

    for (let index = 1; index < activeBands.length; index += 1) {
      const previous = activeBands[index - 1];
      const current = activeBands[index];

      if (current.minAge <= previous.maxAge) {
        throw new BadRequestException(
          `Child age bands overlap: "${previous.label}" (${previous.minAge}-${previous.maxAge}) and "${current.label}" (${current.minAge}-${current.maxAge}).`,
        );
      }

      if (current.minAge > previous.maxAge + 1) {
        throw new BadRequestException(
          `Child age bands have a gap between ages ${previous.maxAge + 1}-${current.minAge - 1}.`,
        );
      }
    }

    const lastBand = activeBands[activeBands.length - 1];

    if (lastBand.maxAge !== input.maximumChildAge) {
      if (lastBand.maxAge < input.maximumChildAge) {
        throw new BadRequestException(
          `Child age bands must cover through age ${input.maximumChildAge}. Ages ${lastBand.maxAge + 1}-${input.maximumChildAge} are not covered.`,
        );
      }

      throw new BadRequestException(
        `Child age band "${lastBand.label}" exceeds maximumChildAge ${input.maximumChildAge}.`,
      );
    }
  }

  private validateChildAgeBand(band: ChildAgeBandInput, maximumChildAge: number): void {
    if (!band.label?.trim()) {
      throw new BadRequestException('Every child age band must have a label');
    }

    if (band.label.trim().length > 80) {
      throw new BadRequestException('Child age band label cannot exceed 80 characters');
    }

    if (!Number.isInteger(band.minAge) || !Number.isInteger(band.maxAge)) {
      throw new BadRequestException('Child age band ages must be whole numbers');
    }

    if (band.minAge < 0) {
      throw new BadRequestException('Child age band minimum age cannot be negative');
    }

    if (band.maxAge < band.minAge) {
      throw new BadRequestException(
        `Child age band "${band.label}" maximum age must be greater than or equal to minimum age`,
      );
    }

    if (band.maxAge > maximumChildAge) {
      throw new BadRequestException(
        `Child age band "${band.label}" cannot exceed maximumChildAge ${maximumChildAge}`,
      );
    }

    switch (band.pricingMode) {
      case ChildPricingMode.FREE:
      case ChildPricingMode.ADULT_PRICING:
        if (band.fixedAmount != null || band.percentage != null) {
          throw new BadRequestException(
            `${band.pricingMode} child age bands must not define fixedAmount or percentage`,
          );
        }
        break;

      case ChildPricingMode.FIXED_PER_NIGHT:
        if (band.fixedAmount == null) {
          throw new BadRequestException('FIXED_PER_NIGHT child age bands require fixedAmount');
        }

        this.validateAmount(band.fixedAmount);

        if (band.percentage != null) {
          throw new BadRequestException(
            'FIXED_PER_NIGHT child age bands must not define percentage',
          );
        }
        break;

      case ChildPricingMode.PERCENT_OF_ROOM_RATE:
        if (band.percentage == null) {
          throw new BadRequestException('PERCENT_OF_ROOM_RATE child age bands require percentage');
        }

        this.validatePercentage(band.percentage);

        if (band.fixedAmount != null) {
          throw new BadRequestException(
            'PERCENT_OF_ROOM_RATE child age bands must not define fixedAmount',
          );
        }
        break;

      default:
        throw new BadRequestException(
          `Unsupported child pricing mode: ${String(band.pricingMode)}`,
        );
    }
  }

  private validateAmount(amount: string): void {
    if (!RatesService.AMOUNT_PATTERN.test(amount)) {
      throw new BadRequestException(
        'amount must be a non-negative decimal string with up to 2 decimal places and at most 10 integer digits (e.g. "5000.00")',
      );
    }
  }

  private validatePercentage(percentage: string): void {
    if (!RatesService.PERCENTAGE_PATTERN.test(percentage)) {
      throw new BadRequestException(
        'percentage must be a decimal string with up to 2 decimal places between 0 and 100',
      );
    }

    const [wholePart] = percentage.split('.');
    const whole = Number.parseInt(wholePart, 10);

    if (
      whole > 100 ||
      (whole === 100 && percentage.includes('.') && !/^100(\.0{1,2})?$/.test(percentage))
    ) {
      throw new BadRequestException('percentage must be between 0 and 100');
    }
  }

  private handleRatePlanPersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as {
        code?: string;
        constraint?: string;
      };

      if (driverError.code === '23505') {
        if (driverError.constraint === 'UQ_rate_plans_property_default') {
          throw new ConflictException('Property already has a default rate plan');
        }

        throw new ConflictException('Rate plan code already exists for property');
      }
    }

    throw error;
  }

  private handlePersistenceError(error: unknown, conflictMessage: string): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as {
        code?: string;
      };

      if (driverError.code === '23505') {
        throw new ConflictException(conflictMessage);
      }
    }

    throw error;
  }
}
