import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PaymentReviewDto {
  @ApiProperty()
  @IsBoolean()
  paymentReviewed!: boolean;

  @ApiPropertyOptional({ maxLength: 80 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 80)
  paymentMethod?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}
