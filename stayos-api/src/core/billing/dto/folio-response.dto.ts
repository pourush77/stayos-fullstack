import { ApiProperty } from '@nestjs/swagger';
import { FolioChargeType } from '../domain/folio-charge-type.enum';
import { FolioPaymentMethod } from '../domain/folio-payment-method.enum';
import { FolioStatus } from '../domain/folio-status.enum';

export class FolioChargeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() folioId!: string;
  @ApiProperty({ enum: FolioChargeType }) type!: FolioChargeType;
  @ApiProperty() description!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitAmount!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() taxAmount!: string;
  @ApiProperty() chargedAt!: Date;
  @ApiProperty({ nullable: true }) createdByUserId!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class FolioPaymentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() folioId!: string;
  @ApiProperty({ enum: FolioPaymentMethod }) method!: FolioPaymentMethod;
  @ApiProperty() amount!: string;
  @ApiProperty({ nullable: true }) reference!: string | null;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty() receivedAt!: Date;
  @ApiProperty({ nullable: true }) receivedByUserId!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class FolioTotalsDto {
  @ApiProperty() subtotal!: string;
  @ApiProperty() tax!: string;
  @ApiProperty() total!: string;
  @ApiProperty() paid!: string;
  @ApiProperty() balance!: string;
}

export class FolioGuestSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ nullable: true }) email!: string | null;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty() isVip!: boolean;
}

export class FolioReservationSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() reservationCode!: string;
  @ApiProperty() arrivalDate!: string;
  @ApiProperty() departureDate!: string;
  @ApiProperty() status!: string;
  @ApiProperty() paymentStatus!: string;
  @ApiProperty({ nullable: true }) roomId!: string | null;
}

export class FolioResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() propertyId!: string;
  @ApiProperty() reservationId!: string;
  @ApiProperty() guestId!: string;
  @ApiProperty() folioNumber!: string;
  @ApiProperty({ enum: FolioStatus }) status!: FolioStatus;
  @ApiProperty() currency!: string;
  @ApiProperty({ nullable: true }) settledAt!: Date | null;
  @ApiProperty({ nullable: true }) notes!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: FolioTotalsDto }) totals!: FolioTotalsDto;
  @ApiProperty({ type: FolioGuestSummaryDto }) guest!: FolioGuestSummaryDto;
  @ApiProperty({ type: FolioReservationSummaryDto }) reservation!: FolioReservationSummaryDto;
  @ApiProperty({ type: [FolioChargeResponseDto] }) charges!: FolioChargeResponseDto[];
  @ApiProperty({ type: [FolioPaymentResponseDto] }) payments!: FolioPaymentResponseDto[];
}
