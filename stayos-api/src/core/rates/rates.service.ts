import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PropertiesService } from '../properties/properties.service';
import { RoomTypesService } from '../room-types/room-types.service';
import { CreateDailyRateInput } from './dto/create-daily-rate.input';
import { CreateRatePlanInput } from './dto/create-rate-plan.input';
import { RatePlanEntity } from './infrastructure/rate-plan.entity';
import { RoomTypeDailyRateEntity } from './infrastructure/room-type-daily-rate.entity';

@Injectable()
export class RatesService {
  constructor(
    @InjectRepository(RatePlanEntity)
    private readonly ratePlansRepository: Repository<RatePlanEntity>,
    @InjectRepository(RoomTypeDailyRateEntity)
    private readonly dailyRatesRepository: Repository<RoomTypeDailyRateEntity>,
    private readonly propertiesService: PropertiesService,
    private readonly roomTypesService: RoomTypesService,
  ) {}

  async findRatePlans(propertyId: string): Promise<RatePlanEntity[]> {
    await this.propertiesService.findOne(propertyId);

    return this.ratePlansRepository.find({ where: { propertyId }, order: { name: 'ASC' } });
  }

  async findRatePlan(propertyId: string, id: string): Promise<RatePlanEntity> {
    await this.propertiesService.findOne(propertyId);
    const ratePlan = await this.ratePlansRepository.findOne({ where: { id, propertyId } });

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

  // Property isolation is enforced here at the application level (not via a composite DB FK):
  // both lookups are scoped by propertyId, so a room type or rate plan belonging to a different
  // property will raise NotFoundException before any row can be written.
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

  // Deterministic string validation for a numeric(12,2)-compatible amount: no JS floating-point
  // arithmetic touches the stored value, so "1e5", "12.345", and negative/blank/non-numeric input
  // are all rejected before reaching the database.
  private static readonly AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

  private validateAmount(amount: string): void {
    if (!RatesService.AMOUNT_PATTERN.test(amount)) {
      throw new BadRequestException(
        'amount must be a non-negative decimal string with up to 2 decimal places and at most 10 integer digits (e.g. "5000.00")',
      );
    }
  }

  private handleRatePlanPersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string; constraint?: string };

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
      const driverError = error.driverError as { code?: string };

      if (driverError.code === '23505') {
        throw new ConflictException(conflictMessage);
      }
    }

    throw error;
  }
}
