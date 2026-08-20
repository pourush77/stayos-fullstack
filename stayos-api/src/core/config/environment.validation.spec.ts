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

  it('allows DATABASE_URL instead of split database fields', () => {
    const config = {
      ...validDevelopmentConfig,
      DATABASE_URL: 'postgresql://stayos_user:secret@localhost:5432/stayos',
      DATABASE_HOST: undefined,
      DATABASE_PORT: undefined,
      DATABASE_NAME: undefined,
      DATABASE_USERNAME: undefined,
      DATABASE_PASSWORD: undefined,
    };

    expect(validateEnvironment(config)).toEqual(config);
  });

  it('fails when DATABASE_URL is invalid', () => {
    const config = {
      ...validDevelopmentConfig,
      DATABASE_URL: 'mysql://stayos_user:secret@localhost:3306/stayos',
      DATABASE_HOST: undefined,
      DATABASE_PORT: undefined,
      DATABASE_NAME: undefined,
      DATABASE_USERNAME: undefined,
      DATABASE_PASSWORD: undefined,
    };

    expect(() => validateEnvironment(config)).toThrow(/DATABASE_URL must use postgres/);
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
  it('allows email to stay disabled without provider credentials', () => {
    const config = {
      ...validDevelopmentConfig,
      EMAIL_ENABLED: 'false',
    };

    expect(validateEnvironment(config)).toEqual(config);
  });

  it('requires provider credentials only when email is enabled', () => {
    const config = {
      ...validDevelopmentConfig,
      EMAIL_ENABLED: 'true',
      EMAIL_PROVIDER: 'resend',
      EMAIL_API_KEY: undefined,
      EMAIL_FROM_ADDRESS: 'frontdesk@example.com',
    };

    expect(() => validateEnvironment(config)).toThrow(
      /EMAIL_API_KEY is required when EMAIL_ENABLED=true/,
    );
  });

  it('accepts a complete enabled email configuration', () => {
    const config = {
      ...validDevelopmentConfig,
      EMAIL_ENABLED: 'true',
      EMAIL_PROVIDER: 'resend',
      EMAIL_API_KEY: 'test-api-key',
      EMAIL_FROM_ADDRESS: 'frontdesk@example.com',
      EMAIL_FROM_NAME: 'StayOS Hotel',
      EMAIL_REPLY_TO: 'reception@example.com',
    };

    expect(validateEnvironment(config)).toEqual(config);
  });
});
