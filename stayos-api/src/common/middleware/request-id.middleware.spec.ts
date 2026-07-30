import { NextFunction, Response } from 'express';
import { requestIdHeader, requestIdMiddleware, RequestWithId } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  const response = {
    setHeader: jest.fn(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a request id when the incoming header is missing', () => {
    const request = {
      header: jest.fn().mockReturnValue(undefined),
    } as unknown as RequestWithId;

    requestIdMiddleware(request, response, next);

    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.setHeader).toHaveBeenCalledWith(requestIdHeader, request.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('respects an incoming request id', () => {
    const request = {
      header: jest.fn().mockReturnValue('incoming-request-id'),
    } as unknown as RequestWithId;

    requestIdMiddleware(request, response, next);

    expect(request.requestId).toBe('incoming-request-id');
    expect(response.setHeader).toHaveBeenCalledWith(requestIdHeader, 'incoming-request-id');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
