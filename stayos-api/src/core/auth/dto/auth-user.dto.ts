import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Permission } from '../permissions';
import { UserRole } from '../domain/user-role.enum';

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  propertyId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ type: [String] })
  permissions!: Permission[];
}
