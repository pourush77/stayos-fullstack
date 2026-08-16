import { PropertyPolicyEntity } from './infrastructure/property-policy.entity';

export type PropertyPolicyResponse = {
  id: string;
  propertyId: string;
  ratePlanId: string | null;
  policyType: string;
  isActive: boolean;
  depositMode: string | null;
  depositValue: number | null;
  chargeMode: string | null;
  chargeValue: number | null;
  cancellationCutoffHours: number | null;
  graceMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PoliciesMapper {
  static toResponse(entity: PropertyPolicyEntity): PropertyPolicyResponse {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      ratePlanId: entity.ratePlanId ?? null,
      policyType: entity.policyType,
      isActive: entity.isActive,
      depositMode: entity.depositMode ?? null,
      depositValue: entity.depositValue === null ? null : Number(entity.depositValue),
      chargeMode: entity.chargeMode ?? null,
      chargeValue: entity.chargeValue === null ? null : Number(entity.chargeValue),
      cancellationCutoffHours: entity.cancellationCutoffHours ?? null,
      graceMinutes: entity.graceMinutes ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
