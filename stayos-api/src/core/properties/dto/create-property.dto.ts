import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PropertyStatus } from '../domain/property-status.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreatePropertyDto {
  @ApiProperty({ example: 'STAYOS-BLR-001', maxLength: 32 })
  @Transform(upperTrim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 32)
  @Matches(/^[A-Z0-9-]+$/)
  code!: string;

  @ApiProperty({ example: 'StayOS Bengaluru Central', maxLength: 160 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 160)
  name!: string;

  @ApiProperty({ example: 'StayOS Hospitality Private Limited', maxLength: 200 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 200)
  legalName!: string;

  @ApiProperty({ example: '29ABCDE1234F1Z5', maxLength: 15 })
  @Transform(upperTrim)
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
  gstNumber!: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F', maxLength: 10 })
  @Transform(upperTrim)
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
  panNumber?: string;

  @ApiPropertyOptional({ example: 'U55101KA2026PTC123456', maxLength: 32 })
  @Transform(upperTrim)
  @IsOptional()
  @IsString()
  @Length(1, 32)
  cinNumber?: string;

  @ApiPropertyOptional({ example: 'https://assets.stayos.com/properties/blr/logo.png' })
  @Transform(trim)
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  @ApiProperty({ example: 'frontdesk.blr@stayos.com' })
  @Transform(trim)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+918012345678', maxLength: 32 })
  @Transform(trim)
  @IsString()
  @Length(6, 32)
  @Matches(/^[0-9+\-\s()]+$/)
  phone!: string;

  @ApiPropertyOptional({ example: 'https://blr.stayos.com' })
  @Transform(trim)
  @IsOptional()
  @IsUrl({ require_tld: false })
  website?: string;

  @ApiProperty({ example: '12 Residency Road', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 255)
  addressLine1!: string;

  @ApiPropertyOptional({ example: 'Near MG Road Metro', maxLength: 255 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @ApiProperty({ example: 'Bengaluru', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  city!: string;

  @ApiProperty({ example: 'Karnataka', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  state!: string;

  @ApiProperty({ example: '29', maxLength: 2 })
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9]{2}$/)
  stateCode!: string;

  @ApiProperty({ example: 'India', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  country!: string;

  @ApiProperty({ example: '560001', maxLength: 16 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(3, 16)
  postalCode!: string;

  @ApiProperty({ example: 'Asia/Kolkata', maxLength: 64 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(3, 64)
  timezone!: string;

  @ApiProperty({ example: 'INR', maxLength: 3 })
  @Transform(upperTrim)
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @ApiProperty({ example: '14:00' })
  @Transform(trim)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkInTime!: string;

  @ApiProperty({ example: '11:00' })
  @Transform(trim)
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkOutTime!: string;

  @ApiProperty({ example: 6, minimum: 0, maximum: 1000 })
  @IsInt()
  @Min(0)
  @Max(1000)
  totalFloors!: number;

  @ApiProperty({ example: 120, minimum: 0, maximum: 100000 })
  @IsInt()
  @Min(0)
  @Max(100000)
  totalRooms!: number;

  @ApiPropertyOptional({ enum: PropertyStatus, default: PropertyStatus.ACTIVE })
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;
}
