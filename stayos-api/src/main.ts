import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { ApiErrorCode } from './common/errors/api-error-code.enum';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { formatValidationErrors } from './common/validation/validation-error.formatter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const bootstrapLogger = new NestLogger('Bootstrap');

  app.useLogger(app.get(Logger));
  bootstrapLogger.log('Starting StayOS Platform API bootstrap');
  app.use(requestIdMiddleware);
  app.use(helmet());
  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    'http://localhost:3000,http://127.0.0.1:3000'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(
    new HttpExceptionFilter(configService.get<string>('app.env') === 'production'),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: formatValidationErrors(errors),
        }),
    }),
  );

  const swaggerOptions = new DocumentBuilder()
    .setTitle('StayOS Platform API')
    .setDescription('StayOS hospitality platform API documentation')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerOptions);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);
  bootstrapLogger.log(`StayOS Platform API running on http://localhost:${port}/api/v1`);
}

bootstrap();
