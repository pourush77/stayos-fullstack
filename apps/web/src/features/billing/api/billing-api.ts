import { API_BASE_URL } from '../../../lib/api-base';
import type {
  BillingOverview,
  CreateChargePayload,
  CreatePaymentPayload,
  Folio,
  FolioStatus,
} from '../types/billing.types';

type ApiResponse<T> = { data?: T; message?: string; success?: boolean };

export class BillingApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'BillingApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

  if (!response.ok) {
    const message =
      body?.message ??
      (body && (body as { error?: { message?: string } }).error?.message) ??
      `Billing request failed: ${response.status}`;
    const code =
      body && (body as { code?: string; error?: { code?: string } }).code
        ? (body as { code?: string }).code
        : (body as { error?: { code?: string } })?.error?.code;
    throw new BillingApiError(String(message), response.status, code);
  }

  return (body?.data ?? (body as unknown as T)) as T;
}

function cleanPayload<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''),
  );
}

export function listFolios(
  propertyId: string,
  filters?: { status?: FolioStatus },
  signal?: AbortSignal,
): Promise<Folio[]> {
  const query = filters?.status ? `?status=${encodeURIComponent(filters.status)}` : '';
  return request<Folio[]>(`/properties/${propertyId}/folios${query}`, { signal });
}

export function getFolio(
  propertyId: string,
  folioId: string,
  signal?: AbortSignal,
): Promise<Folio> {
  return request<Folio>(`/properties/${propertyId}/folios/${folioId}`, { signal });
}

export function getFolioForReservation(
  propertyId: string,
  reservationId: string,
  signal?: AbortSignal,
): Promise<Folio> {
  return request<Folio>(`/properties/${propertyId}/reservations/${reservationId}/folio`, {
    signal,
  });
}

export function addCharge(
  propertyId: string,
  folioId: string,
  payload: CreateChargePayload,
): Promise<Folio> {
  return request<Folio>(`/properties/${propertyId}/folios/${folioId}/charges`, {
    method: 'POST',
    body: JSON.stringify(cleanPayload(payload as Record<string, unknown>)),
  });
}

export function addPayment(
  propertyId: string,
  folioId: string,
  payload: CreatePaymentPayload,
): Promise<Folio> {
  return request<Folio>(`/properties/${propertyId}/folios/${folioId}/payments`, {
    method: 'POST',
    body: JSON.stringify(cleanPayload(payload as Record<string, unknown>)),
  });
}

export function settleFolio(propertyId: string, folioId: string): Promise<Folio> {
  return request<Folio>(`/properties/${propertyId}/folios/${folioId}/settle`, {
    method: 'POST',
  });
}

export function getRazorpayConfig(propertyId: string, folioId: string): Promise<{ configured: boolean }> {
  return request<{ configured: boolean }>(`/properties/${propertyId}/folios/${folioId}/razorpay/config`);
}

export function createRazorpayOrder(
  propertyId: string,
  folioId: string,
  payload: { amount: string; reservationId?: string; guestName?: string },
): Promise<{ orderId: string; keyId: string; amount: number; currency: string }> {
  return request<{ orderId: string; keyId: string; amount: number; currency: string }>(
    `/properties/${propertyId}/folios/${folioId}/razorpay/order`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export function verifyRazorpayPayment(
  propertyId: string,
  folioId: string,
  payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    amount: string;
  },
): Promise<Folio> {
  return request<Folio>(`/properties/${propertyId}/folios/${folioId}/razorpay/verify`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getPaymentReceiptUrl(propertyId: string, folioId: string, paymentId: string): string {
  return `${API_BASE_URL}/properties/${propertyId}/folios/${folioId}/payments/${paymentId}/receipt.pdf`;
}

export function getFinalBillUrl(propertyId: string, folioId: string): string {
  return `${API_BASE_URL}/properties/${propertyId}/folios/${folioId}/final-bill.pdf`;
}

export function getBillingOverview(
  propertyId: string,
  signal?: AbortSignal,
): Promise<BillingOverview> {
  return request<BillingOverview>(`/properties/${propertyId}/billing/overview`, { signal });
}

export function friendlyBillingError(error: unknown): string {
  if (error instanceof BillingApiError) {
    if (error.status === 403 || error.code === 'FORBIDDEN') {
      return 'You do not have permission to manage billing.';
    }
    if (error.status === 400) return error.message;
    if (error.status === 404) return 'Folio or reservation not found.';
  }
  return 'Unable to complete billing request. Please try again.';
}

export function formatCurrency(amount: string | number, currency = 'INR'): string {
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
