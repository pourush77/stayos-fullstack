import { ApiErrorCode } from './api-error-code.enum';

export interface ApiErrorDetail {
  field?: string;
  message: string;
  rejectedValue?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details: ApiErrorDetail[];
    path: string;
    method: string;
    timestamp: string;
    requestId: string;
  };
}
