import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignRoomDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roomId!: string;
}
