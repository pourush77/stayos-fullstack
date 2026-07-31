import { API_BASE_URL } from '../../lib/inventory-api';

type ApiResponse<T> =
  | T
  | { success?: boolean; data?: T; meta?: unknown }
  | { item?: T }
  | { result?: T }
  | { results?: T };

type ErrorPayload = {
  message?: unknown;
  code?: unknown;
  error?: { message?: unknown; code?: unknown } | unknown;
};

export type LooseRecord = Record<string, unknown>;

export type CheckInWorkspaceDto = LooseRecord & {
  canCheckIn?: boolean;
  blockers?: string[];
  reservation?: LooseRecord;
  guest?: LooseRecord;
  identity?: LooseRecord;
  payment?: LooseRecord;
  readiness?: LooseRecord;
  registrationCard?: LooseRecord;
};

export type MobileCaptureDto = LooseRecord & {
  allowedDocumentTypes?: string[];
  expiresAt?: string;
  guestDisplayName?: string;
  reservationReference?: string;
  status?: string;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init.body instanceof FormData ? {} : init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (process.env.NODE_ENV === 'development' && path.startsWith('/check-in-capture/')) {
    console.info('Capture lookup status:', response.status);
  }
  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | ErrorPayload | undefined;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof payload.error === 'object' &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Check-in request failed: ${response.status}`;
    const code =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof payload.error === 'object' &&
      'code' in payload.error &&
      typeof payload.error.code === 'string'
        ? payload.error.code
        : payload && typeof payload === 'object' && 'code' in payload && typeof payload.code === 'string'
        ? payload.code
        : undefined;
    throw new ApiRequestError(message, response.status, code);
  }

  return unwrap(payload as ApiResponse<T>);
}

async function requestBlob(path: string, init: RequestInit = {}): Promise<{ blob: Blob; contentType: string }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'image/*,application/pdf',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(`Check-in document request failed: ${response.status}`, response.status);
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get('Content-Type') ?? '',
  };
}

function unwrap<T>(payload: ApiResponse<T> | undefined): T {
  if (payload && typeof payload === 'object') {
    if ('data' in payload && payload.data !== undefined) return payload.data;
    if ('item' in payload && payload.item !== undefined) return payload.item;
    if ('result' in payload && payload.result !== undefined) return payload.result;
    if ('results' in payload && payload.results !== undefined) return payload.results;
  }
  return payload as T;
}

export function getString(record: LooseRecord | undefined, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

export function getNumber(record: LooseRecord | undefined, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
}

export function getBoolean(record: LooseRecord | undefined, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'boolean') return value;
  }
  return fallback;
}

export function getArray(record: LooseRecord | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function getRecord(record: LooseRecord | undefined, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as LooseRecord;
  }
  return undefined;
}

export function getCheckInWorkspace(propertyId: string, reservationId: string, signal?: AbortSignal) {
  return request<CheckInWorkspaceDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in-workspace`,
    { signal },
  );
}

export function createMobileCapture(propertyId: string, reservationId: string) {
  return request<MobileCaptureDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/mobile-capture`,
    {
      method: 'POST',
    },
  );
}

export function getMobileCaptureStatus(
  propertyId: string,
  reservationId: string,
  signal?: AbortSignal,
) {
  return request<MobileCaptureDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/mobile-capture/status`,
    { signal },
  );
}

export function getIdentityDocument(
  propertyId: string,
  reservationId: string,
  documentId: string,
  signal?: AbortSignal,
) {
  return requestBlob(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/documents/${documentId}`,
    { signal },
  );
}

export function deleteIdentityDocument(
  propertyId: string,
  reservationId: string,
  documentId: string,
) {
  return request<LooseRecord>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/documents/${documentId}`,
    {
      method: 'DELETE',
    },
  );
}

export function getRegistrationCard(propertyId: string, reservationId: string, signal?: AbortSignal) {
  return request<LooseRecord>(
    `/properties/${propertyId}/reservations/${reservationId}/registration-card`,
    { signal },
  );
}

export function uploadIdentityDocument(
  propertyId: string,
  reservationId: string,
  type: 'front' | 'back',
  file: File,
) {
  const body = new FormData();
  body.append('type', type);
  body.append('file', file);
  return request<LooseRecord>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/documents`,
    {
      body,
      method: 'POST',
    },
  );
}

export function saveGuestRegistration(
  propertyId: string,
  reservationId: string,
  payload: LooseRecord,
) {
  return request<LooseRecord>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/guest-registration`,
    {
      body: JSON.stringify(payload),
      method: 'PATCH',
    },
  );
}

export function saveIdentity(
  propertyId: string,
  reservationId: string,
  payload: { idType: string; idNumber: string; verified: boolean },
) {
  return request<LooseRecord>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/identity`,
    {
      body: JSON.stringify(payload),
      method: 'PATCH',
    },
  );
}

export function markPaymentReviewed(propertyId: string, reservationId: string) {
  return request<LooseRecord>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/payment-review`,
    {
      body: JSON.stringify({ paymentReviewed: true }),
      method: 'PATCH',
    },
  );
}

export function completeCheckIn(propertyId: string, reservationId: string) {
  return request<LooseRecord>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in`,
    {
      method: 'PATCH',
    },
  );
}

export function getCaptureSession(token: string, signal?: AbortSignal) {
  return request<MobileCaptureDto>(`/check-in-capture/${encodeURIComponent(token)}`, { signal });
}

export function submitCaptureSide(token: string, type: 'ID_FRONT' | 'ID_BACK', file: File) {
  const body = new FormData();
  body.append('type', type);
  body.append('file', file);
  return request<MobileCaptureDto>(`/check-in-capture/${encodeURIComponent(token)}/documents`, {
    body,
    method: 'POST',
  });
}

export function submitCapture(token: string) {
  return request<MobileCaptureDto>(`/check-in-capture/${encodeURIComponent(token)}/complete`, {
    method: 'POST',
  });
}
