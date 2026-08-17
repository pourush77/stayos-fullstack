import { API_BASE_URL } from '../../../lib/api-base';

export type ChildPricingMode =
  'FREE' | 'FIXED_PER_NIGHT' | 'PERCENT_OF_ROOM_RATE' | 'ADULT_PRICING' | 'RATE_PLAN_EXTRA_CHILD';

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

export type RatePlanStatus = 'ACTIVE' | 'INACTIVE';

export type MealPlan = 'ROOM_ONLY' | 'BREAKFAST' | 'HALF_BOARD' | 'FULL_BOARD';

export type RatePlanDto = {
  id: string;
  propertyId: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: RatePlanStatus;
  mealPlan: MealPlan;
  refundable: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateRatePlanPayload = {
  code: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  status?: RatePlanStatus;
  mealPlan?: MealPlan;
  refundable?: boolean;
};

export type UpdateRatePlanPayload = Omit<Partial<CreateRatePlanPayload>, 'code'>;

export type RatePlanRoomTypeDto = {
  id: string;
  propertyId: string;
  ratePlanId: string;
  roomTypeId: string;
  baseOccupancy: number;
  baseRate: string;
  extraAdultCharge: string;
  extraChildCharge: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UpsertRatePlanRoomTypePayload = {
  roomTypeId: string;
  baseOccupancy: number;
  baseRate: string;
  extraAdultCharge?: string;
  extraChildCharge?: string;
};

export type DailyRateDto = {
  id: string;
  propertyId: string;
  ratePlanId: string;
  roomTypeId: string;
  stayDate: string;
  amount: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateDailyRatePayload = {
  roomTypeId: string;
  stayDate: string;
  amount: string;
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

export type TaxRuleChargeType =
  'ROOM' | 'FOOD_AND_BEVERAGE' | 'MINIBAR' | 'LAUNDRY' | 'SPA' | 'TAX' | 'DISCOUNT' | 'MISC';

export type TaxRuleDto = {
  id: string;
  propertyId: string;
  name: string;
  chargeType: TaxRuleChargeType;
  hsnSac: string | null;
  taxPercentage: string;
  slabMinAmount: string | null;
  slabMaxAmount: string | null;
  effectiveFrom: string;
  isActive: boolean;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateTaxRulePayload = {
  name: string;
  chargeType: TaxRuleChargeType;
  hsnSac?: string;
  taxPercentage: string;
  slabMinAmount?: string;
  slabMaxAmount?: string;
  effectiveFrom: string;
  isActive?: boolean;
};

export type UpdateTaxRulePayload = Partial<CreateTaxRulePayload>;

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

async function assertSuccessful(response: Response): Promise<void> {
  if (response.ok) return;

  const payload = (await response.json().catch(() => undefined)) as
    ApiEnvelope<unknown> | undefined;

  throw new Error(payload?.message ?? `Request failed with status ${response.status}.`);
}

function jsonRequest(method: string, body?: unknown, signal?: AbortSignal): RequestInit {
  return {
    cache: 'no-store',
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  };
}

export async function getRatePlans(
  propertyId: string,
  signal?: AbortSignal,
): Promise<RatePlanDto[]> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/rate-plans`,
    jsonRequest('GET', undefined, signal),
  );

  return parseResponse<RatePlanDto[]>(response);
}

export async function getRatePlan(
  propertyId: string,
  ratePlanId: string,
  signal?: AbortSignal,
): Promise<RatePlanDto> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/rate-plans/${ratePlanId}`,
    jsonRequest('GET', undefined, signal),
  );

  return parseResponse<RatePlanDto>(response);
}

export async function createRatePlan(
  propertyId: string,
  payload: CreateRatePlanPayload,
  signal?: AbortSignal,
): Promise<RatePlanDto> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/rate-plans`,
    jsonRequest('POST', payload, signal),
  );

  return parseResponse<RatePlanDto>(response);
}

export async function updateRatePlan(
  propertyId: string,
  ratePlanId: string,
  payload: UpdateRatePlanPayload,
  signal?: AbortSignal,
): Promise<RatePlanDto> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/rate-plans/${ratePlanId}`,
    jsonRequest('PATCH', payload, signal),
  );

  return parseResponse<RatePlanDto>(response);
}

export async function getRatePlanRoomTypes(
  propertyId: string,
  ratePlanId: string,
  signal?: AbortSignal,
): Promise<RatePlanRoomTypeDto[]> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/rate-plans/${ratePlanId}/room-types`,
    jsonRequest('GET', undefined, signal),
  );

  return parseResponse<RatePlanRoomTypeDto[]>(response);
}

export async function upsertRatePlanRoomType(
  propertyId: string,
  ratePlanId: string,
  payload: UpsertRatePlanRoomTypePayload,
  signal?: AbortSignal,
): Promise<RatePlanRoomTypeDto> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/rate-plans/${ratePlanId}/room-types`,
    jsonRequest('PUT', payload, signal),
  );

  return parseResponse<RatePlanRoomTypeDto>(response);
}

export async function removeRatePlanRoomType(
  propertyId: string,
  ratePlanId: string,
  roomTypeId: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/rate-plans/${ratePlanId}/room-types/${roomTypeId}`,
    jsonRequest('DELETE', undefined, signal),
  );

  await assertSuccessful(response);
}

export async function getDailyRates(
  propertyId: string,
  ratePlanId: string,
  signal?: AbortSignal,
): Promise<DailyRateDto[]> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/rate-plans/${ratePlanId}/daily-rates`,
    jsonRequest('GET', undefined, signal),
  );

  return parseResponse<DailyRateDto[]>(response);
}

export async function createDailyRate(
  propertyId: string,
  ratePlanId: string,
  payload: CreateDailyRatePayload,
  signal?: AbortSignal,
): Promise<DailyRateDto> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/rate-plans/${ratePlanId}/daily-rates`,
    jsonRequest('POST', payload, signal),
  );

  return parseResponse<DailyRateDto>(response);
}

export async function removeDailyRate(
  propertyId: string,
  dailyRateId: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/daily-rates/${dailyRateId}`,
    jsonRequest('DELETE', undefined, signal),
  );

  await assertSuccessful(response);
}

export async function getGuestPricingPolicy(
  propertyId: string,
  signal?: AbortSignal,
): Promise<GuestPricingPolicyResponse | null> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/guest-pricing-policy`,
    jsonRequest('GET', undefined, signal),
  );

  return parseResponse<GuestPricingPolicyResponse | null>(response);
}

export async function upsertGuestPricingPolicy(
  propertyId: string,
  payload: UpsertGuestPricingPolicyPayload,
): Promise<GuestPricingPolicyResponse> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/guest-pricing-policy`,
    jsonRequest('PUT', payload),
  );

  return parseResponse<GuestPricingPolicyResponse>(response);
}

export async function getTaxRules(propertyId: string, signal?: AbortSignal): Promise<TaxRuleDto[]> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/tax-rules`,
    jsonRequest('GET', undefined, signal),
  );

  return parseResponse<TaxRuleDto[]>(response);
}

export async function createTaxRule(
  propertyId: string,
  payload: CreateTaxRulePayload,
  signal?: AbortSignal,
): Promise<TaxRuleDto> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/tax-rules`,
    jsonRequest('POST', payload, signal),
  );

  return parseResponse<TaxRuleDto>(response);
}

export async function updateTaxRule(
  propertyId: string,
  ruleId: string,
  payload: UpdateTaxRulePayload,
  signal?: AbortSignal,
): Promise<TaxRuleDto> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/tax-rules/${ruleId}`,
    jsonRequest('PATCH', payload, signal),
  );

  return parseResponse<TaxRuleDto>(response);
}

export async function deleteTaxRule(
  propertyId: string,
  ruleId: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/tax-rules/${ruleId}`,
    jsonRequest('DELETE', undefined, signal),
  );

  await assertSuccessful(response);
}

export async function getPropertyTaxConfig(
  propertyId: string,
  signal?: AbortSignal,
): Promise<PropertyTaxConfigDto> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/taxes`,
    jsonRequest('GET', undefined, signal),
  );

  return parseResponse<PropertyTaxConfigDto>(response);
}

export async function upsertPropertyTaxConfig(
  propertyId: string,
  payload: UpsertPropertyTaxConfigPayload,
): Promise<PropertyTaxConfigDto> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/rates/taxes`,
    jsonRequest('PUT', payload),
  );

  return parseResponse<PropertyTaxConfigDto>(response);
}
