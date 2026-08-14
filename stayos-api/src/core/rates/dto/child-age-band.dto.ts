import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { ChildPricingMode } from '../domain/child-pricing-mode.enum';

export class ChildAgeBandDto {
  @ApiProperty({ example: 'Child' })
  @IsString()
  @Length(1, 80)
  label!: string;

  @ApiProperty({ example: 6, minimum: 0 })
  @IsInt()
  @Min(0)
  minAge!: number;

  @ApiProperty({ example: 11, minimum: 0 })
  @IsInt()
  @Min(0)
  maxAge!: number;

  @ApiProperty({ enum: ChildPricingMode })
  @IsEnum(ChildPricingMode)
  pricingMode!: ChildPricingMode;

  @ApiPropertyOptional({ example: '800.00' })
  @IsOptional()
  @IsString()
  fixedAmount?: string | null;

  @ApiPropertyOptional({ example: '20.00' })
  @IsOptional()
  @IsString()
  percentage?: string | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
