import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiErrorCode } from '../errors/api-error-code.enum';
import { ApiErrorDetail, ApiErrorResponse } from '../errors/api-error.interface';
import { RequestWithId } from '../middleware/request-id.middleware';

interface HttpErrorBody {
  code?: ApiErrorCode;
  error?: string;
  message?: string | string[];
  details?: ApiErrorDetail[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly isProduction = false) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const status = this.getStatus(exception);
    const errorBody = this.getErrorBody(exception, status);
    const requestId = request.requestId ?? 'unknown';

    this.logError(exception, request, requestId, status, errorBody.code);

    response.status(status).json({
      success: false,
      error: {
        code: errorBody.code,
        message: errorBody.message,
        details: errorBody.details,
        path: request.originalUrl ?? request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
        requestId,
      },
    } satisfies ApiErrorResponse);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorBody(
    exception: unknown,
    status: number,
  ): {
    code: ApiErrorCode;
    message: string;
    details: ApiErrorDetail[];
  } {
    if (exception instanceof QueryFailedError) {
      return {
        code: ApiErrorCode.DATABASE_ERROR,
        message: 'Database error',
        details: [],
      };
    }

    if (exception instanceof HttpException) {
      return this.getHttpErrorBody(exception, status);
    }

    return {
      code: ApiErrorCode.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      details: [],
    };
  }

  private getHttpErrorBody(
    exception: HttpException,
    status: number,
  ): {
    code: ApiErrorCode;
    message: string;
    details: ApiErrorDetail[];
  } {
    const response = exception.getResponse();
    const body: HttpErrorBody =
      typeof response === 'object' && response !== null
        ? (response as HttpErrorBody)
        : { message: String(response) };

    return {
      code: body.code ?? this.mapStatusToErrorCode(status),
      message: this.resolveMessage(body, status),
      details: body.details ?? this.resolveDetails(body),
    };
  }

  private resolveMessage(body: HttpErrorBody, status: number): string {
    if (typeof body.message === 'string') {
      return body.message;
    }

    if (Array.isArray(body.message) && body.message.length > 0) {
      return status === HttpStatus.BAD_REQUEST ? 'Validation failed' : body.message.join(', ');
    }

    return body.error ?? 'Request failed';
  }

  private resolveDetails(body: HttpErrorBody): ApiErrorDetail[] {
    if (!Array.isArray(body.message)) {
      return [];
    }

    return body.message.map((message) => ({ message }));
  }

  private mapStatusToErrorCode(status: number): ApiErrorCode {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ApiErrorCode.VALIDATION_ERROR;
      case HttpStatus.NOT_FOUND:
        return ApiErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ApiErrorCode.CONFLICT;
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ApiErrorCode.FORBIDDEN;
      default:
        return ApiErrorCode.INTERNAL_SERVER_ERROR;
    }
  }

  private logError(
    exception: unknown,
    request: Request,
    requestId: string,
    status: number,
    code: ApiErrorCode,
  ): void {
    const context = {
      requestId,
      method: request.method,
      path: request.originalUrl ?? request.url,
      status,
      code,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error && !this.isProduction ? exception.stack : undefined;

      this.logger.error(context, stack);
      return;
    }

    this.logger.warn(context);
  }
}
