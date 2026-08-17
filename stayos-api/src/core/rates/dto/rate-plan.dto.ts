import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RatePlanStatus } from '../domain/rate-plan-status.enum';
import { MealPlan } from '../domain/meal-plan.enum';

export class CreateRatePlanDto {
  @ApiProperty({ example: 'BAR' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'code must be uppercase alphanumeric with - or _' })
  code!: string;

  @ApiProperty({ example: 'Best Available Rate' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Flexible rate' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: RatePlanStatus })
  @IsOptional()
  @IsEnum(RatePlanStatus)
  status?: RatePlanStatus;

  @ApiPropertyOptional({ enum: MealPlan, default: MealPlan.ROOM_ONLY })
  @IsOptional()
  @IsEnum(MealPlan)
  mealPlan?: MealPlan;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  refundable?: boolean;
}

export class UpdateRatePlanDto {
  @ApiPropertyOptional({ example: 'Best Available Rate' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Flexible rate' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: RatePlanStatus })
  @IsOptional()
  @IsEnum(RatePlanStatus)
  status?: RatePlanStatus;

  @ApiPropertyOptional({ enum: MealPlan })
  @IsOptional()
  @IsEnum(MealPlan)
  mealPlan?: MealPlan;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  refundable?: boolean;
}

const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

export class UpsertRatePlanRoomTypeDto {
  @ApiProperty({ example: '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674' })
  @IsString()
  roomTypeId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  baseOccupancy!: number;

  @ApiProperty({ example: '5000.00' })
  @IsString()
  @Matches(MONEY, { message: 'baseRate must be a non-negative decimal string' })
  baseRate!: string;

  @ApiPropertyOptional({ example: '1500.00' })
  @IsOptional()
  @IsString()
  @Matches(MONEY, { message: 'extraAdultCharge must be a non-negative decimal string' })
  extraAdultCharge?: string;

  @ApiPropertyOptional({ example: '750.00' })
  @IsOptional()
  @IsString()
  @Matches(MONEY, { message: 'extraChildCharge must be a non-negative decimal string' })
  extraChildCharge?: string;
}

export class CreateDailyRateDto {
  @ApiProperty({ example: '8075c8fa-f36e-4f40-a3ef-2e9dbb1f0674' })
  @IsString()
  roomTypeId!: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'stayDate must be YYYY-MM-DD' })
  stayDate!: string;

  @ApiProperty({ example: '6500.00' })
  @IsString()
  @Matches(MONEY, { message: 'amount must be a non-negative decimal string' })
  amount!: string;
}
