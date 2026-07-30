import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { UserRole } from './domain/user-role.enum';
import { UserSessionStatus } from './domain/user-session-status.enum';
import { UserStatus } from './domain/user-status.enum';
import { AuthService } from './auth.service';
import { UserEntity } from './infrastructure/user.entity';
import { UserSessionEntity } from './infrastructure/user-session.entity';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';

type MockRepository<T extends object = object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const userEntity = (overrides: Partial<UserEntity> = {}): UserEntity => ({
  id: '1075c8fa-f36e-4f40-a3ef-2e9dbb1f0670',
  propertyId: '2075c8fa-f36e-4f40-a3ef-2e9dbb1f0670',
  property: null,
  name: 'Front Desk',
  email: 'frontdesk@stayos.local',
  passwordHash: 'hash',
  role: UserRole.FRONT_DESK,
  status: UserStatus.ACTIVE,
  lastLoginAt: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

const sessionEntity = (overrides: Partial<UserSessionEntity> = {}): UserSessionEntity => ({
  id: '3075c8fa-f36e-4f40-a3ef-2e9dbb1f0670',
  userId: '1075c8fa-f36e-4f40-a3ef-2e9dbb1f0670',
  user: userEntity(),
  propertyId: '2075c8fa-f36e-4f40-a3ef-2e9dbb1f0670',
  property: null,
  refreshTokenHash: 'refresh-hash',
  status: UserSessionStatus.ACTIVE,
  ipAddress: null,
  userAgent: null,
  terminalName: null,
  lastActivityAt: new Date(),
  lockedAt: null,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: MockRepository<UserEntity>;
  let sessionsRepository: MockRepository<UserSessionEntity>;
  const passwordService = {
    verifyPassword: jest.fn(),
    hashPassword: jest.fn().mockResolvedValue('new-hash'),
  } as unknown as jest.Mocked<PasswordService>;
  const refreshTokenService = {
    generate: jest.fn(),
    hash: jest.fn((token: string) => `${token}-hash`),
  } as unknown as jest.Mocked<RefreshTokenService>;
  const jwtStrategy = {
    sign: jest.fn().mockReturnValue({ token: 'access-token', expiresIn: 1800 }),
    verify: jest.fn(),
  } as unknown as jest.Mocked<JwtStrategy>;
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'auth.sessionIdleLockMinutes') return 30;
      if (key === 'jwt.refreshExpiresInDays') return 14;
      return undefined;
    }),
  } as unknown as jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    usersRepository = {
      findOne: jest.fn().mockResolvedValue(userEntity()),
      save: jest.fn().mockImplementation(async (entity) => entity),
      create: jest.fn().mockImplementation((entity) => entity),
      find: jest.fn().mockResolvedValue([]),
    };
    sessionsRepository = {
      create: jest.fn().mockImplementation((entity) => ({ ...sessionEntity(), ...entity })),
      save: jest.fn().mockImplementation(async (entity) => entity),
      findOne: jest.fn().mockResolvedValue(sessionEntity()),
      find: jest.fn().mockResolvedValue([]),
    };
    passwordService.verifyPassword.mockResolvedValue(true);
    refreshTokenService.generate.mockReturnValue('refresh-token');

    service = new AuthService(
      usersRepository as unknown as Repository<UserEntity>,
      sessionsRepository as unknown as Repository<UserSessionEntity>,
      passwordService,
      refreshTokenService,
      jwtStrategy,
      configService,
    );
  });

  it('logs in active users and returns tokens without password hash', async () => {
    await expect(
      service.login({ email: 'frontdesk@stayos.local', password: 'Password123!' }),
    ).resolves.toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { email: 'frontdesk@stayos.local', role: UserRole.FRONT_DESK },
    });
  });

  it('rejects invalid credentials', async () => {
    passwordService.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'frontdesk@stayos.local', password: 'Password123!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive users on login', async () => {
    usersRepository.findOne?.mockResolvedValue(userEntity({ status: UserStatus.INACTIVE }));

    await expect(
      service.login({ email: 'frontdesk@stayos.local', password: 'Password123!' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refreshes and rotates refresh tokens', async () => {
    refreshTokenService.generate.mockReturnValue('new-refresh-token');
    sessionsRepository.findOne?.mockResolvedValue(sessionEntity({ refreshTokenHash: 'old-hash' }));

    await expect(service.refresh('old-refresh-token')).resolves.toMatchObject({
      refreshToken: 'new-refresh-token',
    });
    expect(sessionsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ refreshTokenHash: 'new-refresh-token-hash' }),
    );
  });

  it('returns session locked when refresh is idle locked', async () => {
    sessionsRepository.findOne?.mockResolvedValue(
      sessionEntity({ lastActivityAt: new Date(Date.now() - 31 * 60 * 1000) }),
    );

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unlocks a session and rotates refresh token', async () => {
    refreshTokenService.generate.mockReturnValue('unlocked-refresh-token');
    sessionsRepository.findOne?.mockResolvedValue(
      sessionEntity({ status: UserSessionStatus.LOCKED, lockedAt: new Date() }),
    );

    await expect(service.unlock('refresh-token', 'Password123!')).resolves.toMatchObject({
      refreshToken: 'unlocked-refresh-token',
    });
  });

  it('logout revokes session', async () => {
    await expect(service.logout('session-id')).resolves.toEqual({ loggedOut: true });
    expect(sessionsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: UserSessionStatus.REVOKED }),
    );
  });
});
