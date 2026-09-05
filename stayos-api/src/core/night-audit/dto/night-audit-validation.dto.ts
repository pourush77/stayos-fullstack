import { ApiProperty } from '@nestjs/swagger';

export enum NightAuditValidationReasonCode {
  PENDING_ARRIVALS = 'PENDING_ARRIVALS',
  DUE_OUT_OR_OVERDUE_STAYS = 'DUE_OUT_OR_OVERDUE_STAYS',
  FOLIO_EXCEPTIONS = 'FOLIO_EXCEPTIONS',
  GROUP_EXCEPTIONS = 'GROUP_EXCEPTIONS',
}

export class NightAuditValidationReasonDto {
  @ApiProperty({
    enum: NightAuditValidationReasonCode,
    example: NightAuditValidationReasonCode.PENDING_ARRIVALS,
    description: 'Machine-readable reason code for blocking condition',
  })
  code!: NightAuditValidationReasonCode;

  @ApiProperty({
    example: 2,
    description: 'Number of blocking conditions for this reason',
  })
  count!: number;
}

export class NightAuditValidationBlockersDto {
  @ApiProperty({
    example: 0,
    description: 'Number of blocking pending arrivals',
  })
  pendingArrivals!: number;

  @ApiProperty({
    example: 0,
    description: 'Number of blocking due-out or overdue stays',
  })
  stayReview!: number;

  @ApiProperty({
    example: 0,
    description: 'Number of blocking folio exceptions',
  })
  folioExceptions!: number;

  @ApiProperty({
    example: 0,
    description: 'Number of blocking group exceptions',
  })
  groupReview!: number;
}

export class NightAuditValidationDto {
  @ApiProperty({
    example: true,
    description: 'Whether the night audit run is eligible to close',
  })
  canClose!: boolean;

  @ApiProperty({
    example: 0,
    description: 'Total blocking conditions across all operational sections',
  })
  totalBlockingCount!: number;

  @ApiProperty({
    type: () => NightAuditValidationBlockersDto,
    description: 'Breakdown of blockers by operational section',
  })
  blockers!: NightAuditValidationBlockersDto;

  @ApiProperty({
    type: () => [NightAuditValidationReasonDto],
    description: 'Stable machine-readable reasons for non-zero blocker sections',
  })
  reasons!: NightAuditValidationReasonDto[];
}
