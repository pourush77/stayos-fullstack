import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateReservationDto } from './create-reservation.dto';

/**
 * Status is intentionally NOT updatable here. All lifecycle transitions must go
 * through the dedicated endpoints (confirm/cancel/no-show/check-in/check-out/…)
 * which enforce the canonical transition map (single source of truth).
 *
 * `source` is intentionally NOT updatable either: reservation provenance is
 * immutable after creation. External identity (sourceProvider,
 * externalReservationId) is likewise set-once and omitted here.
 * externalConfirmationId is also omitted for now — its controlled write-once
 * setter lands in 1C-d3 (not an ordinary PATCH field).
 */
export class UpdateReservationDto extends PartialType(
  OmitType(CreateReservationDto, [
    'status',
    'source',
    'sourceProvider',
    'externalReservationId',
    'externalConfirmationId',
  ] as const),
) {}
