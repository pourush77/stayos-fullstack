import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class GlobalSearchQueryDto {
  @ApiProperty({
    type: String,
    example: 'Rahul',
    description: 'Search by guest, phone, reservation, room or folio',
    minLength: 2,
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(2)
  q!: string;

  @ApiPropertyOptional({
    type: Number,
    example: 5,
    minimum: 1,
    maximum: 10,
    default: 5,
    description: 'Maximum results returned per category',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}
