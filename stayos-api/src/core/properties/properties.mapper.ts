import { PropertyResponseDto } from './dto/property-response.dto';
import { PropertyEntity } from './infrastructure/property.entity';

export class PropertiesMapper {
  static toResponse(entity: PropertyEntity): PropertyResponseDto {
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
      totalFloors: entity.totalFloors,
      totalRooms: entity.totalRooms,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
