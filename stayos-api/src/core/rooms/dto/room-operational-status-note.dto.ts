import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RoomOperationalStatusNoteDto {
  @ApiPropertyOptional({
    example: 'Renovation hold',
    maxLength: 120,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  reason?: string;

  @ApiPropertyOptional({
    example: 'Do not assign until engineering clears the room.',
    maxLength: 1000,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;
}
