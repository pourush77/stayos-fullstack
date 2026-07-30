import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class UnlockSessionDto {
  @ApiProperty()
  @IsString()
  @Length(32, 512)
  refreshToken!: string;

  @ApiProperty()
  @IsString()
  @Length(8, 128)
  password!: string;
}
