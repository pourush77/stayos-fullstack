import { Injectable } from '@nestjs/common';
import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);
const iterations = 210_000;
const keyLength = 32;
const digest = 'sha256';

@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('base64url');
    const key = await pbkdf2Async(password, salt, iterations, keyLength, digest);

    return `pbkdf2$${iterations}$${digest}$${salt}$${key.toString('base64url')}`;
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    const [scheme, iterationValue, hashDigest, salt, encodedKey] = passwordHash.split('$');

    if (scheme !== 'pbkdf2' || !iterationValue || !hashDigest || !salt || !encodedKey) {
      return false;
    }

    const expected = Buffer.from(encodedKey, 'base64url');
    const actual = await pbkdf2Async(
      password,
      salt,
      Number(iterationValue),
      expected.length,
      hashDigest,
    );

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
