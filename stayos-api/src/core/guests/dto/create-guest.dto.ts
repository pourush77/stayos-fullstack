import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { GuestStatus } from '../domain/guest-status.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lowerTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const phonePattern = /^[+0-9][0-9+\-\s()]{6,31}$/;
const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export class CreateGuestDto {
  @ApiProperty({ example: 'Aarav', maxLength: 120 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  firstName!: string;

  @ApiPropertyOptional({ example: 'Mehta', maxLength: 120 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Aarav Mehta', maxLength: 240 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 240)
  displayName?: string;

  @ApiProperty({ example: '+919876543210', maxLength: 32 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(7, 32)
  @Matches(phonePattern)
  phone!: string;

  @ApiPropertyOptional({ example: '+919812345678', maxLength: 32 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(7, 32)
  @Matches(phonePattern)
  alternatePhone?: string;

  @ApiPropertyOptional({ example: 'aarav.mehta@example.com', maxLength: 254 })
  @Transform(lowerTrim)
  @IsOptional()
  @IsEmail()
  @Length(1, 254)
  email?: string;

  @ApiPropertyOptional({ example: 'Male', maxLength: 32 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 32)
  gender?: string;

  @ApiPropertyOptional({ example: '1990-01-15', format: 'date' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '2018-11-20', format: 'date' })
  @IsOptional()
  @IsDateString()
  anniversaryDate?: string;

  @ApiPropertyOptional({ example: 'Indian', maxLength: 120 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 120)
  nationality?: string;

  @ApiPropertyOptional({ example: 'English', maxLength: 64 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 64)
  preferredLanguage?: string;

  @ApiPropertyOptional({ example: 'Acme Travels Pvt Ltd', maxLength: 160 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 160)
  companyName?: string;

  @ApiPropertyOptional({ example: '27ABCDE1234F1Z5', maxLength: 15 })
  @Transform(upperTrim)
  @IsOptional()
  @IsString()
  @Length(15, 15)
  @Matches(gstPattern)
  gstNumber?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  vipStatus?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  blacklistStatus?: boolean;

  @ApiPropertyOptional({ example: 'Prefers quiet rooms away from elevator' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;

  @ApiPropertyOptional({ enum: GuestStatus, default: GuestStatus.ACTIVE })
  @IsOptional()
  @IsEnum(GuestStatus)
  status?: GuestStatus;
}
