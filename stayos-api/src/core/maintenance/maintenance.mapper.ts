import { MaintenanceTicketResponseDto } from './dto/maintenance.dto';
import { MaintenanceTicketEntity } from './infrastructure/maintenance-ticket.entity';

export class MaintenanceMapper {
  static toResponse(entity: MaintenanceTicketEntity): MaintenanceTicketResponseDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      roomId: entity.roomId,
      roomNumber: entity.room?.roomNumber ?? null,
      reportedByUserId: entity.reportedByUserId,
      assignedToUserId: entity.assignedToUserId,
      title: entity.title,
      description: entity.description,
      category: entity.category,
      priority: entity.priority,
      status: entity.status,
      reportedAt: entity.reportedAt,
      resolvedAt: entity.resolvedAt,
      resolutionNote: entity.resolutionNote,
    };
  }
}
