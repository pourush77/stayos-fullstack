import { API_BASE_URL } from '../../../lib/api-base';

export type ChildPricingMode =
  'FREE' | 'FIXED_PER_NIGHT' | 'PERCENT_OF_ROOM_RATE' | 'ADULT_PRICING';

export type ChildAgeBandDto = {
  id?: string;
  guestPricingPolicyId?: string;
  label: string;
  minAge: number;
  maxAge: number;
  pricingMode: ChildPricingMode;
  fixedAmount: string | null;
  percentage: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type GuestPricingPolicyDto = {
  id: string;
  propertyId: string;
  ageBasedChildPricingEnabled: boolean;
  maximumChildAge: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type GuestPricingPolicyResponse = {
  policy: GuestPricingPolicyDto;
  childAgeBands: ChildAgeBandDto[];
};

export type UpsertChildAgeBandPayload = {
  label: string;
  minAge: number;
  maxAge: number;
  pricingMode: ChildPricingMode;
  fixedAmount?: string;
  percentage?: string;
  displayOrder?: number;
  isActive?: boolean;
};

export type UpsertGuestPricingPolicyPayload = {
  ageBasedChildPricingEnabled: boolean;
  maximumChildAge: number;
  isActive: boolean;
  childAgeBands: UpsertChildAgeBandPayload[];
};

export type PropertyTaxConfigDto = {
  id?: string;
  propertyId: string;
  name: string;
  percentage: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type UpsertPropertyTaxConfigPayload = {
  name: string;
  percentage: string;
  isActive: boolean;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

function unwrap<T>(payload: T | ApiEnvelope<T>): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as ApiEnvelope<T>).data !== undefined
  ) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => undefined)) as T | ApiEnvelope<T> | undefined;

  if (!response.ok) {
    const envelope = payload as ApiEnvelope<T> | undefined;

    throw new Error(envelope?.message ?? `Request failed with status ${response.status}.`);
  }

  if (payload === undefined) {
    throw new Error('API returned an empty response.');
  }

  return unwrap(payload);
}

export async function getGuestPricingPolicy(
  propertyId: string,
  signal?: AbortSignal,
): Promise<GuestPricingPolicyResponse | null> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/guest-pricing-policy`,
    {
      cache: 'no-store',
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    },
  );

  return parseResponse<GuestPricingPolicyResponse | null>(response);
}

export async function upsertGuestPricingPolicy(
  propertyId: string,
  payload: UpsertGuestPricingPolicyPayload,
): Promise<GuestPricingPolicyResponse> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/guest-pricing-policy`,
    {
      cache: 'no-store',
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  return parseResponse<GuestPricingPolicyResponse>(response);
}

export async function getPropertyTaxConfig(
  propertyId: string,
  signal?: AbortSignal,
): Promise<PropertyTaxConfigDto> {
  const response = await fetch(`${API_BASE_URL}/properties/${propertyId}/rates/taxes`, {
    cache: 'no-store',
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  return parseResponse<PropertyTaxConfigDto>(response);
}

export async function upsertPropertyTaxConfig(
  propertyId: string,
  payload: UpsertPropertyTaxConfigPayload,
): Promise<PropertyTaxConfigDto> {
  const response = await fetch(`${API_BASE_URL}/properties/${propertyId}/rates/taxes`, {
    cache: 'no-store',
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<PropertyTaxConfigDto>(response);
}
