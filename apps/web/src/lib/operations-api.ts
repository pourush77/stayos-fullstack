import { API_BASE_URL } from './inventory-api';

type ApiResponse<T> = T | { data?: T } | { items?: T } | { results?: T };

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

  if (!response.ok) {
    throw new Error(`Operations API request failed: ${response.status} ${response.statusText}`);
  }

  return unwrapResponse<T>(payload as ApiResponse<T>);
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    signal,
  });

  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

  if (!response.ok) {
    const errMsg =
      (payload as unknown as { error?: { message?: string } })?.error?.message ||
      (payload as unknown as { message?: string })?.message;
    throw new Error(errMsg || `Operations API request failed: ${response.status} ${response.statusText}`);
  }

  return unwrapResponse<T>(payload as ApiResponse<T>);
}

async function patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
    signal,
  });

  const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

  if (!response.ok) {
    throw new Error(`Operations API request failed: ${response.status} ${response.statusText}`);
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

export type OperationsUiStatus = 'READY' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'UNAVAILABLE';

export type OperationsAttentionLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

export type OperationsRoomBoardItemDto = {
  roomId: string;
  roomNumber: string;
  floor: {
    id: string;
    name?: string;
    code?: string;
    floorNumber?: number;
  };
  roomType: {
    id: string;
    code?: string;
    name: string;
  };
  uiStatus: OperationsUiStatus;
  operationalStatus: string;
  currentStay?: {
    reservationId: string;
    reservationCode: string;
    guestId: string;
    guestName: string;
    arrivalDate: string;
    departureDate: string;
    checkInTime?: string;
    checkedInAt?: string;
    checkOutTime?: string;
    checkedOutAt?: string;
    adults?: number;
    children?: number;
    guestCount?: number;
    specialRequests?: string[];
    status: string;
    paymentStatus?: string;
  } | null;
  checkoutLabel?: string | null;
  groupContext?: {
    groupBookingId: string;
    groupCode: string;
    groupName: string;
    masterFolioId: string;
    masterFolioNumber: string;
    status: string;
  } | null;
  primaryAction: string;
  attentionLevel: OperationsAttentionLevel;
};

export type OperationsRoomDetailsDto = Record<string, unknown>;

export type OperationsAvailableRoomDto = OperationsRoomBoardItemDto;

export type OperationsAttentionItemDto = {
  type: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  relatedEntity?: {
    type: string;
    id: string;
  };
  primaryAction: string;
};

export type OperationsActivityItemDto = {
  title: string;
  description: string;
  timestamp: string;
  entity?: {
    type: string;
    id: string;
  };
  metadata?: Record<string, unknown>;
};

export type GroupRoomMixPreference = 'BEST_FIT' | 'COMFORT' | 'BUDGET';

export type GroupRoomMixAvailabilityDto = {
  availableRooms: number;
  baseRate: number;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  roomTypeCode: string;
  roomTypeId: string;
  roomTypeName: string;
};

export type GroupRoomMixBlockDto = {
  adultsPerRoom: number;
  baseRate: number;
  childrenPerRoom: number;
  estimatedTotal: number;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  rooms: number;
  roomTypeCode: string;
  roomTypeId: string;
  roomTypeName: string;
};

export type GroupRoomMixOptionDto = {
  adultCapacity: number;
  canCreateHold: boolean;
  canCreateWalkInGroup: boolean;
  childCapacity: number;
  estimatedTotal: number;
  label: string;
  reason: string;
  roomBlocks: GroupRoomMixBlockDto[];
  spareCapacity: number;
  totalCapacity: number;
  totalRooms: number;
  type: 'BEST_FIT' | 'COMFORT' | 'BUDGET' | 'MAX_CAPACITY';
};

export type GroupRoomMixSuggestionDto = {
  adults: number;
  arrivalDate: string;
  availability: GroupRoomMixAvailabilityDto[];
  channelManagerSyncReady: boolean;
  children: number;
  departureDate: string;
  nights: number;
  options: GroupRoomMixOptionDto[];
  warnings: string[];
};

export type GroupBookingSource = 'WALK_IN' | 'PHONE' | 'AGENT' | 'CORPORATE' | 'CHANNEL_MANAGER';

export type CreateGroupHoldDto = {
  adults: number;
  arrivalDate: string;
  children: number;
  departureDate: string;
  depositRequired?: number;
  estimatedTotal?: number;
  groupName: string;
  leadEmail?: string;
  leadName: string;
  leadPhone: string;
  notes?: string;
  releaseAt?: string;
  roomBlocks: Array<{
    adultsPerRoom: number;
    baseRate?: number;
    childrenPerRoom: number;
    estimatedTotal?: number;
    roomTypeId: string;
    rooms: number;
  }>;
  source: GroupBookingSource;
};

export type GroupHoldDto = {
  adults: number;
  arrivalDate: string;
  children: number;
  departureDate: string;
  depositRequired: number;
  estimatedTotal: number;
  groupCode: string;
  groupName: string;
  id: string;
  leadEmail: string | null;
  leadName: string;
  leadPhone: string;
  releaseAt: string | null;
  roomBlocks: Array<{
    adultsPerRoom: number;
    baseRate: number;
    childrenPerRoom: number;
    estimatedTotal: number;
    id: string;
    roomTypeId: string;
    roomTypeName: string;
    rooms: number;
  }>;
  roomAssignments: Array<{
    id: string;
    roomId: string;
    roomNumber: string;
    roomTypeId: string;
    roomTypeName: string;
  }>;
  roomingList: Array<{
    adults: number;
    assignedRoomId: string | null;
    children: number;
    guestName: string;
    id: string;
    notes: string | null;
    phone: string | null;
  }>;
  readiness: {
    canConfirm: boolean;
    contactComplete: boolean;
    depositRequired: boolean;
    fullyAssigned: boolean;
    releaseDateSet: boolean;
    roomingListStarted: boolean;
  };
  source: GroupBookingSource;
  status: 'ON_HOLD' | 'CONFIRMED' | 'RELEASED' | 'CANCELLED' | 'CHECKED_IN' | 'CHECKED_OUT';
  syncStatus: string;
};

export type UpdateGroupHoldDto = {
  depositRequired?: number;
  groupName?: string;
  leadEmail?: string;
  leadName?: string;
  leadPhone?: string;
  notes?: string;
  releaseAt?: string;
};

export type CreateWalkInGroupDto = {
  groupName: string;
  leadName: string;
  leadPhone: string;
  leadEmail?: string;
  arrivalDate: string;
  departureDate: string;
  estimatedTotal?: number;
  depositRequired?: number;
  notes?: string;
  roomAssignments: Array<{
    roomId: string;
    adults: number;
    children: number;
    guestName?: string;
    baseRate?: number;
  }>;
};

export type GroupCheckInPreviewDto = {
  blockers: string[];
  canCheckIn: boolean;
  folioMode: 'MASTER_FOLIO_ONLY';
  group: GroupHoldDto;
  rooms: Array<{
    operationalStatus: string;
    ready: boolean;
    roomId: string;
    roomNumber: string;
    roomTypeName: string;
  }>;
  warnings: string[];
};

export type GroupCheckInResultDto = {
  group: GroupHoldDto;
  groupStayId: string;
  masterFolioId: string;
  masterFolioNumber: string;
  occupiedRooms: string[];
};

export type InHouseGroupDto = {
  arrivalDate: string;
  departureDate: string;
  groupBookingId: string;
  groupCode: string;
  groupName: string;
  leadName: string;
  masterFolioId: string;
  masterFolioNumber: string;
  occupiedRooms: string[];
  roomCount: number;
};

export type GroupMasterFolioChargeDto = {
  id: string;
  label: string;
  type: string;
  amount: number;
  quantity: number;
  currency: string;
};

export type GroupMasterFolioPaymentDto = {
  id: string;
  method: string;
  amount: number;
  receivedAt: string;
};

export type GroupMasterFolioCheckoutSummaryDto = {
  balanceDue: number;
  occupiedRoomCount: number;
  checkoutEligible: boolean;
  checkoutBlockers: string[];
};

export type GroupMasterFolioDetailDto = {
  id: string;
  groupBookingId: string;
  groupCode: string;
  groupName: string;
  arrivalDate: string;
  departureDate: string;
  folioNumber: string;
  currency: string;
  status: string;
  estimatedTotal: number;
  rooms: Array<{
    roomId: string;
    roomNumber: string;
    roomTypeName: string;
    roomTypeId: string;
  }>;
  charges: GroupMasterFolioChargeDto[];
  payments: GroupMasterFolioPaymentDto[];
  checkoutSummary: GroupMasterFolioCheckoutSummaryDto;
};

export function postGroupMasterFolioCharge(
  propertyId: string,
  groupBookingId: string,
  body: { amount: number; label: string; quantity?: number; type?: string },
  signal?: AbortSignal,
) {
  return post<GroupMasterFolioDetailDto>(
    `/properties/${propertyId}/operations/group-bookings/${groupBookingId}/master-folio/charges`,
    body,
    signal,
  );
}

export function postGroupMasterFolioPayment(
  propertyId: string,
  groupBookingId: string,
  body: { amount: number; method: string; reference?: string },
  signal?: AbortSignal,
) {
  return post<GroupMasterFolioDetailDto>(
    `/properties/${propertyId}/operations/group-bookings/${groupBookingId}/master-folio/payments`,
    body,
    signal,
  );
}

export function completeGroupCheckout(
  propertyId: string,
  groupBookingId: string,
  signal?: AbortSignal,
) {
  return post<GroupMasterFolioDetailDto>(
    `/properties/${propertyId}/operations/group-bookings/${groupBookingId}/master-folio/checkout`,
    {},
    signal,
  );
}

export function getRoomBoard(propertyId: string, signal?: AbortSignal) {
  return get<OperationsRoomBoardItemDto[]>(
    `/properties/${propertyId}/operations/room-board`,
    signal,
  );
}

export function getRoomDetails(propertyId: string, roomId: string, signal?: AbortSignal) {
  return get<OperationsRoomDetailsDto>(
    `/properties/${propertyId}/operations/rooms/${roomId}`,
    signal,
  );
}

export function getAvailableRooms(
  propertyId: string,
  params: {
    arrivalDate?: string;
    departureDate?: string;
    roomTypeId?: string;
    guestCount?: number;
    adults?: number;
    children?: number;
    accessible?: boolean;
    connecting?: boolean;
    vipPreferred?: boolean;
  } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return get<OperationsAvailableRoomDto[]>(
    `/properties/${propertyId}/operations/available-rooms${suffix}`,
    signal,
  );
}

export function getGroupRoomMixSuggestions(
  propertyId: string,
  params: {
    adults: number;
    arrivalDate: string;
    children: number;
    departureDate: string;
    preference?: GroupRoomMixPreference;
  },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  return get<GroupRoomMixSuggestionDto>(
    `/properties/${propertyId}/operations/group-room-mix-suggestions?${query.toString()}`,
    signal,
  );
}

export function createGroupHold(
  propertyId: string,
  body: CreateGroupHoldDto,
  signal?: AbortSignal,
) {
  return post<GroupHoldDto>(`/properties/${propertyId}/operations/group-holds`, body, signal);
}

export function createWalkInGroup(
  propertyId: string,
  body: CreateWalkInGroupDto,
  signal?: AbortSignal,
) {
  return post<GroupCheckInResultDto>(
    `/properties/${propertyId}/operations/group-holds/walk-in`,
    body,
    signal,
  );
}

export function getGroupHolds(propertyId: string, signal?: AbortSignal) {
  return get<GroupHoldDto[]>(`/properties/${propertyId}/operations/group-holds`, signal);
}

export function getGroupHold(propertyId: string, groupHoldId: string, signal?: AbortSignal) {
  return get<GroupHoldDto>(
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}`,
    signal,
  );
}

export function updateGroupHold(
  propertyId: string,
  groupHoldId: string,
  body: UpdateGroupHoldDto,
  signal?: AbortSignal,
) {
  return patch<GroupHoldDto>(
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}`,
    body,
    signal,
  );
}

export function releaseGroupHold(propertyId: string, groupHoldId: string, signal?: AbortSignal) {
  return post<GroupHoldDto>(
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/release`,
    {},
    signal,
  );
}

export function cancelGroupHold(propertyId: string, groupHoldId: string, signal?: AbortSignal) {
  return post<GroupHoldDto>(
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/cancel`,
    {},
    signal,
  );
}

export function confirmGroupHold(propertyId: string, groupHoldId: string, signal?: AbortSignal) {
  return post<GroupHoldDto>(
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/confirm`,
    {},
    signal,
  );
}

export function addGroupRoomingListItem(
  propertyId: string,
  groupHoldId: string,
  body: { adults: number; children: number; guestName: string; notes?: string; phone?: string },
  signal?: AbortSignal,
) {
  return post<GroupHoldDto>(
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/rooming-list`,
    body,
    signal,
  );
}

export function assignGroupRoom(
  propertyId: string,
  groupHoldId: string,
  body: { roomId: string },
  signal?: AbortSignal,
) {
  return post<GroupHoldDto>(
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/room-assignments`,
    body,
    signal,
  );
}

export function getGroupCheckInPreview(
  propertyId: string,
  groupHoldId: string,
  signal?: AbortSignal,
) {
  return get<GroupCheckInPreviewDto>(
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/check-in-preview`,
    signal,
  );
}

export function checkInGroup(propertyId: string, groupHoldId: string, signal?: AbortSignal) {
  return post<GroupCheckInResultDto>(
    `/properties/${propertyId}/operations/group-holds/${groupHoldId}/check-in`,
    {},
    signal,
  );
}

export function getInHouseGroups(propertyId: string, signal?: AbortSignal) {
  return get<InHouseGroupDto[]>(`/properties/${propertyId}/operations/in-house-groups`, signal);
}

export function getGroupMasterFolio(
  propertyId: string,
  groupBookingId: string,
  signal?: AbortSignal,
) {
  return get<GroupMasterFolioDetailDto>(
    `/properties/${propertyId}/operations/group-bookings/${groupBookingId}/master-folio`,
    signal,
  );
}

export function getNeedsAttention(propertyId: string, signal?: AbortSignal) {
  return get<OperationsAttentionItemDto[]>(
    `/properties/${propertyId}/operations/needs-attention`,
    signal,
  );
}

export function getActivityFeed(
  propertyId: string,
  params: {
    entityType?: string;
    entityId?: string;
    type?: string;
    limit?: number;
  } = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return get<OperationsActivityItemDto[]>(`/properties/${propertyId}/activity${suffix}`, signal);
}
