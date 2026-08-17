import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

/**
 * Status is intentionally NOT updatable here. All lifecycle transitions must go
 * through the dedicated endpoints (confirm/cancel/no-show/check-in/check-out/…)
 * which enforce the canonical transition map (single source of truth).
 *
 * `source`, `sourceProvider` and `externalReservationId` are provenance/identity
 * and remain IMMUTABLE after creation (omitted here entirely).
 *
 * `externalConfirmationId` is WRITE-ONCE (1C-d3): it may be attached via PATCH
 * only while NULL; once set it cannot be changed or cleared (the service raises
 * a controlled 409 EXTERNAL_CONFIRMATION_IMMUTABLE). It is re-declared here
 * (not inherited) so an explicit `null` passes validation and reaches the
 * service for a controlled domain rejection rather than a raw validation error.
 */
export class UpdateReservationDto extends PartialType(
  OmitType(CreateReservationDto, [
    'status',
    'source',
    'sourceProvider',
    'externalReservationId',
    'externalConfirmationId',
  ] as const),
) {
  @ApiPropertyOptional({
    maxLength: 128,
    nullable: true,
    description: 'Write-once external confirmation number. Attachable only while NULL; cannot be changed or cleared once set.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 128)
  externalConfirmationId?: string | null;
}
