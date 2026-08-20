const supportedNodeEnvironments = ['development', 'test', 'staging', 'production'] as const;

type NodeEnvironment = (typeof supportedNodeEnvironments)[number];

type Environment = Record<string, string | undefined>;

const requiredDatabaseKeys = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_NAME',
  'DATABASE_USERNAME',
  'DATABASE_PASSWORD',
] as const;

const weakProductionSecrets = new Set([
  'secret',
  'supersecret',
  'superrefreshsecret',
  'not-set',
  'change-me',
  'changeme',
  'password',
]);

export const validateEnvironment = (config: Record<string, unknown>): Record<string, unknown> => {
  const env = config as Environment;
  const errors: string[] = [];
  const nodeEnv = validateNodeEnvironment(env.NODE_ENV, errors);

  validatePort('PORT', env.PORT, errors);
  validateRequiredDatabaseConfig(env, errors);
  if (env.DATABASE_URL?.trim()) {
    validateDatabaseUrl(env.DATABASE_URL, errors);
  } else {
    validatePort('DATABASE_PORT', env.DATABASE_PORT, errors);
  }
  validateJwtSecret('JWT_SECRET', env.JWT_SECRET, nodeEnv, errors);
  validateJwtSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET, nodeEnv, errors);
  validateOptionalPositiveInteger(
    'JWT_REFRESH_EXPIRES_IN_DAYS',
    env.JWT_REFRESH_EXPIRES_IN_DAYS,
    errors,
  );
  validateOptionalPositiveInteger(
    'SESSION_IDLE_LOCK_MINUTES',
    env.SESSION_IDLE_LOCK_MINUTES,
    errors,
  );
  validateOptionalPort('REDIS_PORT', env.REDIS_PORT, errors);
  validateOptionalEmailConfiguration(env, errors);

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return config;
};

const validateNodeEnvironment = (value: string | undefined, errors: string[]): NodeEnvironment => {
  if (!value) {
    errors.push('NODE_ENV is required');

    return 'development';
  }

  if (!supportedNodeEnvironments.includes(value as NodeEnvironment)) {
    errors.push(`NODE_ENV must be one of: ${supportedNodeEnvironments.join(', ')}`);

    return 'development';
  }

  return value as NodeEnvironment;
};

const validateRequiredDatabaseConfig = (env: Environment, errors: string[]): void => {
  if (env.DATABASE_URL?.trim()) {
    return;
  }

  requiredDatabaseKeys.forEach((key) => {
    if (!env[key]?.trim()) {
      errors.push(`${key} is required`);
    }
  });
};

const validateDatabaseUrl = (value: string | undefined, errors: string[]): void => {
  if (!value?.trim()) {
    errors.push('DATABASE_URL is required');

    return;
  }

  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      errors.push('DATABASE_URL must use postgres or postgresql protocol');
    }
    if (!url.hostname || !url.pathname.replace(/^\//, '')) {
      errors.push('DATABASE_URL must include host and database name');
    }
  } catch {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }
};

const validatePort = (key: string, value: string | undefined, errors: string[]): void => {
  if (!value?.trim()) {
    errors.push(`${key} is required`);

    return;
  }

  if (!isValidPort(value)) {
    errors.push(`${key} must be a valid TCP port between 1 and 65535`);
  }
};

const validateOptionalPort = (key: string, value: string | undefined, errors: string[]): void => {
  if (!value?.trim()) {
    return;
  }

  if (!isValidPort(value)) {
    errors.push(`${key} must be a valid TCP port between 1 and 65535`);
  }
};

const validateOptionalPositiveInteger = (
  key: string,
  value: string | undefined,
  errors: string[],
): void => {
  if (!value?.trim()) {
    return;
  }

  if (!/^\d+$/.test(value) || Number(value) <= 0) {
    errors.push(`${key} must be a positive integer`);
  }
};

const validateOptionalEmailConfiguration = (env: Environment, errors: string[]): void => {
  if (
    env.EMAIL_ENABLED !== undefined &&
    !['true', 'false'].includes(env.EMAIL_ENABLED.trim().toLowerCase())
  ) {
    errors.push('EMAIL_ENABLED must be true or false');
  }

  const enabled = env.EMAIL_ENABLED?.trim().toLowerCase() === 'true';
  if (!enabled) {
    return;
  }

  if (!env.EMAIL_PROVIDER?.trim()) {
    errors.push('EMAIL_PROVIDER is required when EMAIL_ENABLED=true');
  }
  if (!env.EMAIL_API_KEY?.trim()) {
    errors.push('EMAIL_API_KEY is required when EMAIL_ENABLED=true');
  }
  if (!env.EMAIL_FROM_ADDRESS?.trim()) {
    errors.push('EMAIL_FROM_ADDRESS is required when EMAIL_ENABLED=true');
  } else if (!isEmailLike(env.EMAIL_FROM_ADDRESS)) {
    errors.push('EMAIL_FROM_ADDRESS must be a valid email address');
  }

  if (env.EMAIL_REPLY_TO?.trim() && !isEmailLike(env.EMAIL_REPLY_TO)) {
    errors.push('EMAIL_REPLY_TO must be a valid email address');
  }
};

const isEmailLike = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isValidPort = (value: string): boolean => {
  if (!/^\d+$/.test(value)) {
    return false;
  }

  const port = Number(value);

  return Number.isInteger(port) && port >= 1 && port <= 65535;
};

const validateJwtSecret = (
  key: string,
  value: string | undefined,
  nodeEnv: NodeEnvironment,
  errors: string[],
): void => {
  if (!value?.trim()) {
    errors.push(`${key} is required`);

    return;
  }

  if (nodeEnv !== 'production') {
    return;
  }

  if (value.length < 32 || weakProductionSecrets.has(value.toLowerCase())) {
    errors.push(`${key} must be at least 32 characters and non-placeholder in production`);
  }
};
