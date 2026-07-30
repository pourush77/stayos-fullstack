import { FloorResponseDto } from './dto/floor-response.dto';
import { FloorEntity } from './infrastructure/floor.entity';

export class FloorsMapper {
  static toResponse(entity: FloorEntity): FloorResponseDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      code: entity.code,
      name: entity.name,
      floorNumber: entity.floorNumber,
      displayOrder: entity.displayOrder,
      description: entity.description,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
