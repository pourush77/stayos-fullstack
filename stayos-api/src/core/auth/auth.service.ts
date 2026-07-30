import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum';
import { AuthMapper } from './auth.mapper';
import { UserRole } from './domain/user-role.enum';
import { UserSessionStatus } from './domain/user-session-status.enum';
import { UserStatus } from './domain/user-status.enum';
import { AuthUserDto } from './dto/auth-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserSessionResponseDto } from './dto/user-session-response.dto';
import { UserEntity } from './infrastructure/user.entity';
import { UserSessionEntity } from './infrastructure/user-session.entity';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(UserSessionEntity)
    private readonly sessionsRepository: Repository<UserSessionEntity>,
    private readonly passwordService: PasswordService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtStrategy: JwtStrategy,
    private readonly configService: ConfigService,
  ) {}

  async login(
    loginDto: LoginDto,
    context: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<LoginResponseDto> {
    const user = await this.usersRepository.findOne({ where: { email: loginDto.email } });

    if (
      !user ||
      !(await this.passwordService.verifyPassword(loginDto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException({
        code: ApiErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: ApiErrorCode.USER_INACTIVE,
        message: 'User is inactive',
      });
    }

    const now = new Date();
    const refreshToken = this.refreshTokenService.generate();
    const session = this.sessionsRepository.create({
      userId: user.id,
      propertyId: user.propertyId,
      refreshTokenHash: this.refreshTokenService.hash(refreshToken),
      status: UserSessionStatus.ACTIVE,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      terminalName: loginDto.terminalName ?? null,
      lastActivityAt: now,
      lockedAt: null,
      expiresAt: this.refreshExpiry(),
      revokedAt: null,
    });

    const savedSession = await this.sessionsRepository.save(session);
    user.lastLoginAt = now;
    await this.usersRepository.save(user);

    return this.issueTokenResponse(user, savedSession, refreshToken);
  }

  async refresh(refreshToken: string): Promise<LoginResponseDto> {
    const session = await this.findSessionByRefreshToken(refreshToken);
    const user = session.user;

    this.ensureSessionUsable(session);
    this.ensureUserActive(user);

    if (this.isIdleLocked(session)) {
      session.status = UserSessionStatus.LOCKED;
      session.lockedAt = new Date();
      await this.sessionsRepository.save(session);
      throw new ForbiddenException({
        code: ApiErrorCode.SESSION_LOCKED,
        message: 'Session is locked due to inactivity',
      });
    }

    const newRefreshToken = this.refreshTokenService.generate();
    session.refreshTokenHash = this.refreshTokenService.hash(newRefreshToken);
    session.lastActivityAt = new Date();
    session.lockedAt = null;
    await this.sessionsRepository.save(session);

    return this.issueTokenResponse(user, session, newRefreshToken);
  }

  async unlock(refreshToken: string, password: string): Promise<LoginResponseDto> {
    const session = await this.findSessionByRefreshToken(refreshToken);
    const user = session.user;

    if (!(await this.passwordService.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: ApiErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    this.ensureUserActive(user);
    const newRefreshToken = this.refreshTokenService.generate();
    session.status = UserSessionStatus.ACTIVE;
    session.refreshTokenHash = this.refreshTokenService.hash(newRefreshToken);
    session.lastActivityAt = new Date();
    session.lockedAt = null;
    await this.sessionsRepository.save(session);

    return this.issueTokenResponse(user, session, newRefreshToken);
  }

  async logout(sessionId: string): Promise<{ loggedOut: true }> {
    const session = await this.sessionsRepository.findOne({ where: { id: sessionId } });

    if (session) {
      session.status = UserSessionStatus.REVOKED;
      session.revokedAt = new Date();
      await this.sessionsRepository.save(session);
    }

    return { loggedOut: true };
  }

  async getMe(userId: string, sessionId: string): Promise<AuthUserDto> {
    const [user, session] = await Promise.all([
      this.usersRepository.findOne({ where: { id: userId } }),
      this.sessionsRepository.findOne({ where: { id: sessionId } }),
    ]);

    if (!user || !session) {
      throw new UnauthorizedException({ code: ApiErrorCode.UNAUTHORIZED, message: 'Unauthorized' });
    }

    session.lastActivityAt = new Date();
    await this.sessionsRepository.save(session);

    return AuthMapper.toAuthUser(user);
  }

  async validateAccessToken(token: string): Promise<AuthUserDto & { sessionId: string }> {
    const payload = this.jwtStrategy.verify(token);
    const [user, session] = await Promise.all([
      this.usersRepository.findOne({ where: { id: payload.sub } }),
      this.sessionsRepository.findOne({ where: { id: payload.sessionId } }),
    ]);

    if (!user || !session) {
      throw new UnauthorizedException({ code: ApiErrorCode.UNAUTHORIZED, message: 'Unauthorized' });
    }

    this.ensureUserActive(user);

    if (session.status === UserSessionStatus.LOCKED) {
      throw new ForbiddenException({
        code: ApiErrorCode.SESSION_LOCKED,
        message: 'Session is locked',
      });
    }

    if (session.status === UserSessionStatus.REVOKED) {
      throw new UnauthorizedException({
        code: ApiErrorCode.SESSION_REVOKED,
        message: 'Session was revoked',
      });
    }

    if (session.expiresAt <= new Date()) {
      session.status = UserSessionStatus.EXPIRED;
      await this.sessionsRepository.save(session);
      throw new UnauthorizedException({
        code: ApiErrorCode.SESSION_EXPIRED,
        message: 'Session expired',
      });
    }

    return { ...AuthMapper.toAuthUser(user), sessionId: session.id };
  }

  async listUsers(propertyId: string): Promise<UserResponseDto[]> {
    const users = await this.usersRepository.find({
      where: { propertyId },
      order: { name: 'ASC' },
    });

    return users.map(AuthMapper.toUserResponse);
  }

  async getUser(propertyId: string, userId: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId, propertyId } });

    if (!user) {
      throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'User not found' });
    }

    return AuthMapper.toUserResponse(user);
  }

  async createUser(
    propertyId: string,
    dto: CreateUserDto,
    actor?: AuthUserDto & { sessionId: string },
  ): Promise<UserResponseDto> {
    if (dto.role === UserRole.OWNER && actor?.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Only owners can create owner users',
      });
    }

    try {
      const user = this.usersRepository.create({
        propertyId,
        name: dto.name,
        email: dto.email,
        passwordHash: await this.passwordService.hashPassword(dto.password),
        role: dto.role,
        status: dto.status ?? UserStatus.ACTIVE,
        lastLoginAt: null,
      });

      return AuthMapper.toUserResponse(await this.usersRepository.save(user));
    } catch (error) {
      this.handleUserPersistenceError(error);
    }
  }

  async updateUser(
    propertyId: string,
    userId: string,
    dto: UpdateUserDto,
    actor?: AuthUserDto & { sessionId: string },
  ): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId, propertyId } });

    if (!user) {
      throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'User not found' });
    }

    if (actor?.id === userId && dto.role && dto.role !== user.role) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Users cannot update their own role',
      });
    }

    if (dto.role === UserRole.OWNER && actor?.role !== UserRole.OWNER) {
      throw new ForbiddenException({
        code: ApiErrorCode.FORBIDDEN,
        message: 'Only owners can assign owner role',
      });
    }

    Object.assign(user, {
      name: dto.name ?? user.name,
      email: dto.email ?? user.email,
      role: dto.role ?? user.role,
      status: dto.status ?? user.status,
    });

    if (dto.password) {
      user.passwordHash = await this.passwordService.hashPassword(dto.password);
    }

    try {
      return AuthMapper.toUserResponse(await this.usersRepository.save(user));
    } catch (error) {
      this.handleUserPersistenceError(error);
    }
  }

  async listSessions(propertyId: string): Promise<UserSessionResponseDto[]> {
    const sessions = await this.sessionsRepository.find({
      where: [
        { propertyId, status: UserSessionStatus.ACTIVE },
        { propertyId, status: UserSessionStatus.LOCKED },
      ],
      relations: { user: true },
      order: { lastActivityAt: 'DESC' },
    });

    return sessions.map(AuthMapper.toSessionResponse);
  }

  async revokeSession(propertyId: string, sessionId: string): Promise<UserSessionResponseDto> {
    const session = await this.sessionsRepository.findOne({
      where: { id: sessionId, propertyId },
      relations: { user: true },
    });

    if (!session) {
      throw new NotFoundException({ code: ApiErrorCode.NOT_FOUND, message: 'Session not found' });
    }

    session.status = UserSessionStatus.REVOKED;
    session.revokedAt = new Date();

    return AuthMapper.toSessionResponse(await this.sessionsRepository.save(session));
  }

  private async findSessionByRefreshToken(refreshToken: string): Promise<UserSessionEntity> {
    const session = await this.sessionsRepository.findOne({
      where: { refreshTokenHash: this.refreshTokenService.hash(refreshToken) },
      relations: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: ApiErrorCode.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token',
      });
    }

    return session;
  }

  private ensureSessionUsable(session: UserSessionEntity): void {
    if (session.status === UserSessionStatus.REVOKED) {
      throw new UnauthorizedException({
        code: ApiErrorCode.SESSION_REVOKED,
        message: 'Session was revoked',
      });
    }

    if (session.expiresAt <= new Date() || session.status === UserSessionStatus.EXPIRED) {
      throw new UnauthorizedException({
        code: ApiErrorCode.SESSION_EXPIRED,
        message: 'Session expired',
      });
    }
  }

  private ensureUserActive(user: UserEntity): void {
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: ApiErrorCode.USER_INACTIVE,
        message: 'User is inactive',
      });
    }
  }

  private isIdleLocked(session: UserSessionEntity): boolean {
    const idleMinutes = Number(this.configService.get<number>('auth.sessionIdleLockMinutes') ?? 30);
    const idleMs = idleMinutes * 60 * 1000;

    return Date.now() - session.lastActivityAt.getTime() > idleMs;
  }

  private refreshExpiry(): Date {
    const days = Number(this.configService.get<number>('jwt.refreshExpiresInDays') ?? 14);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private issueTokenResponse(
    user: UserEntity,
    session: UserSessionEntity,
    refreshToken: string,
  ): LoginResponseDto {
    const { token, expiresIn } = this.jwtStrategy.sign({
      sub: user.id,
      sessionId: session.id,
      propertyId: user.propertyId,
      role: user.role,
    });

    return {
      accessToken: token,
      refreshToken,
      expiresIn,
      user: AuthMapper.toAuthUser(user),
    };
  }

  private handleUserPersistenceError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string };

      if (driverError.code === '23505') {
        throw new ConflictException('User email already exists');
      }
    }

    throw error;
  }
}
