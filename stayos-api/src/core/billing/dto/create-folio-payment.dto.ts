import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';
import { FolioPaymentMethod } from '../domain/folio-payment-method.enum';

export class CreateFolioPaymentDto {
  @ApiProperty({ enum: FolioPaymentMethod })
  @IsEnum(FolioPaymentMethod)
  method!: FolioPaymentMethod;

  @ApiProperty({ example: '3500.00' })
  @IsNumberString()
  amount!: string;

  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, description: 'ISO8601 timestamp; defaults to now' })
  @IsOptional()
  @IsISO8601()
  receivedAt?: string;
}
