export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    env: process.env.NODE_ENV ?? 'development',
    name: 'StayOS Platform API',
    version: process.env.API_VERSION ?? '1.0.0',
  },
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    name: process.env.DATABASE_NAME ?? 'stayos',
    username: process.env.DATABASE_USERNAME ?? 'stayos_user',
    password: process.env.DATABASE_PASSWORD ?? 'secret',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'not-set',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'not-set',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '30m',
    refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '14', 10),
  },
  auth: {
    enabled: process.env.AUTH_ENABLED !== 'false',
    sessionIdleLockMinutes: parseInt(process.env.SESSION_IDLE_LOCK_MINUTES ?? '30', 10),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
});
