import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FolioChargeEntity } from '../billing/infrastructure/folio-charge.entity';
import { FolioPaymentEntity } from '../billing/infrastructure/folio-payment.entity';
import { GuestRequestEntity } from '../guest-requests/infrastructure/guest-request.entity';
import { GuestEntity } from '../guests/infrastructure/guest.entity';
import { NightAuditRunEntity } from '../night-audit/infrastructure/night-audit-run.entity';
import { ReservationEntity } from '../reservations/infrastructure/reservation.entity';
import { RoomEntity } from '../rooms/infrastructure/room.entity';
import { GuestLoyaltyReportService } from './guest-loyalty-report.service';
import { NightAuditHistoryService } from './night-audit-history.service';
import { OccupancyReportService } from './occupancy-report.service';
import { OperationsReportService } from './operations-report.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { RevenueReportService } from './revenue-report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReservationEntity,
      RoomEntity,
      FolioChargeEntity,
      FolioPaymentEntity,
      GuestRequestEntity,
      GuestEntity,
      NightAuditRunEntity,
    ]),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    OccupancyReportService,
    RevenueReportService,
    OperationsReportService,
    GuestLoyaltyReportService,
    NightAuditHistoryService,
  ],
})
export class ReportsModule {}
