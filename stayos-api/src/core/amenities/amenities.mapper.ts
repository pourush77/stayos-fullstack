import { AmenityResponseDto } from './dto/amenity.dto';
import { AmenityEntity } from './infrastructure/amenity.entity';

export class AmenitiesMapper {
  static toResponse(entity: AmenityEntity): AmenityResponseDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      code: entity.code,
      label: entity.label,
      category: entity.category,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
