import { AuthUserDto } from './dto/auth-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserSessionResponseDto } from './dto/user-session-response.dto';
import { UserEntity } from './infrastructure/user.entity';
import { UserSessionEntity } from './infrastructure/user-session.entity';
import { getPermissionsForRole } from './role-permissions';

export class AuthMapper {
  static toAuthUser(user: UserEntity): AuthUserDto {
    return {
      id: user.id,
      propertyId: user.propertyId,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: getPermissionsForRole(user.role),
    };
  }

  static toUserResponse(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      propertyId: user.propertyId,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static toSessionResponse(session: UserSessionEntity): UserSessionResponseDto {
    return {
      id: session.id,
      userId: session.userId,
      userName: session.user?.name ?? '',
      email: session.user?.email ?? '',
      role: session.user?.role,
      status: session.status,
      terminalName: session.terminalName,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    };
  }
}
