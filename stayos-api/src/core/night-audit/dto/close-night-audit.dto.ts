import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CloseNightAuditDto {
  @ApiPropertyOptional({
    maxLength: 2000,
    description: "Optional handover note saved with this business day's Night Audit.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  auditorNote?: string;
}
