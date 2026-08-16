import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LifecycleActionDto {
  @ApiPropertyOptional({ maxLength: 500, description: 'Optional reason for cancellation/no-show.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
