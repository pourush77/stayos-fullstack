import { API_BASE_URL } from './api-base';

export { API_BASE_URL };

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const payload = (await response.json().catch(() => undefined)) as
    ApiResponse<T> | { message?: unknown } | undefined;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `Reservation API request failed: ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return unwrapResponse<T>(payload as ApiResponse<T>);
}

function unwrapResponse<T>(response: ApiResponse<T>): T {
  if (response && typeof response === 'object') {
    if ('data' in response && response.data !== undefined) return response.data;
    if ('items' in response && response.items !== undefined) return response.items;
    if ('results' in response && response.results !== undefined) return response.results;
  }

  return response as T;
}

export type ReservationPropertyDto = Record<string, unknown>;
export type ReservationDto = Record<string, unknown>;

export function getProperties(signal?: AbortSignal) {
  return request<ReservationPropertyDto[]>('/properties', { signal });
}

export function getPropertyReservations(propertyId: string, signal?: AbortSignal) {
  return request<ReservationDto[]>(`/properties/${propertyId}/reservations`, { signal });
}

export function getPropertyReservation(
  propertyId: string,
  reservationId: string,
  signal?: AbortSignal,
) {
  return request<ReservationDto>(`/properties/${propertyId}/reservations/${reservationId}`, {
    signal,
  });
}

export function createPropertyReservation(
  propertyId: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return request<ReservationDto>(`/properties/${propertyId}/reservations`, {
    body: JSON.stringify(payload),
    method: 'POST',
    signal,
  });
}

export function updatePropertyReservation(
  propertyId: string,
  reservationId: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return request<ReservationDto>(`/properties/${propertyId}/reservations/${reservationId}`, {
    body: JSON.stringify(payload),
    method: 'PATCH',
    signal,
  });
}

export function cancelReservation(propertyId: string, reservationId: string, signal?: AbortSignal) {
  return request<ReservationDto>(`/properties/${propertyId}/reservations/${reservationId}/cancel`, {
    method: 'PATCH',
    signal,
  });
}

export type ReservationWorkflowResponseDto = {
  reservation: {
    id: string;
    reservationCode: string;
    status: string;
    roomId?: string | null;
  };
  room: {
    id: string;
    roomNumber: string;
    operationalStatus: string;
  };
};

export function assignRoomToReservation(
  propertyId: string,
  reservationId: string,
  roomId: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/assign-room`,
    {
      body: JSON.stringify({ roomId }),
      method: 'PATCH',
      signal,
    },
  );
}

export function unassignRoomFromReservation(
  propertyId: string,
  reservationId?: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/unassign-room`,
    {
      method: 'PATCH',
      signal,
    },
  );
}

export function checkInReservation(propertyId: string, reservationId: string, signal?: AbortSignal) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in`,
    {
      method: 'PATCH',
      signal,
    },
  );
}

export function checkOutReservation(
  propertyId: string,
  reservationId: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-out`,
    {
      method: 'PATCH',
      signal,
    },
  );
}

export function extendReservationStay(
  propertyId: string,
  reservationId: string,
  departureDate: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/extend`,
    {
      body: JSON.stringify({ departureDate }),
      method: 'PATCH',
      signal,
    },
  );
}

export function moveReservationRoom(
  propertyId: string,
  reservationId: string,
  roomId: string,
  reason?: string,
  signal?: AbortSignal,
) {
  return request<ReservationWorkflowResponseDto>(
    `/properties/${propertyId}/reservations/${reservationId}/move-room`,
    {
      body: JSON.stringify({ roomId, reason }),
      method: 'PATCH',
      signal,
    },
  );
}

export type CheckInWorkspaceDto = {
  booking: {
    reservationId: string;
    reservationCode: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    adults: number;
    children: number;
    source: string;
    specialRequests: string | null;
  };
  guest: {
    guestId: string;
    fullName: string;
    mobile: string | null;
    email: string | null;
    nationality: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
    purposeOfVisit: string | null;
    arrivalFrom: string | null;
    nextDestination: string | null;
  };
  identity: {
    idType: string | null;
    idNumberMasked: string | null;
    documentFrontUploaded: boolean;
    documentBackUploaded: boolean;
    verified: boolean;
    verifiedBy: string | null;
    verifiedAt: string | null;
  };
  documents: Array<{
    id: string;
    side: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  foreignGuest: {
    isForeignNational: boolean;
    passportNumberMasked: string | null;
    passportIssuePlace: string | null;
    passportIssueDate: string | null;
    passportExpiryDate: string | null;
    visaNumberMasked: string | null;
    visaType: string | null;
    visaIssueDate: string | null;
    visaExpiryDate: string | null;
    cFormRequired: boolean;
    cFormStatus: string;
  };
  payment: {
    paymentStatus: string;
    outstandingAmount: number;
    paymentMethod: string | null;
  };
  room: {
    roomId: string | null;
    roomNumber: string | null;
    roomType: string | null;
    floor: string | null;
    operationalStatus: string | null;
    readyForCheckIn: boolean;
    warnings: string[];
  };
  finalChecklist: {
    bookingReviewed: boolean;
    guestRegistrationComplete: boolean;
    identityVerified: boolean;
    paymentReviewed: boolean;
    roomReady: boolean;
    canCheckIn: boolean;
    blockers: string[];
    missingRegistrationFields?: string[];
  };
};

export function getCheckInWorkspace(propertyId: string, reservationId: string, signal?: AbortSignal) {
  return request<CheckInWorkspaceDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in-workspace`,
    { signal },
  );
}

export function updateGuestRegistration(
  propertyId: string,
  reservationId: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return request<CheckInWorkspaceDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/guest-registration`,
    { body: JSON.stringify(payload), method: 'PATCH', signal },
  );
}

export function updateIdentityVerification(
  propertyId: string,
  reservationId: string,
  payload: { idType: string; idNumber: string; verified: boolean; documentFrontUrl?: string; documentBackUrl?: string },
  signal?: AbortSignal,
) {
  return request<CheckInWorkspaceDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/identity`,
    { body: JSON.stringify(payload), method: 'PATCH', signal },
  );
}

export function reviewCheckInPayment(
  propertyId: string,
  reservationId: string,
  payload: { paymentReviewed: boolean; paymentMethod?: string; notes?: string },
  signal?: AbortSignal,
) {
  return request<CheckInWorkspaceDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/payment-review`,
    { body: JSON.stringify(payload), method: 'PATCH', signal },
  );
}

export async function uploadCheckInDocument(
  propertyId: string,
  reservationId: string,
  side: 'front' | 'back' | 'guest_face',
  file: File,
): Promise<unknown> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', side);
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/reservations/${reservationId}/check-in/documents`,
    { method: 'POST', body: form },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error((body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') ? body.message : 'Upload failed');
  }
  return response.json();
}

export async function deleteCheckInDocument(
  propertyId: string,
  reservationId: string,
  documentId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/reservations/${reservationId}/check-in/documents/${documentId}`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw new Error('Delete failed');
}

export function getCheckInDocumentPreviewUrl(propertyId: string, reservationId: string, documentId: string) {
  return `${API_BASE_URL}/properties/${propertyId}/reservations/${reservationId}/check-in/documents/${documentId}/preview`;
}

// ---- Mobile capture (Send to phone) ----------------------------------------

export interface MobileCaptureSessionDto {
  sessionId: string;
  token: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  expiresAt: string;
  completedAt: string | null;
  frontUploaded: boolean;
  backUploaded: boolean;
  guestDisplayName: string;
  reservationReference: string;
}

export function createMobileCaptureSession(propertyId: string, reservationId: string) {
  return request<MobileCaptureSessionDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/mobile-capture`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function getMobileCaptureSessionStatus(propertyId: string, reservationId: string, signal?: AbortSignal) {
  return request<MobileCaptureSessionDto>(
    `/properties/${propertyId}/reservations/${reservationId}/check-in/mobile-capture/status`,
    { method: 'GET', signal },
  );
}

// Public (no-auth) helpers used by the phone capture page ------------------

export async function getPublicCaptureSession(token: string, signal?: AbortSignal): Promise<MobileCaptureSessionDto> {
  const response = await fetch(`${API_BASE_URL}/check-in-capture/${token}`, {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error('Capture session not found or expired.');
  const body = await response.json();
  return (body?.data ?? body) as MobileCaptureSessionDto;
}

export async function uploadPublicCaptureDocument(
  token: string,
  side: 'ID_FRONT' | 'ID_BACK',
  file: File,
): Promise<MobileCaptureSessionDto> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', side);
  const response = await fetch(`${API_BASE_URL}/check-in-capture/${token}/documents`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const msg = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : 'Upload failed';
    throw new Error(msg);
  }
  const body = await response.json();
  return (body?.data ?? body) as MobileCaptureSessionDto;
}
