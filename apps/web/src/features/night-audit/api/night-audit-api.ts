import { API_BASE_URL } from '../../../lib/api-base';
import type {
  NightAuditRunResponseDto,
  NightAuditValidationDto,
} from '../types/night-audit.types';

type ApiResponse<T> = {
  data?: T;
  message?: string;
  statusCode?: number;
  code?: string;
  validation?: NightAuditValidationDto;
  businessDate?: string;
  error?: string | { message?: string; code?: string; validation?: NightAuditValidationDto; businessDate?: string };
};

export class NightAuditApiError extends Error {
  status: number;
  code?: string;
  validation?: NightAuditValidationDto;
  businessDate?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    validation?: NightAuditValidationDto,
    businessDate?: string,
  ) {
    super(message);
    this.name = 'NightAuditApiError';
    this.status = status;
    this.code = code;
    this.validation = validation;
    this.businessDate = businessDate;
  }
}

/**
 * Pure timezone-safe date formatter for calendar date strings (YYYY-MM-DD).
 * Formats "2026-09-04" -> "04 Sep 2026".
 */
export function formatBusinessDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthIndex = parseInt(m, 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${d} ${months[monthIndex]} ${y}`;
    }
  }
  return dateStr;
}

/**
 * Pure calendar day advancement for YYYY-MM-DD.
 * Handles month roll-overs, year boundaries, and leap years.
 */
export function advanceCalendarDay(dateString: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    throw new Error(`Invalid calendar date format: "${dateString}". Expected YYYY-MM-DD.`);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  const inputDate = new Date(Date.UTC(year, month - 1, day));
  if (
    inputDate.getUTCFullYear() !== year ||
    inputDate.getUTCMonth() + 1 !== month ||
    inputDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date values: "${dateString}".`);
  }

  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(nextDate.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

/**
 * Formats monetary amounts in INR without performing arithmetic recalculations.
 */
export function formatCurrency(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₹0.00';
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(numeric)) return String(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const body = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

  if (!response.ok) {
    const rawError = body?.error;
    const rawErrorObj = typeof rawError === 'object' && rawError !== null ? rawError : undefined;

    const message =
      body?.message ??
      (typeof rawError === 'string' ? rawError : rawErrorObj?.message) ??
      `Night Audit request failed: ${response.status}`;

    const code =
      body?.code ??
      rawErrorObj?.code;

    const validation = body?.validation ?? rawErrorObj?.validation;
    const businessDate = body?.businessDate ?? rawErrorObj?.businessDate;

    throw new NightAuditApiError(
      String(message),
      response.status,
      code,
      validation,
      businessDate,
    );
  }

  return (body?.data ?? (body as unknown as T)) as T;
}

/**
 * Retrieves or initializes the OPEN NightAuditRun and operational workspace
 * for the property's current business date.
 */
export async function getNightAudit(
  propertyId: string,
  signal?: AbortSignal,
): Promise<NightAuditRunResponseDto> {
  return request<NightAuditRunResponseDto>(
    `/properties/${encodeURIComponent(propertyId)}/night-audit`,
    {
      method: 'GET',
      signal,
    },
  );
}

/**
 * Atomically closes the currently OPEN NightAuditRun, validates all operational items,
 * and advances the property business date by exactly one day.
 */
export async function closeNightAudit(
  propertyId: string,
  auditorNote?: string,
  signal?: AbortSignal,
): Promise<NightAuditRunResponseDto> {
  return request<NightAuditRunResponseDto>(
    `/properties/${encodeURIComponent(propertyId)}/night-audit/close`,
    {
      method: 'POST',
      body: auditorNote && auditorNote.trim() ? JSON.stringify({ auditorNote: auditorNote.trim() }) : undefined,
      signal,
    },
  );
}
