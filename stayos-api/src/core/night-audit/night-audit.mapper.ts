import { NightAuditRunResponseDto } from './dto/night-audit-run-response.dto';
import { NightAuditValidationDto } from './dto/night-audit-validation.dto';
import { NightAuditWorkspaceDto } from './dto/night-audit-workspace.dto';
import { NightAuditRunEntity } from './infrastructure/night-audit-run.entity';

export class NightAuditMapper {
  static toResponse(
    entity: NightAuditRunEntity,
    workspace?: NightAuditWorkspaceDto,
    validation?: NightAuditValidationDto,
    nextBusinessDate?: string | null,
  ): NightAuditRunResponseDto {
    return {
      id: entity.id,
      propertyId: entity.propertyId,
      businessDate: entity.businessDate,
      status: entity.status,
      startedAt: entity.startedAt,
      startedByUserId: entity.startedByUserId,
      completedByUserId: entity.completedByUserId ?? null,
      completedAt: entity.completedAt ?? null,
      summary: entity.summary ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      ...(nextBusinessDate !== undefined ? { nextBusinessDate } : {}),
      ...(workspace ? { workspace } : {}),
      ...(validation ? { validation } : {}),
    };
  }
}
