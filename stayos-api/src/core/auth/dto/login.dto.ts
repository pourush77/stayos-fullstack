import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class LoginDto {
  @ApiProperty({ example: 'frontdesk@stayos.local' })
  @Transform(trimLower)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiPropertyOptional({ example: 'Front Desk Terminal 1' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 160)
  terminalName?: string;
}
