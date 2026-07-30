import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CFormStatus } from '../domain/c-form-status.enum';
import { IdentityDocumentType } from '../domain/identity-document-type.enum';
import { ReservationPaymentStatus } from '../domain/reservation-payment-status.enum';
import { ReservationSource } from '../domain/reservation-source.enum';
import { ReservationStatus } from '../domain/reservation-status.enum';

export class CheckInBookingDto {
  @ApiProperty({ format: 'uuid' })
  reservationId!: string;
  @ApiProperty()
  reservationCode!: string;
  @ApiProperty({ enum: ReservationStatus })
  status!: ReservationStatus;
  @ApiProperty({ format: 'date' })
  arrivalDate!: string;
  @ApiProperty({ format: 'date' })
  departureDate!: string;
  @ApiProperty()
  adults!: number;
  @ApiProperty()
  children!: number;
  @ApiProperty({ enum: ReservationSource })
  source!: ReservationSource;
  @ApiPropertyOptional()
  specialRequests!: string | null;
}

export class CheckInGuestDto {
  @ApiProperty({ format: 'uuid' })
  guestId!: string;
  @ApiProperty()
  fullName!: string;
  @ApiPropertyOptional()
  mobile!: string | null;
  @ApiPropertyOptional()
  email!: string | null;
  @ApiPropertyOptional()
  nationality!: string | null;
  @ApiPropertyOptional()
  gender!: string | null;
  @ApiPropertyOptional({ format: 'date' })
  dateOfBirth!: string | null;
  @ApiPropertyOptional()
  address!: string | null;
  @ApiPropertyOptional()
  city!: string | null;
  @ApiPropertyOptional()
  state!: string | null;
  @ApiPropertyOptional()
  country!: string | null;
  @ApiPropertyOptional()
  postalCode!: string | null;
  @ApiPropertyOptional()
  purposeOfVisit!: string | null;
  @ApiPropertyOptional()
  arrivalFrom!: string | null;
  @ApiPropertyOptional()
  nextDestination!: string | null;
}

export class CheckInIdentityDto {
  @ApiPropertyOptional({ enum: IdentityDocumentType })
  idType!: IdentityDocumentType | null;
  @ApiPropertyOptional()
  idNumberMasked!: string | null;
  @ApiProperty()
  documentFrontUploaded!: boolean;
  @ApiProperty()
  documentBackUploaded!: boolean;
  @ApiProperty()
  verified!: boolean;
  @ApiPropertyOptional({ format: 'uuid' })
  verifiedBy!: string | null;
  @ApiPropertyOptional({ format: 'date-time' })
  verifiedAt!: Date | null;
}

export class CheckInDocumentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  side!: string;
  @ApiProperty()
  originalFilename!: string;
  @ApiProperty()
  mimeType!: string;
  @ApiProperty()
  sizeBytes!: number;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class CheckInForeignGuestDto {
  @ApiProperty()
  isForeignNational!: boolean;
  @ApiPropertyOptional()
  passportNumberMasked!: string | null;
  @ApiPropertyOptional()
  passportIssuePlace!: string | null;
  @ApiPropertyOptional({ format: 'date' })
  passportIssueDate!: string | null;
  @ApiPropertyOptional({ format: 'date' })
  passportExpiryDate!: string | null;
  @ApiPropertyOptional()
  visaNumberMasked!: string | null;
  @ApiPropertyOptional()
  visaType!: string | null;
  @ApiPropertyOptional({ format: 'date' })
  visaIssueDate!: string | null;
  @ApiPropertyOptional({ format: 'date' })
  visaExpiryDate!: string | null;
  @ApiProperty()
  cFormRequired!: boolean;
  @ApiProperty({ enum: CFormStatus })
  cFormStatus!: CFormStatus;
}

export class CheckInPaymentDto {
  @ApiProperty({ enum: ReservationPaymentStatus })
  paymentStatus!: ReservationPaymentStatus;
  @ApiProperty()
  outstandingAmount!: number;
  @ApiPropertyOptional()
  paymentMethod!: string | null;
}

export class CheckInRoomDto {
  @ApiPropertyOptional({ format: 'uuid' })
  roomId!: string | null;
  @ApiPropertyOptional()
  roomNumber!: string | null;
  @ApiPropertyOptional()
  roomType!: string | null;
  @ApiPropertyOptional()
  floor!: string | null;
  @ApiPropertyOptional()
  operationalStatus!: string | null;
  @ApiProperty()
  readyForCheckIn!: boolean;
  @ApiProperty({ type: [String] })
  warnings!: string[];
}

export class CheckInFinalChecklistDto {
  @ApiProperty()
  bookingReviewed!: boolean;
  @ApiProperty()
  guestRegistrationComplete!: boolean;
  @ApiProperty()
  identityVerified!: boolean;
  @ApiProperty()
  paymentReviewed!: boolean;
  @ApiProperty()
  roomReady!: boolean;
  @ApiProperty()
  canCheckIn!: boolean;
  @ApiProperty({ type: [String] })
  blockers!: string[];
}

export class CheckInWorkspaceResponseDto {
  @ApiProperty({ type: CheckInBookingDto })
  booking!: CheckInBookingDto;
  @ApiProperty({ type: CheckInGuestDto })
  guest!: CheckInGuestDto;
  @ApiProperty({ type: CheckInIdentityDto })
  identity!: CheckInIdentityDto;
  @ApiProperty({ type: [CheckInDocumentDto] })
  documents!: CheckInDocumentDto[];
  @ApiProperty({ type: CheckInForeignGuestDto })
  foreignGuest!: CheckInForeignGuestDto;
  @ApiProperty({ type: CheckInPaymentDto })
  payment!: CheckInPaymentDto;
  @ApiProperty({ type: CheckInRoomDto })
  room!: CheckInRoomDto;
  @ApiProperty({ type: CheckInFinalChecklistDto })
  finalChecklist!: CheckInFinalChecklistDto;
}
