import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { RAW_RESPONSE_METADATA_KEY } from '../decorators/raw-response.decorator';
import {
  ApiListSuccessResponse,
  ApiResponseMeta,
  ApiSuccessResponse,
  PreWrappedSuccessResponse,
} from '../dto/api-success-response.dto';
import { createPaginationMeta, PaginationMeta } from '../dto/pagination.dto';
import { RequestWithId } from '../middleware/request-id.middleware';

const apiVersion = 'v1';
const defaultSuccessMessage = 'Operation completed successfully.';
const defaultListMessage = 'Records fetched successfully.';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((data: unknown) =>
        this.shouldReturnRawResponse(context)
          ? data
          : this.wrapResponse(data, {
              requestId: request.requestId ?? 'unknown',
              timestamp: new Date().toISOString(),
              version: apiVersion,
            }),
      ),
    );
  }

  private shouldReturnRawResponse(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_METADATA_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private wrapResponse(
    data: unknown,
    meta: ApiResponseMeta,
  ): ApiSuccessResponse | ApiListSuccessResponse {
    if (this.isWrappedResponse(data)) {
      return {
        ...data,
        meta: {
          ...meta,
          ...data.meta,
        },
      } as ApiSuccessResponse;
    }

    if (Array.isArray(data)) {
      return {
        success: true,
        message: defaultListMessage,
        data,
        pagination: createPaginationMeta(1, data.length || 20, data.length),
        meta,
      };
    }

    return {
      success: true,
      message: defaultSuccessMessage,
      data,
      meta,
    };
  }

  private isWrappedResponse(
    data: unknown,
  ): data is PreWrappedSuccessResponse & { pagination?: PaginationMeta } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'success' in data &&
      (data as { success?: unknown }).success === true &&
      'data' in data
    );
  }
}
