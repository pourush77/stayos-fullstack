import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateStaffAccessDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
