import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

const createContext = (requestId = 'request-123') =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ requestId }),
    }),
  }) as unknown as ExecutionContext;

const createNext = (data: unknown) =>
  ({
    handle: jest.fn().mockReturnValue(of(data)),
  }) as unknown as CallHandler;

describe('ApiResponseInterceptor', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const interceptor = new ApiResponseInterceptor(reflector);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
  });

  it('wraps a single object response', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(createContext(), createNext({ id: 'property-1' })),
    );

    expect(result).toMatchObject({
      success: true,
      message: 'Operation completed successfully.',
      data: { id: 'property-1' },
      meta: {
        requestId: 'request-123',
        version: 'v1',
      },
    });
    expect(result).toHaveProperty('meta.timestamp');
  });

  it('wraps an array response as a list response', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(
        createContext(),
        createNext([{ id: 'property-1' }, { id: 'property-2' }]),
      ),
    );

    expect(result).toMatchObject({
      success: true,
      message: 'Records fetched successfully.',
      data: [{ id: 'property-1' }, { id: 'property-2' }],
      pagination: {
        page: 1,
        limit: 2,
        total: 2,
        totalPages: 1,
      },
      meta: {
        requestId: 'request-123',
        version: 'v1',
      },
    });
  });

  it('preserves an already wrapped paginated response', async () => {
    const wrappedResponse = {
      success: true,
      message: 'Records fetched successfully.',
      data: [{ id: 'property-1' }],
      pagination: {
        page: 2,
        limit: 20,
        total: 100,
        totalPages: 5,
      },
    };

    const result = await lastValueFrom(
      interceptor.intercept(createContext(), createNext(wrappedResponse)),
    );

    expect(result).toMatchObject({
      ...wrappedResponse,
      meta: {
        requestId: 'request-123',
        version: 'v1',
      },
    });
  });

  it('includes requestId from the request', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(createContext('incoming-id'), createNext({ ok: true })),
    );

    expect(result).toMatchObject({
      meta: {
        requestId: 'incoming-id',
      },
    });
  });

  it('returns raw data for handlers marked as raw responses', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const health = {
      status: 'ok',
      service: 'StayOS Platform API',
    };
    const result = await lastValueFrom(interceptor.intercept(createContext(), createNext(health)));

    expect(result).toEqual(health);
  });
});
