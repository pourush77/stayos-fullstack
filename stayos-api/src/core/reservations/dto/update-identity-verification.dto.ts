import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, Length } from 'class-validator';
import { IdentityDocumentType } from '../domain/identity-document-type.enum';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateIdentityVerificationDto {
  @ApiProperty({ enum: IdentityDocumentType })
  @IsEnum(IdentityDocumentType)
  idType!: IdentityDocumentType;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(3, 80)
  idNumber!: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsUrl({ require_tld: false })
  documentFrontUrl?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsUrl({ require_tld: false })
  documentBackUrl?: string;

  @ApiProperty()
  @IsBoolean()
  verified!: boolean;
}
