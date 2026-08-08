import { GuestRequestStatus } from './domain/guest-request-status.enum';
import { GuestRequestResponseDto } from './dto/guest-request.dto';
import { GuestRequestEntity } from './infrastructure/guest-request.entity';

export class GuestRequestsMapper {
  static toResponse(entity: GuestRequestEntity, now = new Date()): GuestRequestResponseDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      reservationId: entity.reservationId,
      guestId: entity.guestId,
      roomId: entity.roomId,

      requestType: entity.requestType,
      details: entity.details,

      title: entity.title,
      description: entity.description,
      status: entity.status,
      priority: entity.priority,
      department: entity.department,

      overdue:
        Boolean(entity.dueAt && entity.dueAt.getTime() < now.getTime()) &&
        ![GuestRequestStatus.COMPLETED, GuestRequestStatus.CANCELLED].includes(entity.status),

      guestDisplayName: entity.guest?.displayName ?? null,
      roomNumber: entity.room?.roomNumber ?? null,
      reservationCode: entity.reservation?.reservationCode ?? null,
      assignedEmployeeName: entity.assignedEmployee?.displayName ?? null,

      dueAt: entity.dueAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
