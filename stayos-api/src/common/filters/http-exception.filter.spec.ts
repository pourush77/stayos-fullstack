import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { ApiErrorCode } from '../errors/api-error-code.enum';
import { RequestWithId } from '../middleware/request-id.middleware';
import { HttpExceptionFilter } from './http-exception.filter';

const createHost = () => {
  const request = {
    method: 'POST',
    originalUrl: '/api/v1/properties',
    requestId: 'request-123',
  } as RequestWithId;
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
      getResponse: jest.fn().mockReturnValue(response),
    }),
  } as unknown as ArgumentsHost;

  return { host, response };
};

describe('HttpExceptionFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  it('formats validation errors with the standard error shape', () => {
    const { host, response } = createHost();
    const filter = new HttpExceptionFilter(true);

    filter.catch(
      new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: [
          {
            field: 'email',
            message: 'email must be an email',
            rejectedValue: 'bad-email',
          },
        ],
      }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: [
            {
              field: 'email',
              message: 'email must be an email',
              rejectedValue: 'bad-email',
            },
          ],
          path: '/api/v1/properties',
          method: 'POST',
          requestId: 'request-123',
        }),
      }),
    );
  });

  it('formats unknown errors safely', () => {
    const { host, response } = createHost();
    const filter = new HttpExceptionFilter(true);

    filter.catch(new Error('sensitive failure'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: ApiErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          details: [],
          requestId: 'request-123',
        }),
      }),
    );
  });
});
