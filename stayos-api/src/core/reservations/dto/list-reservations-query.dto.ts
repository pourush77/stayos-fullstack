import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ReservationSource } from '../domain/reservation-source.enum';

/**
 * Reservation list/search query. Extends the shared pagination/sort/search DTO
 * with property-scoped provenance filters (1C-d3). Legacy source values
 * (DIRECT/OTA/…) remain valid filter inputs for backward-compatible reads.
 */
export class ListReservationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReservationSource, description: 'Filter by reservation source (incl. legacy values)' })
  @IsOptional()
  @IsEnum(ReservationSource)
  source?: ReservationSource;

  @ApiPropertyOptional({ maxLength: 64, description: 'Filter by normalized channel/provider identifier (e.g. BOOKING_COM)' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsString()
  @Length(1, 64)
  sourceProvider?: string;
}
