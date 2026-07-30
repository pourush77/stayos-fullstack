import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';
import { CFormStatus } from '../domain/c-form-status.enum';
import { IsEnum } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lowerTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const phonePattern = /^[+0-9][0-9+\-\s()]{6,31}$/;

export class UpdateGuestRegistrationDto {
  @ApiPropertyOptional({ maxLength: 240 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 240)
  fullName?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(7, 32)
  @Matches(phonePattern)
  mobile?: string;

  @ApiPropertyOptional({ maxLength: 254 })
  @Transform(lowerTrim)
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ maxLength: 32 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ maxLength: 240 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ maxLength: 240 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  purposeOfVisit?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  arrivalFrom?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  nextDestination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isForeignNational?: boolean;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  passportNumber?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  passportIssuePlace?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  passportIssueDate?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  passportExpiryDate?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  visaNumber?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  visaType?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  visaIssueDate?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  visaExpiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cFormRequired?: boolean;

  @ApiPropertyOptional({ enum: CFormStatus })
  @IsOptional()
  @IsEnum(CFormStatus)
  cFormStatus?: CFormStatus;
}
