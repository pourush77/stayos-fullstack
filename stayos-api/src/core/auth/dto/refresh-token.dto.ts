import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @Length(32, 512)
  refreshToken!: string;
}
