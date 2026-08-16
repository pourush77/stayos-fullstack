import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateReservationDto } from './create-reservation.dto';

/**
 * Status is intentionally NOT updatable here. All lifecycle transitions must go
 * through the dedicated endpoints (confirm/cancel/no-show/check-in/check-out/…)
 * which enforce the canonical transition map (single source of truth).
 */
export class UpdateReservationDto extends PartialType(
  OmitType(CreateReservationDto, ['status'] as const),
) {}
