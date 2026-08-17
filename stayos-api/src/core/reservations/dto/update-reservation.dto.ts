import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateReservationDto } from './create-reservation.dto';

/**
 * Status is intentionally NOT updatable here. All lifecycle transitions must go
 * through the dedicated endpoints (confirm/cancel/no-show/check-in/check-out/…)
 * which enforce the canonical transition map (single source of truth).
 *
 * `source` is intentionally NOT updatable either: reservation provenance is
 * immutable after creation. (External identifiers, added in 1C-d2, follow the
 * same rule; any administrative correction is a separate audited capability.)
 */
export class UpdateReservationDto extends PartialType(
  OmitType(CreateReservationDto, ['status', 'source'] as const),
) {}
