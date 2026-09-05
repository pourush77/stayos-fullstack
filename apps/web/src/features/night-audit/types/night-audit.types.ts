export type NightAuditRunStatus = 'OPEN' | 'COMPLETED';

export type NightAuditStayReviewState = 'STAYOVER' | 'DUE_OUT' | 'OVERDUE';

export type NightAuditFolioExceptionType =
  | 'OUTSTANDING_BALANCE'
  | 'UNSETTLED_ZERO_BALANCE'
  | 'MISSING_FOLIO';

export type NightAuditValidationReasonCode =
  | 'PENDING_ARRIVALS'
  | 'DUE_OUT_OR_OVERDUE_STAYS'
  | 'FOLIO_EXCEPTIONS'
  | 'GROUP_EXCEPTIONS';

export interface NightAuditActionDto {
  type: string;
}

export interface NightAuditPendingArrivalItemDto {
  reservationId: string;
  confirmationNumber: string;
  reservationCode?: string;
  guestId: string | null;
  guestName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  roomId: string | null;
  roomNumber: string | null;
  roomTypeId: string | null;
  actions: NightAuditActionDto[];
}

export interface NightAuditPendingArrivalsSectionDto {
  count: number;
  blockingCount: number;
  items: NightAuditPendingArrivalItemDto[];
}

export interface NightAuditStayReviewItemDto {
  reservationId: string;
  confirmationNumber: string;
  reservationCode?: string;
  guestId: string | null;
  guestName: string;
  arrivalDate: string;
  departureDate: string;
  roomId: string | null;
  roomNumber: string | null;
  roomTypeId: string | null;
  status: string;
  reviewState: NightAuditStayReviewState;
  blocking: boolean;
  roomAssignmentMissing?: boolean;
  actions: NightAuditActionDto[];
}

export interface NightAuditStayReviewSummaryDto {
  stayover: number;
  dueOut: number;
  overdue: number;
}

export interface NightAuditStayReviewSectionDto {
  count: number;
  blockingCount: number;
  summary: NightAuditStayReviewSummaryDto;
  items: NightAuditStayReviewItemDto[];
}

export interface NightAuditFolioExceptionItemDto {
  reservationId: string;
  confirmationNumber: string;
  reservationCode?: string;
  guestId: string | null;
  guestName: string;
  departureDate?: string;
  roomId?: string | null;
  roomNumber?: string | null;
  folioId: string | null;
  folioStatus: string | null;
  stayReviewState: NightAuditStayReviewState;
  totalCharges: string;
  totalPayments: string;
  totalRefunds: string;
  balanceDue: string;
  exceptionType: NightAuditFolioExceptionType;
  blocking: boolean;
  actions: NightAuditActionDto[];
}

export interface NightAuditFolioExceptionsSummaryDto {
  outstandingBalance: number;
  unsettledZeroBalance: number;
  missingFolio: number;
}

export interface NightAuditFolioExceptionsSectionDto {
  count: number;
  blockingCount: number;
  summary: NightAuditFolioExceptionsSummaryDto;
  items: NightAuditFolioExceptionItemDto[];
}

export interface NightAuditGroupReviewAssignedRoomDto {
  roomId: string;
  roomNumber: string;
}

export interface NightAuditGroupReviewItemDto {
  groupBookingId: string;
  groupCode: string;
  groupName: string;
  leadGuestName?: string | null;
  leadName?: string | null;
  arrivalDate: string;
  departureDate: string;
  groupBookingStatus: string;
  groupStayStatus: string;
  reviewState: NightAuditStayReviewState;
  assignedRoomCount: number;
  assignedRooms: NightAuditGroupReviewAssignedRoomDto[];
  roomAssignmentMissing: boolean;
  masterFolioId: string | null;
  masterFolioStatus: string | null;
  totalCharges: number;
  estimatedTotal: number;
  totalPayments: number;
  totalPaid?: number;
  balanceDue: number;
  checkoutEligible: boolean;
  financialException: boolean;
  operationalException: boolean;
  blocking: boolean;
  actions: NightAuditActionDto[];
}

export interface NightAuditGroupReviewSummaryDto {
  stayover: number;
  dueOut: number;
  overdue: number;
  financialExceptions: number;
  operationalExceptions: number;
}

export interface NightAuditGroupReviewSectionDto {
  count: number;
  blockingCount: number;
  summary: NightAuditGroupReviewSummaryDto;
  items: NightAuditGroupReviewItemDto[];
}

export interface NightAuditWorkspaceDto {
  pendingArrivals: NightAuditPendingArrivalsSectionDto;
  stayReview: NightAuditStayReviewSectionDto;
  folioExceptions: NightAuditFolioExceptionsSectionDto;
  groupReview: NightAuditGroupReviewSectionDto;
}

export interface NightAuditValidationBlockersDto {
  pendingArrivals: number;
  stayReview: number;
  folioExceptions: number;
  groupReview: number;
}

export interface NightAuditValidationReasonDto {
  code: NightAuditValidationReasonCode;
  count: number;
}

export interface NightAuditValidationDto {
  canClose: boolean;
  totalBlockingCount: number;
  blockers: NightAuditValidationBlockersDto;
  reasons: NightAuditValidationReasonDto[];
}

export interface NightAuditRunResponseDto {
  id: string;
  propertyId: string;
  businessDate: string;
  status: NightAuditRunStatus;
  startedAt: string | Date;
  startedByUserId: string;
  completedByUserId?: string | null;
  completedAt?: string | Date | null;
  summary?: Record<string, unknown> | null;
  nextBusinessDate?: string | null;
  workspace?: NightAuditWorkspaceDto;
  validation?: NightAuditValidationDto;
  createdAt: string | Date;
  updatedAt: string | Date;
}
