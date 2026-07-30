import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const requestIdHeader = 'x-request-id';

export interface RequestWithId extends Request {
  requestId?: string;
}

export const requestIdMiddleware = (
  request: RequestWithId,
  response: Response,
  next: NextFunction,
): void => {
  const incomingRequestId = request.header(requestIdHeader);
  const requestId = incomingRequestId?.trim() || randomUUID();

  request.requestId = requestId;
  response.setHeader(requestIdHeader, requestId);
  next();
};
