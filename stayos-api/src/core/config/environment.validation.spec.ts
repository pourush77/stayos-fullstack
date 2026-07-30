import { validateEnvironment } from './environment.validation';

const validDevelopmentConfig = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'stayos',
  DATABASE_USERNAME: 'stayos_user',
  DATABASE_PASSWORD: 'secret',
  JWT_SECRET: 'supersecret',
  JWT_REFRESH_SECRET: 'superrefreshsecret',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
};

describe('validateEnvironment', () => {
  it('allows a valid development configuration', () => {
    expect(validateEnvironment(validDevelopmentConfig)).toEqual(validDevelopmentConfig);
  });

  it('fails when database configuration is missing', () => {
    const config = {
      ...validDevelopmentConfig,
      DATABASE_HOST: undefined,
    };

    expect(() => validateEnvironment(config)).toThrow(/DATABASE_HOST is required/);
  });

  it('fails when a port is invalid', () => {
    const config = {
      ...validDevelopmentConfig,
      PORT: '70000',
    };

    expect(() => validateEnvironment(config)).toThrow(/PORT must be a valid/);
  });

  it('fails when production JWT secrets are weak', () => {
    const config = {
      ...validDevelopmentConfig,
      NODE_ENV: 'production',
      JWT_SECRET: 'supersecret',
      JWT_REFRESH_SECRET: 'superrefreshsecret',
    };

    expect(() => validateEnvironment(config)).toThrow(/JWT_SECRET must be at least 32 characters/);
  });
});
