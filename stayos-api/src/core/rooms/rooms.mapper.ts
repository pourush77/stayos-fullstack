import { AmenitiesMapper } from '../amenities/amenities.mapper';
import { RoomResponseDto } from './dto/room-response.dto';
import { RoomEntity } from './infrastructure/room.entity';

export class RoomsMapper {
  static toResponse(entity: RoomEntity): RoomResponseDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      floorId: entity.floorId,
      roomTypeId: entity.roomTypeId,
      roomNumber: entity.roomNumber,
      displayName: entity.displayName,
      description: entity.description,
      status: entity.status,
      operationalStatus: entity.operationalStatus,
      operationalStatusReason: entity.operationalStatusReason,
      operationalStatusNote: entity.operationalStatusNote,
      amenities: entity.roomType?.amenities?.map(AmenitiesMapper.toResponse) ?? [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
