import { PropertyResponseDto } from './dto/property-response.dto';
import { GroupBookingDepositPolicyType } from './domain/group-booking-deposit-policy-type.enum';
import { PropertyEntity } from './infrastructure/property.entity';

export type ResolvedGroupDeposit = {
  type: GroupBookingDepositPolicyType;
  value: number;
};

export class PropertiesMapper {
  static toResponse(entity: PropertyEntity, deposit: ResolvedGroupDeposit): PropertyResponseDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      legalName: entity.legalName,
      gstNumber: entity.gstNumber,
      panNumber: entity.panNumber,
      cinNumber: entity.cinNumber,
      logoUrl: entity.logoUrl,
      email: entity.email,
      phone: entity.phone,
      website: entity.website,
      addressLine1: entity.addressLine1,
      addressLine2: entity.addressLine2,
      city: entity.city,
      state: entity.state,
      stateCode: entity.stateCode,
      country: entity.country,
      postalCode: entity.postalCode,
      timezone: entity.timezone,
      currency: entity.currency,
      checkInTime: entity.checkInTime,
      checkOutTime: entity.checkOutTime,
      businessDayCutOffTime: entity.businessDayCutOffTime,
      totalFloors: entity.totalFloors,
      totalRooms: entity.totalRooms,
      status: entity.status,
      groupBookingDepositPolicyType: deposit.type,
      groupBookingDepositPolicyValue:
        deposit.type === GroupBookingDepositPolicyType.NONE ? null : deposit.value,
      emailNotificationsEnabled: entity.emailNotificationsEnabled,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
