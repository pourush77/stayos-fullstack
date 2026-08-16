import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum';
import { PropertyEntity } from '../properties/infrastructure/property.entity';
import { RatePlanEntity } from '../rates/infrastructure/rate-plan.entity';
import { normalizeDepositPolicy } from './domain/normalize-deposit-policy';
import { normalizePolicyCharge } from './domain/normalize-policy-charge';
import {
  CHARGE_POLICY_TYPES,
  DEPOSIT_POLICY_TYPES,
  PropertyPolicyType,
} from './domain/property-policy-type.enum';
import { UpsertPropertyPolicyDto } from './dto/upsert-property-policy.dto';
import { PropertyPolicyEntity } from './infrastructure/property-policy.entity';

const DEPOSIT_LABELS: Record<string, string> = {
  [PropertyPolicyType.INDIVIDUAL_DEPOSIT]: 'Individual deposit',
  [PropertyPolicyType.GROUP_DEPOSIT]: 'Group deposit',
};

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(PropertyPolicyEntity)
    private readonly policiesRepository: Repository<PropertyPolicyEntity>,
    @InjectRepository(RatePlanEntity)
    private readonly ratePlansRepository: Repository<RatePlanEntity>,
    @InjectRepository(PropertyEntity)
    private readonly propertiesRepository: Repository<PropertyEntity>,
  ) {}

  private async assertPropertyExists(
    propertyId: string,
    repository: Repository<PropertyEntity> = this.propertiesRepository,
  ): Promise<void> {
    const property = await repository.findOne({ where: { id: propertyId } });
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} was not found`);
    }
  }

  async list(propertyId: string): Promise<PropertyPolicyEntity[]> {
    await this.assertPropertyExists(propertyId);

    return this.policiesRepository.find({
      where: { propertyId },
      order: { policyType: 'ASC' },
    });
  }

  async getOne(
    propertyId: string,
    policyType: PropertyPolicyType,
    ratePlanId: string | null = null,
  ): Promise<PropertyPolicyEntity | null> {
    await this.assertPropertyExists(propertyId);

    return this.policiesRepository.findOne({
      where: { propertyId, policyType, ratePlanId: ratePlanId ?? IsNull() },
    });
  }

  async upsert(
    propertyId: string,
    policyType: PropertyPolicyType,
    dto: UpsertPropertyPolicyDto,
    manager?: EntityManager,
  ): Promise<PropertyPolicyEntity> {
    const policiesRepo = manager
      ? manager.getRepository(PropertyPolicyEntity)
      : this.policiesRepository;
    const ratePlansRepo = manager ? manager.getRepository(RatePlanEntity) : this.ratePlansRepository;
    const propertiesRepo = manager ? manager.getRepository(PropertyEntity) : this.propertiesRepository;

    await this.assertPropertyExists(propertyId, propertiesRepo);

    const ratePlanId = dto.ratePlanId ?? null;
    await this.assertRatePlanBelongsToProperty(propertyId, ratePlanId, ratePlansRepo);

    const existing = await policiesRepo.findOne({
      where: { propertyId, policyType, ratePlanId: ratePlanId ?? IsNull() },
    });

    const policy = existing ?? policiesRepo.create({ propertyId, policyType, ratePlanId });
    policy.isActive = dto.isActive ?? true;
    policy.depositMode = null;
    policy.depositValue = null;
    policy.chargeMode = null;
    policy.chargeValue = null;
    policy.cancellationCutoffHours = null;
    policy.graceMinutes = null;

    if (DEPOSIT_POLICY_TYPES.includes(policyType)) {
      this.applyDepositPolicy(policy, dto);
    } else if (CHARGE_POLICY_TYPES.includes(policyType)) {
      this.applyChargePolicy(policy, policyType, dto);
    } else {
      throw this.invalid(`Unsupported policy type: ${String(policyType)}`);
    }

    return policiesRepo.save(policy);
  }

  private applyDepositPolicy(policy: PropertyPolicyEntity, dto: UpsertPropertyPolicyDto): void {
    this.rejectFields(dto, ['chargeMode', 'chargeValue', 'cancellationCutoffHours', 'graceMinutes']);

    if (dto.depositMode === undefined) {
      throw this.invalid('depositMode is required for deposit policies.');
    }

    const normalized = normalizeDepositPolicy(
      { type: dto.depositMode, value: dto.depositValue },
      { label: DEPOSIT_LABELS[policy.policyType] ?? 'Deposit' },
    );
    policy.depositMode = normalized.type;
    policy.depositValue = normalized.value.toFixed(2);
  }

  private applyChargePolicy(
    policy: PropertyPolicyEntity,
    policyType: PropertyPolicyType,
    dto: UpsertPropertyPolicyDto,
  ): void {
    this.rejectFields(dto, ['depositMode', 'depositValue']);

    const isCancellation = policyType === PropertyPolicyType.CANCELLATION;
    const isThresholdFee =
      policyType === PropertyPolicyType.EARLY_CHECK_IN ||
      policyType === PropertyPolicyType.LATE_CHECKOUT;

    if (!isCancellation) {
      this.rejectFields(dto, ['cancellationCutoffHours']);
    }
    if (!isThresholdFee) {
      this.rejectFields(dto, ['graceMinutes']);
    }

    if (dto.chargeMode === undefined) {
      throw this.invalid('chargeMode is required for this policy.');
    }

    const allowFirstNight =
      policyType === PropertyPolicyType.CANCELLATION ||
      policyType === PropertyPolicyType.NO_SHOW;

    const normalized = normalizePolicyCharge(
      { mode: dto.chargeMode, value: dto.chargeValue },
      { allowFirstNight },
    );
    policy.chargeMode = normalized.mode;
    policy.chargeValue = normalized.value.toFixed(2);

    if (isCancellation && dto.cancellationCutoffHours !== undefined) {
      policy.cancellationCutoffHours = dto.cancellationCutoffHours;
    }
    if (isThresholdFee && dto.graceMinutes !== undefined) {
      policy.graceMinutes = dto.graceMinutes;
    }
  }

  private rejectFields(dto: UpsertPropertyPolicyDto, fields: Array<keyof UpsertPropertyPolicyDto>): void {
    for (const field of fields) {
      if (dto[field] !== undefined) {
        throw this.invalid(`${field} is not applicable for this policy type.`);
      }
    }
  }

  private async assertRatePlanBelongsToProperty(
    propertyId: string,
    ratePlanId: string | null,
    repository: Repository<RatePlanEntity> = this.ratePlansRepository,
  ): Promise<void> {
    if (ratePlanId === null) return;

    const ratePlan = await repository.findOne({
      where: { id: ratePlanId, propertyId },
    });

    if (!ratePlan) {
      throw new NotFoundException(`Rate plan ${ratePlanId} was not found for this property`);
    }
  }

  private invalid(message: string): BadRequestException {
    return new BadRequestException({ code: ApiErrorCode.VALIDATION_ERROR, message });
  }
}
