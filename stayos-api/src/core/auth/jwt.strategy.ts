import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { ApiErrorCode } from '../../common/errors/api-error-code.enum';
import { UserRole } from './domain/user-role.enum';

export interface JwtPayload {
  sub: string;
  sessionId: string;
  propertyId: string | null;
  role: UserRole;
  exp: number;
  iat: number;
}

@Injectable()
export class JwtStrategy {
  constructor(private readonly configService: ConfigService) {}

  sign(payload: Omit<JwtPayload, 'exp' | 'iat'>): { token: string; expiresIn: number } {
    const expiresIn = this.getAccessTokenSeconds();
    const now = Math.floor(Date.now() / 1000);
    const body: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn,
    };
    const header = { alg: 'HS256', typ: 'JWT' };
    const unsigned = `${this.base64UrlJson(header)}.${this.base64UrlJson(body)}`;
    const signature = this.signSegment(unsigned);

    return { token: `${unsigned}.${signature}`, expiresIn };
  }

  verify(token: string): JwtPayload {
    const [header, payload, signature] = token.split('.');

    if (!header || !payload || !signature) {
      throw this.unauthorized('Invalid access token');
    }

    const expected = this.signSegment(`${header}.${payload}`);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw this.unauthorized('Invalid access token');
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtPayload;

    if (decoded.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException({
        code: ApiErrorCode.TOKEN_EXPIRED,
        message: 'Access token expired',
      });
    }

    return decoded;
  }

  getAccessTokenSeconds(): number {
    const value = this.configService.get<string>('jwt.accessExpiresIn') ?? '30m';
    const match = value.match(/^(\d+)([smhd])$/);

    if (!match) {
      return 1800;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

    return amount * multipliers[unit];
  }

  private base64UrlJson(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private signSegment(value: string): string {
    return createHmac('sha256', this.configService.get<string>('jwt.secret') ?? 'not-set')
      .update(value)
      .digest('base64url');
  }

  private unauthorized(message: string): UnauthorizedException {
    return new UnauthorizedException({ code: ApiErrorCode.UNAUTHORIZED, message });
  }
}
