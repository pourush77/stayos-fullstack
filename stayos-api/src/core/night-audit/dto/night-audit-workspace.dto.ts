import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FolioStatus } from '../../billing/domain/folio-status.enum';
import { ReservationStatus } from '../../reservations/domain/reservation-status.enum';
import { GroupBookingStatus } from '../../operations/domain/group-booking-status.enum';

export enum NightAuditStayReviewState {
  STAYOVER = 'STAYOVER',
  DUE_OUT = 'DUE_OUT',
  OVERDUE = 'OVERDUE',
}

export class NightAuditActionDto {
  @ApiProperty({ example: 'CHECK_IN', description: 'Action type code' })
  type!: string;
}

export class NightAuditPendingArrivalItemDto {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;

  @ApiProperty({ example: 'RES-1001' })
  confirmationNumber!: string;

  @ApiPropertyOptional({ example: 'RES-1001' })
  reservationCode?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  guestId!: string | null;

  @ApiProperty({ example: 'John Doe' })
  guestName!: string;

  @ApiProperty({ example: '2026-09-04' })
  arrivalDate!: string;

  @ApiProperty({ example: '2026-09-06' })
  departureDate!: string;

  @ApiProperty({ enum: ReservationStatus })
  status!: ReservationStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  roomId!: string | null;

  @ApiPropertyOptional({ example: '101', nullable: true })
  roomNumber!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  roomTypeId!: string | null;

  @ApiProperty({ type: () => [NightAuditActionDto] })
  actions!: NightAuditActionDto[];
}

export class NightAuditPendingArrivalsSectionDto {
  @ApiProperty({ example: 3 })
  count!: number;

  @ApiProperty({ example: 3, description: 'Number of pending arrivals blocking audit completion' })
  blockingCount!: number;

  @ApiProperty({ type: () => [NightAuditPendingArrivalItemDto] })
  items!: NightAuditPendingArrivalItemDto[];
}

export class NightAuditStayReviewItemDto {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;

  @ApiProperty({ example: 'RES-1001' })
  confirmationNumber!: string;

  @ApiPropertyOptional({ example: 'RES-1001' })
  reservationCode?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  guestId!: string | null;

  @ApiProperty({ example: 'John Doe' })
  guestName!: string;

  @ApiProperty({ example: '2026-09-01' })
  arrivalDate!: string;

  @ApiProperty({ example: '2026-09-04' })
  departureDate!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  roomId!: string | null;

  @ApiPropertyOptional({ example: '101', nullable: true })
  roomNumber!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  roomTypeId!: string | null;

  @ApiProperty({ enum: ReservationStatus, example: ReservationStatus.CHECKED_IN })
  status!: ReservationStatus;

  @ApiProperty({ enum: NightAuditStayReviewState, example: NightAuditStayReviewState.DUE_OUT })
  reviewState!: NightAuditStayReviewState;

  @ApiProperty({ example: true, description: 'Whether this stay review item blocks night audit completion' })
  blocking!: boolean;

  @ApiPropertyOptional({ example: false, description: 'Flag indicating if checked-in reservation is missing roomId' })
  roomAssignmentMissing?: boolean;

  @ApiProperty({ type: () => [NightAuditActionDto] })
  actions!: NightAuditActionDto[];
}

export class NightAuditStayReviewSummaryDto {
  @ApiProperty({ example: 5, description: 'Checked-in guests departing after audit date (non-blocking)' })
  stayover!: number;

  @ApiProperty({ example: 2, description: 'Checked-in guests departing on audit date (blocking)' })
  dueOut!: number;

  @ApiProperty({ example: 1, description: 'Checked-in guests with departure before audit date (blocking)' })
  overdue!: number;
}

export class NightAuditStayReviewSectionDto {
  @ApiProperty({ example: 8 })
  count!: number;

  @ApiProperty({ example: 3, description: 'Total blocking stays (dueOut + overdue)' })
  blockingCount!: number;

  @ApiProperty({ type: () => NightAuditStayReviewSummaryDto })
  summary!: NightAuditStayReviewSummaryDto;

  @ApiProperty({ type: () => [NightAuditStayReviewItemDto] })
  items!: NightAuditStayReviewItemDto[];
}

export enum NightAuditFolioExceptionType {
  OUTSTANDING_BALANCE = 'OUTSTANDING_BALANCE',
  UNSETTLED_ZERO_BALANCE = 'UNSETTLED_ZERO_BALANCE',
  MISSING_FOLIO = 'MISSING_FOLIO',
}

export class NightAuditFolioExceptionItemDto {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;

  @ApiProperty({ example: 'RES-1001' })
  confirmationNumber!: string;

  @ApiPropertyOptional({ example: 'RES-1001' })
  reservationCode?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  guestId!: string | null;

  @ApiProperty({ example: 'John Doe' })
  guestName!: string;

  @ApiPropertyOptional({ example: '2026-09-04' })
  departureDate?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  roomId?: string | null;

  @ApiPropertyOptional({ example: '101', nullable: true })
  roomNumber?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  folioId!: string | null;

  @ApiPropertyOptional({ enum: FolioStatus, nullable: true })
  folioStatus!: FolioStatus | null;

  @ApiProperty({ enum: NightAuditStayReviewState })
  stayReviewState!: NightAuditStayReviewState;

  @ApiProperty({ example: '1500.00', description: 'Total charges on folio' })
  totalCharges!: string;

  @ApiProperty({ example: '500.00', description: 'Total payments on folio' })
  totalPayments!: string;

  @ApiProperty({ example: '0.00', description: 'Total refunds on folio' })
  totalRefunds!: string;

  @ApiProperty({ example: '1000.00', description: 'Net balance due' })
  balanceDue!: string;

  @ApiProperty({ enum: NightAuditFolioExceptionType })
  exceptionType!: NightAuditFolioExceptionType;

  @ApiProperty({ example: true, description: 'Whether this exception blocks night audit completion' })
  blocking!: boolean;

  @ApiProperty({ type: () => [NightAuditActionDto] })
  actions!: NightAuditActionDto[];
}

export class NightAuditFolioExceptionsSummaryDto {
  @ApiProperty({ example: 2, description: 'Number of folios with outstanding balance' })
  outstandingBalance!: number;

  @ApiProperty({ example: 1, description: 'Number of folios with zero balance that remain unsettled' })
  unsettledZeroBalance!: number;

  @ApiProperty({ example: 0, description: 'Number of checked-in stays missing a folio' })
  missingFolio!: number;
}

export class NightAuditFolioExceptionsSectionDto {
  @ApiProperty({ example: 3 })
  count!: number;

  @ApiProperty({ example: 2, description: 'Total blocking folio exceptions' })
  blockingCount!: number;

  @ApiProperty({ type: () => NightAuditFolioExceptionsSummaryDto })
  summary!: NightAuditFolioExceptionsSummaryDto;

  @ApiProperty({ type: () => [NightAuditFolioExceptionItemDto] })
  items!: NightAuditFolioExceptionItemDto[];
}

export class NightAuditGroupReviewAssignedRoomDto {
  @ApiProperty({ format: 'uuid' })
  roomId!: string;

  @ApiProperty({ example: '101' })
  roomNumber!: string;
}

export class NightAuditGroupReviewItemDto {
  @ApiProperty({ format: 'uuid' })
  groupBookingId!: string;

  @ApiProperty({ example: 'GRP-1001' })
  groupCode!: string;

  @ApiProperty({ example: 'Tech Conference 2026' })
  groupName!: string;

  @ApiPropertyOptional({ example: 'Alice Johnson', nullable: true })
  leadGuestName!: string | null;

  @ApiPropertyOptional({ example: 'Alice Johnson', nullable: true })
  leadName!: string | null;

  @ApiProperty({ example: '2026-09-01' })
  arrivalDate!: string;

  @ApiProperty({ example: '2026-09-04' })
  departureDate!: string;

  @ApiProperty({ enum: GroupBookingStatus, example: GroupBookingStatus.CHECKED_IN })
  groupBookingStatus!: GroupBookingStatus;

  @ApiProperty({ example: 'IN_HOUSE' })
  groupStayStatus!: string;

  @ApiProperty({ enum: NightAuditStayReviewState, example: NightAuditStayReviewState.DUE_OUT })
  reviewState!: NightAuditStayReviewState;

  @ApiProperty({ example: 2 })
  assignedRoomCount!: number;

  @ApiProperty({ type: () => [NightAuditGroupReviewAssignedRoomDto] })
  assignedRooms!: NightAuditGroupReviewAssignedRoomDto[];

  @ApiProperty({ example: false })
  roomAssignmentMissing!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  masterFolioId!: string | null;

  @ApiPropertyOptional({ example: 'OPEN', nullable: true })
  masterFolioStatus!: string | null;

  @ApiProperty({ example: 5000, description: 'Total charges / estimated total using existing group model' })
  totalCharges!: number;

  @ApiProperty({ example: 5000, description: 'Estimated total charges for compatibility' })
  estimatedTotal!: number;

  @ApiProperty({ example: 2500, description: 'Total payments recorded against group master folio' })
  totalPayments!: number;

  @ApiPropertyOptional({ example: 2500, description: 'Total paid for compatibility' })
  totalPaid!: number;

  @ApiProperty({ example: 2500, description: 'Balance due on group master folio' })
  balanceDue!: number;

  @ApiProperty({ example: false, description: 'Whether the group is eligible for checkout' })
  checkoutEligible!: boolean;

  @ApiProperty({ example: true, description: 'Whether there is a financial exception' })
  financialException!: boolean;

  @ApiProperty({ example: false, description: 'Whether there is an operational exception' })
  operationalException!: boolean;

  @ApiProperty({ example: true, description: 'Whether this group blocks night audit completion' })
  blocking!: boolean;

  @ApiProperty({ type: () => [NightAuditActionDto] })
  actions!: NightAuditActionDto[];
}

export class NightAuditGroupReviewSummaryDto {
  @ApiProperty({ example: 3, description: 'In-house groups departing after audit date' })
  stayover!: number;

  @ApiProperty({ example: 1, description: 'In-house groups departing on audit date' })
  dueOut!: number;

  @ApiProperty({ example: 0, description: 'In-house groups with departure before audit date' })
  overdue!: number;

  @ApiProperty({ example: 2, description: 'Total groups with financial exceptions' })
  financialExceptions!: number;

  @ApiProperty({ example: 1, description: 'Total groups with operational exceptions' })
  operationalExceptions!: number;
}

export class NightAuditGroupReviewSectionDto {
  @ApiProperty({ example: 4 })
  count!: number;

  @ApiProperty({ example: 2, description: 'Total groups blocking night audit completion' })
  blockingCount!: number;

  @ApiProperty({ type: () => NightAuditGroupReviewSummaryDto })
  summary!: NightAuditGroupReviewSummaryDto;

  @ApiProperty({ type: () => [NightAuditGroupReviewItemDto] })
  items!: NightAuditGroupReviewItemDto[];
}

export class NightAuditWorkspaceDto {
  @ApiProperty({ type: () => NightAuditPendingArrivalsSectionDto })
  pendingArrivals!: NightAuditPendingArrivalsSectionDto;

  @ApiProperty({ type: () => NightAuditStayReviewSectionDto })
  stayReview!: NightAuditStayReviewSectionDto;

  @ApiProperty({ type: () => NightAuditFolioExceptionsSectionDto })
  folioExceptions!: NightAuditFolioExceptionsSectionDto;

  @ApiProperty({ type: () => NightAuditGroupReviewSectionDto })
  groupReview!: NightAuditGroupReviewSectionDto;
}
