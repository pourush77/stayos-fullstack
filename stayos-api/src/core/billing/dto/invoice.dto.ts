import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FinalizeInvoiceDto {
  @ApiProperty({ required: false, maxLength: 120, description: 'Idempotency key so a retried finalize never creates a second invoice' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class IssueCreditNoteDto {
  @ApiProperty({ description: 'Reason for the credit note / correction' })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class VoidInvoiceDto {
  @ApiProperty({ description: 'Reason for voiding the draft invoice' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
