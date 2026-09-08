import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEventEntity } from '../audit/infrastructure/audit-event.entity';
import { FolioPaymentEntity } from '../billing/infrastructure/folio-payment.entity';
import { FolioEntity } from '../billing/infrastructure/folio.entity';
import { GroupBookingRoomAssignmentEntity } from '../operations/infrastructure/group-booking-room-assignment.entity';
import { GroupBookingEntity } from '../operations/infrastructure/group-booking.entity';
import { GroupMasterFolioEntity } from '../operations/infrastructure/group-master-folio.entity';
import { GroupStayEntity } from '../operations/infrastructure/group-stay.entity';
import { PropertyEntity } from '../properties/infrastructure/property.entity';
import { PropertiesModule } from '../properties/properties.module';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { NightAuditFolioExceptionsCollector } from './collectors/night-audit-folio-exceptions.collector';
import { NightAuditFinancialSummaryCollector } from './collectors/night-audit-financial-summary.collector';
import { NightAuditReportPdfService } from './night-audit-report-pdf.service';
import { NightAuditGroupReviewCollector } from './collectors/night-audit-group-review.collector';
import { NightAuditPendingArrivalsCollector } from './collectors/night-audit-pending-arrivals.collector';
import { NightAuditStayReviewCollector } from './collectors/night-audit-stay-review.collector';
import { NightAuditRunEntity } from './infrastructure/night-audit-run.entity';
import { NightAuditController } from './night-audit.controller';
import { NightAuditService } from './night-audit.service';
import { NightAuditPreCloseValidator } from './validators/night-audit-pre-close.validator';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NightAuditRunEntity,
      PropertyEntity,
      AuditEventEntity,
      ReservationEntity,
      FolioEntity,
      GroupStayEntity,
      GroupBookingEntity,
      GroupBookingRoomAssignmentEntity,
      GroupMasterFolioEntity,
      FolioPaymentEntity,
    ]),
    PropertiesModule,
    BillingModule,
  ],
  controllers: [NightAuditController],
  providers: [
    NightAuditService,
    NightAuditPendingArrivalsCollector,
    NightAuditStayReviewCollector,
    NightAuditFolioExceptionsCollector,
    NightAuditGroupReviewCollector,
    NightAuditPreCloseValidator,
    NightAuditFinancialSummaryCollector,
    NightAuditReportPdfService,
  ],
  exports: [
    NightAuditService,
    NightAuditPendingArrivalsCollector,
    NightAuditStayReviewCollector,
    NightAuditFolioExceptionsCollector,
    NightAuditGroupReviewCollector,
    NightAuditPreCloseValidator,
    NightAuditFinancialSummaryCollector,
  ],
})
export class NightAuditModule {}

