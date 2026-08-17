import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { FolioPaymentMethod } from '../domain/folio-payment-method.enum';

export class CreateFolioRefundDto {
  @ApiProperty({ description: 'Id of the original PAYMENT this refund reverses' })
  @IsUUID()
  originalPaymentId!: string;

  @ApiProperty({ example: '500.00', description: 'Positive refund amount; cannot exceed the original payment less prior refunds' })
  @IsNumberString()
  amount!: string;

  @ApiProperty({ enum: FolioPaymentMethod, required: false, description: 'Defaults to the original payment method' })
  @IsOptional()
  @IsEnum(FolioPaymentMethod)
  method?: FolioPaymentMethod;

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

  @ApiProperty({ required: false, maxLength: 120, description: 'Idempotency key to make a retried refund safe' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}
