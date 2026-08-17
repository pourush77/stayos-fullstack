import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VoidFolioChargeDto {
  @ApiProperty({ maxLength: 200, description: 'Reason for the reversal (audited on the reversal row)' })
  @IsString()
  @Length(1, 200)
  reason!: string;
}
