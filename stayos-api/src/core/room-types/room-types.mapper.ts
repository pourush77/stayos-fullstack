import { RoomTypeResponseDto } from './dto/room-type-response.dto';
import { RoomTypeEntity } from './infrastructure/room-type.entity';

export class RoomTypesMapper {
  static toResponse(entity: RoomTypeEntity): RoomTypeResponseDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      code: entity.code,
      name: entity.name,
      description: entity.description,
      baseOccupancy: entity.baseOccupancy,
      maxOccupancy: entity.maxOccupancy,
      maxAdults: entity.maxAdults,
      maxChildren: entity.maxChildren,
      bedType: entity.bedType,
      sizeSqFt: entity.sizeSqFt,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
