import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignHousekeepingRoomDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  employeeId!: string;
}
